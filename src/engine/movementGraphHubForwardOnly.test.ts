import { describe, expect, it } from "vitest";
import { compileConfig } from "@/compiler";
import {
	graphMinEdgeDistToPromoRow,
	graphMinEdgeDistToTargetNode,
	isForwardGraphStep,
	jumpDestinations,
	legalDestinations,
	type MovementConfig
} from "@/engine/movement";
import type { KernelAction } from "@/engine/kernel";
import { createInitialState } from "@/engine/reducer";
import { getCell, setCell, type Grid } from "@/engine/types";
import { buildGraphTopologyData } from "@/engine/topology";
import { examplePresets } from "@/presets/registry";
import { validateConfig } from "@/engine/validateConfig";
import { replayActions } from "@/ir/gameIr";
import { zConfig } from "@/schemas/config";

const HUB_NODES = [
	{ row: 0, col: 1, x: 1, y: 0 },
	{ row: 1, col: 1, x: 1, y: 1 },
	{ row: 2, col: 1, x: 1, y: 2 },
	{ row: 2, col: 0, x: 0, y: 2 },
	{ row: 3, col: 0, x: 0, y: 3 },
	{ row: 3, col: 2, x: 2, y: 3 },
	{ row: 4, col: 0, x: 0, y: 4 },
	{ row: 4, col: 2, x: 2, y: 4 }
];
const HUB_EDGES: Array<[string, string]> = [
	["0,1", "1,1"],
	["1,1", "2,1"],
	["2,1", "2,0"],
	["2,1", "3,0"],
	["3,0", "4,0"],
	["3,2", "4,2"]
];

const HUB_GRAPH = buildGraphTopologyData(HUB_NODES, HUB_EDGES);

const HUB_FORWARD: MovementConfig = {
	adjacency: "orthogonal",
	range: 1,
	capture: "jump",
	mustCapture: true,
	promotion: {
		targetNodes: { X: "2,1", O: "3,2" },
		crownedAdjacency: "orthogonal",
		crownedRange: 2,
		menForwardOnly: true
	}
};

const hubBoard = {
	wrap: false,
	topology: "graph" as const,
	graph: HUB_GRAPH
};

function emptyHubGrid(): Grid {
	return { width: 3, height: 5, cells: Array(3 * 5).fill(null) };
}

describe("graph targetNodes + menForwardOnly schema", () => {
	it("accepts menForwardOnly with jump promotion on graph + targetNodes", () => {
		const cfg = examplePresets["graph-hub-forward-men-jump-lite"].config;
		expect(validateConfig(cfg).ok).toBe(true);
		const parsed = zConfig.safeParse(cfg);
		expect(parsed.success).toBe(true);
		if (parsed.success) {
			expect(parsed.data.grid.topology).toBe("graph");
			expect(parsed.data.movement?.promotion?.menForwardOnly).toBe(true);
			expect(parsed.data.movement?.promotion?.targetNodes).toEqual({
				X: "2,1",
				O: "3,2"
			});
			expect(parsed.data.movement?.promotion?.targetRows).toBeUndefined();
		}
	});
});

describe("graph hub-distance forward helpers", () => {
	it("min edge dist to hub node", () => {
		expect(
			graphMinEdgeDistToTargetNode({ row: 4, col: 0 }, "2,1", HUB_GRAPH)
		).toBe(2);
		expect(
			graphMinEdgeDistToTargetNode({ row: 2, col: 1 }, "2,1", HUB_GRAPH)
		).toBe(0);
		expect(
			graphMinEdgeDistToTargetNode({ row: 2, col: 0 }, "2,1", HUB_GRAPH)
		).toBe(1);
		expect(
			graphMinEdgeDistToTargetNode({ row: 1, col: 1 }, "2,1", HUB_GRAPH)
		).toBe(1);
	});

	it("isForwardGraphStep with targetNodes requires strict hub-distance decrease", () => {
		expect(
			isForwardGraphStep(
				{ row: 4, col: 0 },
				{ row: 3, col: 0 },
				"X",
				{ targetNodes: { X: "2,1", O: "3,2" } },
				HUB_GRAPH
			)
		).toBe(true);
		expect(
			isForwardGraphStep(
				{ row: 3, col: 0 },
				{ row: 4, col: 0 },
				"X",
				{ targetNodes: { X: "2,1", O: "3,2" } },
				HUB_GRAPH
			)
		).toBe(false);
	});

	it("hub-distance ≠ row-delta: decoy step blocked, hub step allowed", () => {
		// From (1,1): both (2,1) hub and (2,0) decoy share row 2.
		// Row-distance: both lands are Dist 1→0 (any node on promo row).
		// Hub-distance: (1,1)→(2,1) = 1→0 forward; (1,1)→(2,0) = 1→1 lateral.
		expect(
			graphMinEdgeDistToPromoRow({ row: 1, col: 1 }, 2, HUB_GRAPH)
		).toBe(1);
		expect(
			graphMinEdgeDistToTargetNode({ row: 1, col: 1 }, "2,1", HUB_GRAPH)
		).toBe(1);
		expect(
			graphMinEdgeDistToTargetNode({ row: 2, col: 0 }, "2,1", HUB_GRAPH)
		).toBe(1);
		expect(
			isForwardGraphStep(
				{ row: 1, col: 1 },
				{ row: 2, col: 1 },
				"X",
				{ targetRows: { X: 2, O: 4 } },
				HUB_GRAPH
			)
		).toBe(true);
		expect(
			isForwardGraphStep(
				{ row: 1, col: 1 },
				{ row: 2, col: 0 },
				"X",
				{ targetRows: { X: 2, O: 4 } },
				HUB_GRAPH
			)
		).toBe(true);
		expect(
			isForwardGraphStep(
				{ row: 1, col: 1 },
				{ row: 2, col: 1 },
				"X",
				{ targetNodes: { X: "2,1", O: "3,2" } },
				HUB_GRAPH
			)
		).toBe(true);
		expect(
			isForwardGraphStep(
				{ row: 1, col: 1 },
				{ row: 2, col: 0 },
				"X",
				{ targetNodes: { X: "2,1", O: "3,2" } },
				HUB_GRAPH
			)
		).toBe(false);

		const grid = emptyHubGrid();
		grid.cells = setCell(grid, { row: 1, col: 1 }, "X");
		const dests = legalDestinations(
			grid,
			{ row: 1, col: 1 },
			{ ...HUB_FORWARD, mustCapture: false },
			hubBoard
		);
		expect(dests).toEqual([{ row: 2, col: 1 }]);
		expect(dests.some((p) => p.row === 2 && p.col === 0)).toBe(false);
		expect(dests.some((p) => p.row === 0)).toBe(false);
	});
});

describe("graph hub menForwardOnly legality", () => {
	it("uncrowned man: only hub-forward quiet steps", () => {
		const grid = emptyHubGrid();
		grid.cells = setCell(grid, { row: 4, col: 0 }, "X");
		const dests = legalDestinations(
			grid,
			{ row: 4, col: 0 },
			{ ...HUB_FORWARD, mustCapture: false },
			hubBoard
		);
		expect(dests).toEqual([{ row: 3, col: 0 }]);
	});

	it("uncrowned man: forward jump to hub ok, backward jump illegal", () => {
		const forwardBoard = emptyHubGrid();
		forwardBoard.cells = setCell(forwardBoard, { row: 4, col: 0 }, "X");
		forwardBoard.cells = setCell(forwardBoard, { row: 3, col: 0 }, "O");
		const fwd = jumpDestinations(
			forwardBoard,
			{ row: 4, col: 0 },
			HUB_FORWARD,
			hubBoard,
			"X"
		);
		expect(fwd).toEqual([{ row: 2, col: 1 }]);

		const backBoard = emptyHubGrid();
		backBoard.cells = setCell(backBoard, { row: 2, col: 1 }, "X");
		backBoard.cells = setCell(backBoard, { row: 3, col: 0 }, "O");
		const back = jumpDestinations(
			backBoard,
			{ row: 2, col: 1 },
			HUB_FORWARD,
			hubBoard,
			"X"
		);
		expect(back).toEqual([]);
	});

	it("crowned piece ignores menForwardOnly (retreat legal)", () => {
		const grid = emptyHubGrid();
		grid.cells = setCell(grid, { row: 2, col: 1 }, "X+");
		const dests = legalDestinations(
			grid,
			{ row: 2, col: 1 },
			{ ...HUB_FORWARD, mustCapture: false },
			hubBoard
		);
		expect(dests.some((p) => p.row === 0 && p.col === 1)).toBe(true);
		expect(dests.some((p) => p.row === 3 && p.col === 0)).toBe(true);
		expect(dests.some((p) => p.row === 2 && p.col === 0)).toBe(true);
	});
});

describe("Graph Hub Forward Men Jump Lite transcript + replay", () => {
	it("opening forward jump promotes; crowned walks to win; replay matches", () => {
		const { gameConfig, kernel } = compileConfig(
			examplePresets["graph-hub-forward-men-jump-lite"].config
		);
		expect(gameConfig.movement?.promotion?.menForwardOnly).toBe(true);
		expect(gameConfig.movement?.promotion?.targetNodes).toEqual({
			X: "2,1",
			O: "3,2"
		});
		expect(gameConfig.topology).toBe("graph");
		let state = createInitialState(gameConfig);

		const opening = kernel.legalActions(state, 0);
		expect(opening).toEqual([
			{ type: "move", from: { row: 4, col: 0 }, to: { row: 2, col: 1 } }
		]);

		let result = kernel.stepSync(state, opening[0]!);
		expect(getCell(result.nextState.grid, { row: 2, col: 1 })).toBe("X+");
		expect(result.events.some((e) => e.type === "piecePromoted")).toBe(
			true
		);
		expect(result.nextState.status).toBe("playing");
		state = result.nextState;

		const oLegal = kernel.legalActions(state, 1) as KernelAction[];
		expect(
			oLegal.some(
				(a) =>
					a.type === "move" &&
					a.from.row === 4 &&
					a.from.col === 2 &&
					a.to.row === 3 &&
					a.to.col === 2
			)
		).toBe(true);
		result = kernel.stepSync(state, {
			type: "move",
			from: { row: 4, col: 2 },
			to: { row: 3, col: 2 }
		});
		expect(result.nextState.status).toBe("playing");
		state = result.nextState;

		const winMove = {
			type: "move" as const,
			from: { row: 2, col: 1 },
			to: { row: 0, col: 1 }
		};
		expect(kernel.legalActions(state, 0)).toEqual(
			expect.arrayContaining([winMove])
		);
		result = kernel.stepSync(state, winMove);
		expect(result.nextState.status).toBe("won");
		expect(result.nextState.winner).toBe("X");

		const actions: KernelAction[] = [
			{ type: "move", from: { row: 4, col: 0 }, to: { row: 2, col: 1 } },
			{ type: "move", from: { row: 4, col: 2 }, to: { row: 3, col: 2 } },
			winMove
		];
		const { finalState, faithful, events } = replayActions(
			gameConfig,
			actions,
			gameConfig.seed
		);
		expect(faithful).toBe(true);
		expect(events.some((e) => e.type === "piecePromoted")).toBe(true);
		expect(finalState.status).toBe("won");
		expect(finalState.winner).toBe("X");
		expect(getCell(finalState.grid, { row: 0, col: 1 })).toBe("X+");
	});
});
