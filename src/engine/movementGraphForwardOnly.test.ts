import { describe, expect, it } from "vitest";
import { compileConfig } from "@/compiler";
import {
	graphMinEdgeDistToPromoRow,
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

const LANE_NODES = [
	{ row: 0, col: 0, x: 0, y: 0 },
	{ row: 1, col: 0, x: 0, y: 1 },
	{ row: 2, col: 0, x: 0, y: 2 },
	{ row: 3, col: 0, x: 0, y: 3 },
	{ row: 4, col: 0, x: 0, y: 4 },
	{ row: 0, col: 1, x: 1, y: 0 },
	{ row: 1, col: 1, x: 1, y: 1 },
	{ row: 2, col: 1, x: 1, y: 2 },
	{ row: 3, col: 1, x: 1, y: 3 },
	{ row: 4, col: 1, x: 1, y: 4 }
];
const LANE_EDGES: Array<[string, string]> = [
	["0,0", "1,0"],
	["1,0", "2,0"],
	["2,0", "3,0"],
	["3,0", "4,0"],
	["0,1", "1,1"],
	["1,1", "2,1"],
	["2,1", "3,1"],
	["3,1", "4,1"]
];

const LANE_GRAPH = buildGraphTopologyData(LANE_NODES, LANE_EDGES);

const GRAPH_FORWARD: MovementConfig = {
	adjacency: "orthogonal",
	range: 1,
	capture: "jump",
	mustCapture: true,
	promotion: {
		targetRows: { X: 2, O: 3 },
		crownedAdjacency: "orthogonal",
		crownedRange: 2,
		menForwardOnly: true
	}
};

const graphBoard = {
	wrap: false,
	topology: "graph" as const,
	graph: LANE_GRAPH
};

function emptyLaneGrid(): Grid {
	return { width: 2, height: 5, cells: Array(2 * 5).fill(null) };
}

describe("graph promotion.menForwardOnly schema", () => {
	it("accepts menForwardOnly with jump promotion on graph + targetRows", () => {
		const cfg = examplePresets["graph-forward-men-jump-lite"].config;
		expect(validateConfig(cfg).ok).toBe(true);
		const parsed = zConfig.safeParse(cfg);
		expect(parsed.success).toBe(true);
		if (parsed.success) {
			expect(parsed.data.grid.topology).toBe("graph");
			expect(parsed.data.movement?.promotion?.menForwardOnly).toBe(true);
			expect(parsed.data.movement?.promotion?.targetRows).toEqual({
				X: 2,
				O: 3
			});
		}
	});

	it("accepts targetNodes + menForwardOnly on graph (hub forward)", () => {
		const base = structuredClone(
			examplePresets["graph-hub-crowned-jump-lite"].config
		);
		base.movement = {
			...base.movement!,
			promotion: {
				...base.movement!.promotion!,
				menForwardOnly: true
			}
		};
		const parsed = zConfig.safeParse(base);
		expect(parsed.success).toBe(true);
		if (parsed.success) {
			expect(parsed.data.movement?.promotion?.menForwardOnly).toBe(true);
			expect(parsed.data.movement?.promotion?.targetNodes).toEqual({
				X: "2,1",
				O: "2,0"
			});
		}
	});
});

describe("graph edge-distance forward helpers", () => {
	it("min edge dist to promo row on a lane", () => {
		expect(
			graphMinEdgeDistToPromoRow({ row: 4, col: 0 }, 2, LANE_GRAPH)
		).toBe(2);
		expect(
			graphMinEdgeDistToPromoRow({ row: 2, col: 0 }, 2, LANE_GRAPH)
		).toBe(0);
		expect(
			graphMinEdgeDistToPromoRow({ row: 3, col: 1 }, 3, LANE_GRAPH)
		).toBe(0);
	});

	it("isForwardGraphStep requires strict distance decrease", () => {
		expect(
			isForwardGraphStep(
				{ row: 4, col: 0 },
				{ row: 3, col: 0 },
				"X",
				{ targetRows: { X: 2, O: 3 } },
				LANE_GRAPH
			)
		).toBe(true);
		expect(
			isForwardGraphStep(
				{ row: 3, col: 0 },
				{ row: 4, col: 0 },
				"X",
				{ targetRows: { X: 2, O: 3 } },
				LANE_GRAPH
			)
		).toBe(false);
	});

	it("edge-distance ≠ row-delta on a bypass graph", () => {
		// Promo row 0 has only (0,1). Direct edge (2,0)→(0,1) makes Dist=1,
		// while (1,0) is farther (Dist=2 via 1,1) despite a lower row.
		const bypass = buildGraphTopologyData(
			[
				{ row: 0, col: 1, x: 1, y: 0 },
				{ row: 1, col: 0, x: 0, y: 1 },
				{ row: 1, col: 1, x: 1, y: 1 },
				{ row: 2, col: 0, x: 0, y: 2 },
				{ row: 2, col: 1, x: 1, y: 2 }
			],
			[
				["2,0", "0,1"],
				["2,0", "1,0"],
				["1,0", "1,1"],
				["1,1", "0,1"],
				["2,0", "2,1"]
			]
		);
		expect(graphMinEdgeDistToPromoRow({ row: 2, col: 0 }, 0, bypass)).toBe(
			1
		);
		expect(graphMinEdgeDistToPromoRow({ row: 1, col: 0 }, 0, bypass)).toBe(
			2
		);
		expect(
			isForwardGraphStep(
				{ row: 2, col: 0 },
				{ row: 1, col: 0 },
				"X",
				{ targetRows: { X: 0, O: 2 } },
				bypass
			)
		).toBe(false);
		expect(
			isForwardGraphStep(
				{ row: 2, col: 0 },
				{ row: 0, col: 1 },
				"X",
				{ targetRows: { X: 0, O: 2 } },
				bypass
			)
		).toBe(true);

		const grid: Grid = {
			width: 3,
			height: 3,
			cells: Array(9).fill(null)
		};
		grid.cells = setCell(grid, { row: 2, col: 0 }, "X");
		const cfg: MovementConfig = {
			adjacency: "orthogonal",
			range: 1,
			capture: "none",
			promotion: {
				targetRows: { X: 0, O: 2 },
				crownedAdjacency: "orthogonal",
				menForwardOnly: true
			}
		};
		const dests = legalDestinations(grid, { row: 2, col: 0 }, cfg, {
			topology: "graph",
			graph: bypass,
			wrap: false
		});
		expect(dests).toEqual([{ row: 0, col: 1 }]);
		expect(dests.some((p) => p.row === 1 && p.col === 0)).toBe(false);
		expect(dests.some((p) => p.row === 2 && p.col === 1)).toBe(false);
	});
});

describe("graph menForwardOnly legality", () => {
	it("uncrowned man: only forward edge-distance quiet steps", () => {
		const grid = emptyLaneGrid();
		grid.cells = setCell(grid, { row: 4, col: 0 }, "X");
		const dests = legalDestinations(
			grid,
			{ row: 4, col: 0 },
			{ ...GRAPH_FORWARD, mustCapture: false },
			graphBoard
		);
		expect(dests).toEqual([{ row: 3, col: 0 }]);
		expect(dests.some((p) => p.row > 4)).toBe(false);
	});

	it("uncrowned man: forward jump ok, backward jump illegal", () => {
		const forwardBoard = emptyLaneGrid();
		forwardBoard.cells = setCell(forwardBoard, { row: 4, col: 0 }, "X");
		forwardBoard.cells = setCell(forwardBoard, { row: 3, col: 0 }, "O");
		const fwd = jumpDestinations(
			forwardBoard,
			{ row: 4, col: 0 },
			GRAPH_FORWARD,
			graphBoard,
			"X"
		);
		expect(fwd).toEqual([{ row: 2, col: 0 }]);

		const backBoard = emptyLaneGrid();
		backBoard.cells = setCell(backBoard, { row: 2, col: 0 }, "X");
		backBoard.cells = setCell(backBoard, { row: 3, col: 0 }, "O");
		const back = jumpDestinations(
			backBoard,
			{ row: 2, col: 0 },
			GRAPH_FORWARD,
			graphBoard,
			"X"
		);
		expect(back).toEqual([]);

		const optional = {
			...GRAPH_FORWARD,
			promotion: {
				targetRows: { X: 2, O: 3 },
				crownedAdjacency: "orthogonal" as const,
				crownedRange: 2
			}
		};
		expect(
			jumpDestinations(
				backBoard,
				{ row: 2, col: 0 },
				optional,
				graphBoard,
				"X"
			).some((p) => p.row > 2)
		).toBe(true);
	});

	it("crowned piece ignores menForwardOnly (retreat legal)", () => {
		const grid = emptyLaneGrid();
		grid.cells = setCell(grid, { row: 2, col: 0 }, "X+");
		const dests = legalDestinations(
			grid,
			{ row: 2, col: 0 },
			{ ...GRAPH_FORWARD, mustCapture: false },
			graphBoard
		);
		expect(dests.some((p) => p.row === 0 && p.col === 0)).toBe(true);
		expect(dests.some((p) => p.row === 3)).toBe(true);
		expect(dests.some((p) => p.row === 4)).toBe(true);
	});
});

describe("Graph Forward Men Jump Lite transcript + replay", () => {
	it("opening forward jump promotes; crowned walks to win; replay matches", () => {
		const { gameConfig, kernel } = compileConfig(
			examplePresets["graph-forward-men-jump-lite"].config
		);
		expect(gameConfig.movement?.promotion?.menForwardOnly).toBe(true);
		expect(gameConfig.topology).toBe("graph");
		let state = createInitialState(gameConfig);

		const opening = kernel.legalActions(state, 0);
		expect(opening).toEqual([
			{ type: "move", from: { row: 4, col: 0 }, to: { row: 2, col: 0 } }
		]);

		let result = kernel.stepSync(state, opening[0]!);
		expect(getCell(result.nextState.grid, { row: 2, col: 0 })).toBe("X+");
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
					a.from.col === 1 &&
					a.to.row === 3 &&
					a.to.col === 1
			)
		).toBe(true);
		result = kernel.stepSync(state, {
			type: "move",
			from: { row: 4, col: 1 },
			to: { row: 3, col: 1 }
		});
		expect(result.nextState.status).toBe("playing");
		state = result.nextState;

		const winMove = {
			type: "move" as const,
			from: { row: 2, col: 0 },
			to: { row: 0, col: 0 }
		};
		expect(kernel.legalActions(state, 0)).toEqual(
			expect.arrayContaining([winMove])
		);
		result = kernel.stepSync(state, winMove);
		expect(result.nextState.status).toBe("won");
		expect(result.nextState.winner).toBe("X");

		const actions: KernelAction[] = [
			{ type: "move", from: { row: 4, col: 0 }, to: { row: 2, col: 0 } },
			{ type: "move", from: { row: 4, col: 1 }, to: { row: 3, col: 1 } },
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
		expect(getCell(finalState.grid, { row: 0, col: 0 })).toBe("X+");
	});
});
