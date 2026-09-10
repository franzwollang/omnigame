import { describe, expect, it } from "vitest";
import { compileConfig } from "@/compiler";
import {
	effectiveMovement,
	jumpDestinations,
	jumpMid,
	isJumpCapture,
	legalDestinations,
	usesFlyingCapture,
	type MovementConfig
} from "@/engine/movement";
import type { KernelAction } from "@/engine/kernel";
import { createInitialState } from "@/engine/reducer";
import { getCell, setCell, type Grid } from "@/engine/types";
import { examplePresets } from "@/presets/registry";
import { validateConfig } from "@/engine/validateConfig";
import { replayActions } from "@/ir/gameIr";
import { zConfig } from "@/schemas/config";
import { buildGraphTopologyData } from "@/engine/topology";

const GRAPH_FLY_CAP: MovementConfig = {
	adjacency: "orthogonal",
	range: 1,
	capture: "jump",
	mustCapture: true,
	promotion: {
		targetRows: { X: 4, O: 5 },
		crownedAdjacency: "orthogonal",
		crownedRange: 4,
		crownedFlyingCapture: true
	}
};

function graphBoard() {
	const { gameConfig } = compileConfig(
		examplePresets["graph-flying-capture-jump-lite"].config
	);
	return {
		topology: "graph" as const,
		graph: gameConfig.graph!,
		wrap: false
	};
}

function emptyGraphGrid(): Grid {
	const { gameConfig } = compileConfig(
		examplePresets["graph-flying-capture-jump-lite"].config
	);
	const grid = createInitialState(gameConfig).grid;
	return {
		width: grid.width,
		height: grid.height,
		cells: Array(grid.width * grid.height).fill(null)
	};
}

describe("graph promotion.crownedFlyingCapture schema", () => {
	it("accepts crownedFlyingCapture on graph with crownedRange >= 2", () => {
		const cfg = examplePresets["graph-flying-capture-jump-lite"].config;
		expect(validateConfig(cfg).ok).toBe(true);
		const parsed = zConfig.safeParse(cfg);
		expect(parsed.success).toBe(true);
		if (parsed.success) {
			expect(parsed.data.grid.topology).toBe("graph");
			expect(parsed.data.movement?.promotion?.crownedFlyingCapture).toBe(
				true
			);
			expect(parsed.data.movement?.promotion?.crownedRange).toBe(4);
		}
	});

	it("rejects graph crownedFlyingCapture when crownedRange < 2", () => {
		const base = structuredClone(
			examplePresets["graph-flying-capture-jump-lite"].config
		);
		base.movement = {
			...base.movement!,
			promotion: {
				...base.movement!.promotion!,
				crownedRange: 1
			}
		};
		const parsed = zConfig.safeParse(base);
		expect(parsed.success).toBe(false);
	});
});

describe("graph crownedFlyingCapture helpers", () => {
	it("usesFlyingCapture only for crowned pieces", () => {
		expect(usesFlyingCapture(GRAPH_FLY_CAP, "X+")).toBe(true);
		expect(usesFlyingCapture(GRAPH_FLY_CAP, "X")).toBe(false);
	});

	it("men keep adjacent 2-edge jumps; crowned get long landings", () => {
		const board = graphBoard();
		let grid = emptyGraphGrid();
		grid = { ...grid, cells: setCell(grid, { row: 4, col: 0 }, "X") };
		grid = { ...grid, cells: setCell(grid, { row: 3, col: 0 }, "O") };
		const manDests = jumpDestinations(
			grid,
			{ row: 4, col: 0 },
			GRAPH_FLY_CAP,
			board
		);
		expect(manDests).toEqual([{ row: 2, col: 0 }]);

		grid = { ...grid, cells: setCell(grid, { row: 4, col: 0 }, "X+") };
		const kingDests = jumpDestinations(
			grid,
			{ row: 4, col: 0 },
			GRAPH_FLY_CAP,
			board
		);
		expect(kingDests.some((p) => p.row === 2 && p.col === 0)).toBe(true);
		expect(kingDests.some((p) => p.row === 1 && p.col === 0)).toBe(true);
		expect(kingDests.some((p) => p.row === 0 && p.col === 0)).toBe(true);
	});

	it("empty approach before mid is legal for crowned on graph", () => {
		const board = graphBoard();
		let grid = emptyGraphGrid();
		// From (4,0): (3,0) empty → (2,0) O → lands (1,0)/(0,0)
		grid = { ...grid, cells: setCell(grid, { row: 4, col: 0 }, "X+") };
		grid = { ...grid, cells: setCell(grid, { row: 2, col: 0 }, "O") };
		const dests = jumpDestinations(
			grid,
			{ row: 4, col: 0 },
			GRAPH_FLY_CAP,
			board
		);
		expect(dests.some((p) => p.row === 1 && p.col === 0)).toBe(true);
		expect(dests.some((p) => p.row === 0 && p.col === 0)).toBe(true);
		expect(
			jumpMid(
				{ row: 4, col: 0 },
				{ row: 0, col: 0 },
				effectiveMovement(GRAPH_FLY_CAP, "X+"),
				board,
				grid
			)
		).toEqual({ row: 2, col: 0 });
	});

	it("without crownedFlyingCapture, long graph land is illegal", () => {
		const board = graphBoard();
		let grid = emptyGraphGrid();
		grid = { ...grid, cells: setCell(grid, { row: 4, col: 0 }, "X+") };
		grid = { ...grid, cells: setCell(grid, { row: 3, col: 0 }, "O") };
		const noFly: MovementConfig = {
			...GRAPH_FLY_CAP,
			promotion: {
				targetRows: { X: 4, O: 5 },
				crownedAdjacency: "orthogonal",
				crownedRange: 4
			}
		};
		const dests = jumpDestinations(
			grid,
			{ row: 4, col: 0 },
			noFly,
			board
		);
		expect(dests).toEqual([{ row: 2, col: 0 }]);
		expect(
			isJumpCapture(
				grid,
				{ row: 4, col: 0 },
				{ row: 0, col: 0 },
				"X",
				noFly,
				board
			)
		).toBe(false);
	});

	it("quiet graph slide blocked by enemy; flying jump clears it", () => {
		const board = graphBoard();
		let grid = emptyGraphGrid();
		grid = { ...grid, cells: setCell(grid, { row: 4, col: 0 }, "X+") };
		grid = { ...grid, cells: setCell(grid, { row: 3, col: 0 }, "O") };
		const quietOnly = legalDestinations(
			grid,
			{ row: 4, col: 0 },
			{
				...GRAPH_FLY_CAP,
				capture: "none",
				mustCapture: false
			},
			board
		);
		expect(quietOnly.some((p) => p.row === 0 && p.col === 0)).toBe(false);
		expect(
			jumpDestinations(
				grid,
				{ row: 4, col: 0 },
				GRAPH_FLY_CAP,
				board
			).some((p) => p.row === 0 && p.col === 0)
		).toBe(true);
	});

	it("junction stops flying ray (no turning mid-leap)", () => {
		// Y-junction at (1,0): rays from (3,0) cannot turn onto (1,1).
		const graph = buildGraphTopologyData(
			[
				{ row: 0, col: 0, x: 0, y: 0 },
				{ row: 1, col: 0, x: 0, y: 1 },
				{ row: 1, col: 1, x: 1, y: 1 },
				{ row: 2, col: 0, x: 0, y: 2 },
				{ row: 3, col: 0, x: 0, y: 3 }
			],
			[
				["0,0", "1,0"],
				["1,0", "1,1"],
				["1,0", "2,0"],
				["2,0", "3,0"]
			]
		);
		const board = {
			topology: "graph" as const,
			graph,
			wrap: false
		};
		let grid: Grid = {
			width: 2,
			height: 4,
			cells: Array(8).fill(null)
		};
		grid = { ...grid, cells: setCell(grid, { row: 3, col: 0 }, "X+") };
		grid = { ...grid, cells: setCell(grid, { row: 2, col: 0 }, "O") };
		const dests = jumpDestinations(
			grid,
			{ row: 3, col: 0 },
			{
				...GRAPH_FLY_CAP,
				promotion: {
					targetRows: { X: 3, O: 0 },
					crownedAdjacency: "orthogonal",
					crownedRange: 4,
					crownedFlyingCapture: true
				}
			},
			board
		);
		// Past mid (2,0) the chain hits junction (1,0) — land at (1,0) only;
		// cannot continue to (0,0) or turn to (1,1).
		expect(dests.some((p) => p.row === 1 && p.col === 0)).toBe(true);
		expect(dests.some((p) => p.row === 0 && p.col === 0)).toBe(false);
		expect(dests.some((p) => p.row === 1 && p.col === 1)).toBe(false);
	});
});

describe("GameIR graph flying capture win", () => {
	it("transcript + replay: promote then chain flying-capture win", () => {
		const cfg = examplePresets["graph-flying-capture-jump-lite"].config;
		const { gameConfig } = compileConfig(cfg);
		const actions: KernelAction[] = [
			{ type: "move", from: { row: 6, col: 0 }, to: { row: 4, col: 0 } },
			{ type: "move", from: { row: 4, col: 0 }, to: { row: 0, col: 0 } }
		];
		const { finalState, faithful, events } = replayActions(
			gameConfig,
			actions,
			cfg.rng.seed
		);
		expect(faithful).toBe(true);
		expect(events.some((e) => e.type === "piecePromoted")).toBe(true);
		expect(
			events.filter((e) => e.type === "pieceCaptured")
		).toHaveLength(2);
		expect(getCell(finalState.grid, { row: 0, col: 0 })).toBe("X+");
		expect(getCell(finalState.grid, { row: 3, col: 0 })).toBe(null);
		expect(finalState.status).toBe("won");
		expect(finalState.winner).toBe("X");
	});
});

describe("Graph Flying Capture Jump Lite preset", () => {
	it("opening jump promotes; chain flying capture wins", () => {
		const cfg = examplePresets["graph-flying-capture-jump-lite"].config;
		expect(validateConfig(cfg).ok).toBe(true);
		const { kernel, gameConfig } = compileConfig(cfg);
		expect(gameConfig.topology).toBe("graph");
		expect(gameConfig.movement?.promotion?.crownedFlyingCapture).toBe(true);
		expect(gameConfig.movement?.promotion?.crownedRange).toBe(4);
		expect(gameConfig.objectiveMode).toBe("reach_row");

		let state = createInitialState(gameConfig);
		expect(getCell(state.grid, { row: 6, col: 0 })).toBe("X");
		const opening = kernel.legalActions(state, 0);
		expect(opening).toEqual([
			{ type: "move", from: { row: 6, col: 0 }, to: { row: 4, col: 0 } }
		]);
		let result = kernel.stepSync(state, opening[0]!);
		expect(getCell(result.nextState.grid, { row: 4, col: 0 })).toBe("X+");
		expect(result.events.some((e) => e.type === "piecePromoted")).toBe(
			true
		);
		expect(result.nextState.mustContinueFrom).toEqual({
			row: 4,
			col: 0
		});
		state = result.nextState;

		const chainLegal = kernel.legalActions(state, 0);
		expect(
			chainLegal.some(
				(a) =>
					a.type === "move" &&
					a.from.row === 4 &&
					a.from.col === 0 &&
					a.to.row === 0 &&
					a.to.col === 0
			)
		).toBe(true);
		expect(
			chainLegal.some(
				(a) =>
					a.type === "move" &&
					a.from.row === 4 &&
					a.from.col === 0 &&
					a.to.row === 2 &&
					a.to.col === 0
			)
		).toBe(true);

		const winMove = chainLegal.find(
			(a) =>
				a.type === "move" &&
				a.from.row === 4 &&
				a.from.col === 0 &&
				a.to.row === 0 &&
				a.to.col === 0
		)!;
		result = kernel.stepSync(state, winMove);
		expect(getCell(result.nextState.grid, { row: 0, col: 0 })).toBe("X+");
		expect(getCell(result.nextState.grid, { row: 3, col: 0 })).toBe(null);
		expect(result.nextState.status).toBe("won");
		expect(result.nextState.winner).toBe("X");
	});

	it("without crownedFlyingCapture only adjacent land is legal", () => {
		const base = structuredClone(
			examplePresets["graph-flying-capture-jump-lite"].config
		);
		base.movement = {
			...base.movement!,
			promotion: {
				...base.movement!.promotion!,
				crownedFlyingCapture: undefined
			}
		};
		delete (base.movement.promotion as { crownedFlyingCapture?: boolean })
			.crownedFlyingCapture;
		const { kernel, gameConfig } = compileConfig(base);
		let state = createInitialState(gameConfig);
		const opening = kernel.legalActions(state, 0)[0]!;
		state = kernel.stepSync(state, opening).nextState;
		const chainLegal = kernel.legalActions(state, 0);
		expect(
			chainLegal.some(
				(a) =>
					a.type === "move" &&
					a.to.row === 2 &&
					a.to.col === 0
			)
		).toBe(true);
		expect(
			chainLegal.some(
				(a) =>
					a.type === "move" &&
					a.to.row === 0 &&
					a.to.col === 0
			)
		).toBe(false);
	});
});
