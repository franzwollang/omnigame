import { describe, expect, it } from "vitest";
import { compileConfig } from "@/compiler";
import {
	canMove,
	legalDestinations,
	type MovementConfig
} from "@/engine/movement";
import { playerIdOf, type KernelAction } from "@/engine/kernel";
import { createInitialState } from "@/engine/reducer";
import { getCell } from "@/engine/types";
import { examplePresets } from "@/presets/registry";
import { validateConfig } from "@/engine/validateConfig";
import { replayActions } from "@/ir/gameIr";
import { zConfig } from "@/schemas/config";

const ORTHO: MovementConfig = { adjacency: "orthogonal", range: 1 };

describe("movement helpers", () => {
	it("lists orthogonal empty neighbors", () => {
		const { gameConfig } = compileConfig(examplePresets["step-race"].config);
		const state = createInitialState(gameConfig);
		const from = { row: 4, col: 2 };
		expect(getCell(state.grid, from)).toBe("X");
		const dests = legalDestinations(state.grid, from, ORTHO);
		expect(dests).toEqual(
			expect.arrayContaining([
				{ row: 3, col: 2 },
				{ row: 4, col: 1 },
				{ row: 4, col: 3 }
			])
		);
		expect(dests).toHaveLength(3);
		expect(canMove(state.grid, from, { row: 3, col: 2 }, "X", ORTHO)).toBe(
			true
		);
		expect(canMove(state.grid, from, { row: 2, col: 2 }, "X", ORTHO)).toBe(
			false
		);
	});
});

describe("Step Race (Move + reach_row)", () => {
	it("validates and compiles the step-race preset", () => {
		const cfg = examplePresets["step-race"].config;
		expect(validateConfig(cfg).ok).toBe(true);
		const { kernel, gameConfig } = compileConfig(cfg);
		expect(gameConfig.inputMode).toBe("move");
		expect(gameConfig.objectiveMode).toBe("reach_row");
		expect(gameConfig.targetRows).toEqual({ X: 0, O: 4 });
		const state = kernel.initialState(cfg.rng.seed);
		expect(getCell(state.grid, { row: 4, col: 2 })).toBe("X");
		expect(getCell(state.grid, { row: 0, col: 2 })).toBe("O");
		expect(kernel.legalActions(state, 0).length).toBeGreaterThan(0);
		expect(
			kernel.legalActions(state, 0).every((a) => a.type === "move")
		).toBe(true);
	});

	it("rejects diagonal and occupied destinations", () => {
		const { kernel } = compileConfig(examplePresets["step-race"].config);
		let state = kernel.initialState();
		const illegalDiag: KernelAction = {
			type: "move",
			from: { row: 4, col: 2 },
			to: { row: 3, col: 3 }
		};
		const ignored = kernel.stepSync(state, illegalDiag);
		expect(ignored.events[0]?.type).toBe("ignored");
		expect(ignored.nextState).toBe(state);
	});

	it("X wins by stepping north to row 0 (compiler→kernel transcript)", () => {
		const cfg = examplePresets["step-race"].config;
		const { kernel } = compileConfig(cfg);
		// X at (4,2) races north; O at (0,2) steps aside then south slowly.
		const script: Extract<KernelAction, { type: "move" }>[] = [
			{ type: "move", from: { row: 4, col: 2 }, to: { row: 3, col: 2 } }, // X
			{ type: "move", from: { row: 0, col: 2 }, to: { row: 0, col: 1 } }, // O
			{ type: "move", from: { row: 3, col: 2 }, to: { row: 2, col: 2 } }, // X
			{ type: "move", from: { row: 0, col: 1 }, to: { row: 0, col: 0 } }, // O
			{ type: "move", from: { row: 2, col: 2 }, to: { row: 1, col: 2 } }, // X
			{ type: "move", from: { row: 0, col: 0 }, to: { row: 1, col: 0 } }, // O
			{ type: "move", from: { row: 1, col: 2 }, to: { row: 0, col: 2 } } // X reaches row 0
		];

		let state = kernel.initialState(cfg.rng.seed);
		for (const action of script) {
			const player = playerIdOf(state.currentPlayer);
			expect(
				kernel.legalActions(state, player).some(
					(a) =>
						a.type === "move" &&
						a.from.row === action.from.row &&
						a.from.col === action.from.col &&
						a.to.row === action.to.row &&
						a.to.col === action.to.col
				)
			).toBe(true);
			const result = kernel.stepSync(state, action);
			expect(result.events[0]?.type).toBe("actionApplied");
			state = result.nextState;
		}

		expect(state.status).toBe("won");
		expect(state.winner).toBe("X");
		expect(getCell(state.grid, { row: 0, col: 2 })).toBe("X");
		expect(kernel.legalActions(state, 0)).toEqual([]);

		const replay = replayActions(
			compileConfig(cfg).gameConfig,
			script,
			cfg.rng.seed
		);
		expect(replay.faithful).toBe(true);
		expect(replay.finalState.status).toBe("won");
		expect(replay.finalState.winner).toBe("X");
	});
});

const DIAG: MovementConfig = { adjacency: "diagonal", range: 1 };
const KING: MovementConfig = { adjacency: "king", range: 1 };

describe("movement adjacency: diagonal / king", () => {
	it("lists diagonal empty neighbors and rejects orthogonal", () => {
		const { gameConfig } = compileConfig(
			examplePresets["diagonal-step-race"].config
		);
		const state = createInitialState(gameConfig);
		const from = { row: 4, col: 2 };
		const dests = legalDestinations(state.grid, from, DIAG);
		expect(dests).toEqual(
			expect.arrayContaining([
				{ row: 3, col: 1 },
				{ row: 3, col: 3 }
			])
		);
		expect(dests).toHaveLength(2);
		expect(canMove(state.grid, from, { row: 3, col: 1 }, "X", DIAG)).toBe(
			true
		);
		expect(canMove(state.grid, from, { row: 3, col: 2 }, "X", DIAG)).toBe(
			false
		);
	});

	it("king adjacency includes orthogonal and diagonal", () => {
		const { gameConfig } = compileConfig(examplePresets["step-race"].config);
		const state = createInitialState(gameConfig);
		const from = { row: 4, col: 2 };
		const dests = legalDestinations(state.grid, from, KING);
		expect(dests).toEqual(
			expect.arrayContaining([
				{ row: 3, col: 2 },
				{ row: 4, col: 1 },
				{ row: 4, col: 3 },
				{ row: 3, col: 1 },
				{ row: 3, col: 3 }
			])
		);
		expect(dests).toHaveLength(5);
	});
});

describe("Diagonal Step Race (diagonal adjacency + reach_row)", () => {
	it("validates and compiles the diagonal-step-race preset", () => {
		const cfg = examplePresets["diagonal-step-race"].config;
		expect(validateConfig(cfg).ok).toBe(true);
		const { kernel, gameConfig } = compileConfig(cfg);
		expect(gameConfig.inputMode).toBe("move");
		expect(gameConfig.movement?.adjacency).toBe("diagonal");
		expect(gameConfig.objectiveMode).toBe("reach_row");
		const state = kernel.initialState(cfg.rng.seed);
		const legal = kernel.legalActions(state, 0);
		expect(legal.every((a) => a.type === "move")).toBe(true);
		expect(
			legal.some(
				(a) =>
					a.type === "move" &&
					a.to.row === 3 &&
					a.to.col === 1
			)
		).toBe(true);
		expect(
			legal.some(
				(a) =>
					a.type === "move" &&
					a.to.row === 3 &&
					a.to.col === 2
			)
		).toBe(false);
	});

	it("rejects orthogonal destinations under diagonal adjacency", () => {
		const { kernel } = compileConfig(
			examplePresets["diagonal-step-race"].config
		);
		let state = kernel.initialState();
		const illegalOrtho: KernelAction = {
			type: "move",
			from: { row: 4, col: 2 },
			to: { row: 3, col: 2 }
		};
		const ignored = kernel.stepSync(state, illegalOrtho);
		expect(ignored.events[0]?.type).toBe("ignored");
		expect(ignored.nextState).toBe(state);
	});

	it("X wins by zigzagging diagonally to row 0", () => {
		const cfg = examplePresets["diagonal-step-race"].config;
		const { kernel } = compileConfig(cfg);
		// X: (4,2)→(3,3)→(2,2)→(1,3)→(0,2); O steps aside then south slowly.
		const script: Extract<KernelAction, { type: "move" }>[] = [
			{ type: "move", from: { row: 4, col: 2 }, to: { row: 3, col: 3 } }, // X
			{ type: "move", from: { row: 0, col: 2 }, to: { row: 1, col: 1 } }, // O
			{ type: "move", from: { row: 3, col: 3 }, to: { row: 2, col: 2 } }, // X
			{ type: "move", from: { row: 1, col: 1 }, to: { row: 2, col: 0 } }, // O
			{ type: "move", from: { row: 2, col: 2 }, to: { row: 1, col: 3 } }, // X
			{ type: "move", from: { row: 2, col: 0 }, to: { row: 3, col: 1 } }, // O
			{ type: "move", from: { row: 1, col: 3 }, to: { row: 0, col: 2 } } // X reaches row 0
		];

		let state = kernel.initialState(cfg.rng.seed);
		for (const action of script) {
			const player = playerIdOf(state.currentPlayer);
			expect(
				kernel.legalActions(state, player).some(
					(a) =>
						a.type === "move" &&
						a.from.row === action.from.row &&
						a.from.col === action.from.col &&
						a.to.row === action.to.row &&
						a.to.col === action.to.col
				)
			).toBe(true);
			const result = kernel.stepSync(state, action);
			expect(result.events[0]?.type).toBe("actionApplied");
			state = result.nextState;
		}

		expect(state.status).toBe("won");
		expect(state.winner).toBe("X");
		expect(getCell(state.grid, { row: 0, col: 2 })).toBe("X");

		const replay = replayActions(
			compileConfig(cfg).gameConfig,
			script,
			cfg.rng.seed
		);
		expect(replay.faithful).toBe(true);
		expect(replay.finalState.status).toBe("won");
		expect(replay.finalState.winner).toBe("X");
	});

	it("accepts king adjacency and sliding range in schema", () => {
		const base = examplePresets["step-race"].config;
		const king = zConfig.safeParse({
			...base,
			movement: { adjacency: "king", range: 1 }
		});
		expect(king.success).toBe(true);

		const slide = zConfig.safeParse({
			...base,
			movement: { adjacency: "orthogonal", range: 4 }
		});
		expect(slide.success).toBe(true);

		const badRange = zConfig.safeParse({
			...base,
			movement: { adjacency: "diagonal", range: 9 }
		});
		expect(badRange.success).toBe(false);
	});
});

describe("Slide Race (movement.range > 1)", () => {
	const SLIDE: MovementConfig = { adjacency: "orthogonal", range: 4 };

	it("lists multi-cell empty ray destinations and stops at blockers", () => {
		const { gameConfig } = compileConfig(examplePresets["slide-race"].config);
		const state = createInitialState(gameConfig);
		const from = { row: 4, col: 2 };
		const dests = legalDestinations(state.grid, from, SLIDE);
		// North: (3,2),(2,2),(1,2) — blocked by O at (0,2); also west/east.
		expect(dests).toEqual(
			expect.arrayContaining([
				{ row: 3, col: 2 },
				{ row: 2, col: 2 },
				{ row: 1, col: 2 },
				{ row: 4, col: 1 },
				{ row: 4, col: 0 },
				{ row: 4, col: 3 },
				{ row: 4, col: 4 }
			])
		);
		expect(dests).toHaveLength(7);
		expect(canMove(state.grid, from, { row: 1, col: 2 }, "X", SLIDE)).toBe(
			true
		);
		expect(canMove(state.grid, from, { row: 0, col: 2 }, "X", SLIDE)).toBe(
			false
		);
	});

	it("validates and compiles the slide-race preset", () => {
		const cfg = examplePresets["slide-race"].config;
		expect(validateConfig(cfg).ok).toBe(true);
		const { kernel, gameConfig } = compileConfig(cfg);
		expect(gameConfig.inputMode).toBe("move");
		expect(gameConfig.movement?.range).toBe(4);
		expect(gameConfig.objectiveMode).toBe("reach_row");
		const state = kernel.initialState(cfg.rng.seed);
		const legal = kernel.legalActions(state, 0);
		expect(legal.every((a) => a.type === "move")).toBe(true);
		expect(
			legal.some(
				(a) =>
					a.type === "move" && a.to.row === 1 && a.to.col === 2
			)
		).toBe(true);
		expect(
			legal.some(
				(a) =>
					a.type === "move" && a.to.row === 0 && a.to.col === 2
			)
		).toBe(false);
	});

	it("rejects jumping over an occupied cell", () => {
		const { kernel } = compileConfig(examplePresets["slide-race"].config);
		const state = kernel.initialState();
		const jump: KernelAction = {
			type: "move",
			from: { row: 4, col: 2 },
			to: { row: 0, col: 2 }
		};
		const ignored = kernel.stepSync(state, jump);
		expect(ignored.events[0]?.type).toBe("ignored");
		expect(ignored.nextState).toBe(state);
	});

	it("X wins by sliding north then finishing after O steps aside", () => {
		const cfg = examplePresets["slide-race"].config;
		const { kernel } = compileConfig(cfg);
		// X slides (4,2)→(1,2); O steps aside; X slides (1,2)→(0,2) and wins.
		const script: Extract<KernelAction, { type: "move" }>[] = [
			{ type: "move", from: { row: 4, col: 2 }, to: { row: 1, col: 2 } },
			{ type: "move", from: { row: 0, col: 2 }, to: { row: 0, col: 1 } },
			{ type: "move", from: { row: 1, col: 2 }, to: { row: 0, col: 2 } }
		];

		let state = kernel.initialState(cfg.rng.seed);
		for (const action of script) {
			const player = playerIdOf(state.currentPlayer);
			expect(
				kernel.legalActions(state, player).some(
					(a) =>
						a.type === "move" &&
						a.from.row === action.from.row &&
						a.from.col === action.from.col &&
						a.to.row === action.to.row &&
						a.to.col === action.to.col
				)
			).toBe(true);
			const result = kernel.stepSync(state, action);
			expect(result.events[0]?.type).toBe("actionApplied");
			state = result.nextState;
		}
		expect(state.status).toBe("won");
		expect(state.winner).toBe("X");
		expect(getCell(state.grid, { row: 0, col: 2 })).toBe("X");

		const replay = replayActions(
			compileConfig(cfg).gameConfig,
			script,
			cfg.rng.seed
		);
		expect(replay.faithful).toBe(true);
		expect(replay.finalState.status).toBe("won");
		expect(replay.finalState.winner).toBe("X");
	});

	it("accepts sliding range on graph move configs", () => {
		const ok = zConfig.safeParse({
			...examplePresets["simultaneous-graph-step-race"].config,
			movement: { adjacency: "orthogonal" as const, range: 3 }
		});
		expect(ok.success).toBe(true);
	});
});

describe("Graph Slide Race (movement.range > 1 on graph)", () => {
	const GRAPH_SLIDE: MovementConfig = { adjacency: "orthogonal", range: 4 };

	it("accepts graph move configs with sliding range", () => {
		const ok = zConfig.safeParse({
			...examplePresets["simultaneous-graph-step-race"].config,
			turn: { mode: "turn" },
			movement: { adjacency: "orthogonal" as const, range: 4 }
		});
		expect(ok.success).toBe(true);
	});

	it("range 1 matches empty-neighbor destinations", () => {
		const { gameConfig } = compileConfig(
			examplePresets["graph-slide-race"].config
		);
		const board = {
			topology: "graph" as const,
			graph: gameConfig.graph,
			wrap: false
		};
		const state = createInitialState(gameConfig);
		const from = { row: 4, col: 0 };
		const step1: MovementConfig = { adjacency: "orthogonal", range: 1 };
		expect(legalDestinations(state.grid, from, step1, board)).toEqual([
			{ row: 3, col: 0 }
		]);
	});

	it("lists multi-cell chain destinations and stops at blockers", () => {
		const { gameConfig } = compileConfig(
			examplePresets["graph-slide-race"].config
		);
		const board = {
			topology: "graph" as const,
			graph: gameConfig.graph,
			wrap: false
		};
		const state = createInitialState(gameConfig);
		const from = { row: 4, col: 0 };
		const dests = legalDestinations(state.grid, from, GRAPH_SLIDE, board);
		// X's lane: (4,0)→(3,0)→(2,0)→(1,0)→(0,0); O is on the other lane.
		expect(dests).toEqual(
			expect.arrayContaining([
				{ row: 3, col: 0 },
				{ row: 2, col: 0 },
				{ row: 1, col: 0 },
				{ row: 0, col: 0 }
			])
		);
		expect(dests).toHaveLength(4);
		expect(
			canMove(state.grid, from, { row: 0, col: 0 }, "X", GRAPH_SLIDE, board)
		).toBe(true);
		// Cross-lane jump has no edge — illegal.
		expect(
			canMove(state.grid, from, { row: 0, col: 1 }, "X", GRAPH_SLIDE, board)
		).toBe(false);
		expect(
			canMove(state.grid, from, { row: 3, col: 1 }, "X", GRAPH_SLIDE, board)
		).toBe(false);

		// Mid-chain blocker: occupy (2,0) → (1,0)/(0,0) unreachable.
		const blockedCells = state.grid.cells.slice();
		const idx = 2 * state.grid.width + 0;
		blockedCells[idx] = "O";
		const blockedGrid = { ...state.grid, cells: blockedCells };
		const blockedDests = legalDestinations(
			blockedGrid,
			from,
			GRAPH_SLIDE,
			board
		);
		expect(blockedDests).toEqual([{ row: 3, col: 0 }]);
		expect(
			blockedDests.some((p) => p.row === 2 && p.col === 0)
		).toBe(false);
		expect(
			blockedDests.some((p) => p.row === 0 && p.col === 0)
		).toBe(false);
	});

	it("stops at junctions (no turning mid-slide)", () => {
		// Hub graph: (0,1)—(1,1)—{(2,0),(2,2)}. Slide from (0,1) reaches hub
		// but cannot continue to either spoke (two forward edges).
		const hubConfig = {
			...examplePresets["graph-slide-race"].config,
			grid: {
				width: 3,
				height: 3,
				topology: "graph" as const,
				wrap: false,
				nodes: [
					{ row: 0, col: 1, x: 1, y: 0 },
					{ row: 1, col: 1, x: 1, y: 1 },
					{ row: 2, col: 0, x: 0, y: 2 },
					{ row: 2, col: 2, x: 2, y: 2 }
				],
				edges: [
					["0,1", "1,1"],
					["1,1", "2,0"],
					["1,1", "2,2"]
				] as [string, string][]
			},
			movement: {
				adjacency: "orthogonal" as const,
				range: 4,
				capture: "none" as const
			},
			objective: {
				mode: "reach_row" as const,
				targetRows: { X: 2, O: 0 }
			},
			initial: [
				{ row: 0, col: 1, player: "X" as const, visibility: "public" as const },
				{ row: 2, col: 0, player: "O" as const, visibility: "public" as const }
			]
		};
		const { gameConfig } = compileConfig(hubConfig);
		const board = {
			topology: "graph" as const,
			graph: gameConfig.graph,
			wrap: false
		};
		const state = createInitialState(gameConfig);
		const dests = legalDestinations(
			state.grid,
			{ row: 0, col: 1 },
			GRAPH_SLIDE,
			board
		);
		expect(dests).toEqual([{ row: 1, col: 1 }]);
		expect(
			canMove(
				state.grid,
				{ row: 0, col: 1 },
				{ row: 2, col: 2 },
				"X",
				GRAPH_SLIDE,
				board
			)
		).toBe(false);
	});

	it("validates and compiles the graph-slide-race preset", () => {
		const cfg = examplePresets["graph-slide-race"].config;
		expect(validateConfig(cfg).ok).toBe(true);
		const { kernel, gameConfig } = compileConfig(cfg);
		expect(gameConfig.topology).toBe("graph");
		expect(gameConfig.inputMode).toBe("move");
		expect(gameConfig.movement?.range).toBe(4);
		expect(gameConfig.objectiveMode).toBe("reach_row");
		const state = kernel.initialState(cfg.rng.seed);
		const legal = kernel.legalActions(state, 0);
		expect(legal.every((a) => a.type === "move")).toBe(true);
		expect(
			legal.some(
				(a) =>
					a.type === "move" && a.to.row === 0 && a.to.col === 0
			)
		).toBe(true);
		expect(
			legal.some(
				(a) =>
					a.type === "move" && a.to.row === 0 && a.to.col === 1
			)
		).toBe(false);
	});

	it("X wins by chain-walking to the target row", () => {
		const cfg = examplePresets["graph-slide-race"].config;
		const { kernel } = compileConfig(cfg);
		// One range-4 chain slide reaches row 0 — impossible under range 1.
		const script: Extract<KernelAction, { type: "move" }>[] = [
			{ type: "move", from: { row: 4, col: 0 }, to: { row: 0, col: 0 } }
		];

		let state = kernel.initialState(cfg.rng.seed);
		for (const action of script) {
			const player = playerIdOf(state.currentPlayer);
			expect(
				kernel.legalActions(state, player).some(
					(a) =>
						a.type === "move" &&
						a.from.row === action.from.row &&
						a.from.col === action.from.col &&
						a.to.row === action.to.row &&
						a.to.col === action.to.col
				)
			).toBe(true);
			const result = kernel.stepSync(state, action);
			expect(result.events[0]?.type).toBe("actionApplied");
			state = result.nextState;
		}
		expect(state.status).toBe("won");
		expect(state.winner).toBe("X");
		expect(getCell(state.grid, { row: 0, col: 0 })).toBe("X");

		const replay = replayActions(
			compileConfig(cfg).gameConfig,
			script,
			cfg.rng.seed
		);
		expect(replay.faithful).toBe(true);
		expect(replay.finalState.status).toBe("won");
		expect(replay.finalState.winner).toBe("X");
	});
});

describe("Hex Slide Race (movement.range > 1 on hex_offset)", () => {
	const HEX_SLIDE: MovementConfig = { adjacency: "orthogonal", range: 4 };
	const HEX_BOARD = { topology: "hex_offset" as const, wrap: false };

	it("accepts hex move configs with sliding range", () => {
		const ok = zConfig.safeParse({
			...examplePresets["hex-step-race"].config,
			movement: { adjacency: "orthogonal" as const, range: 4 }
		});
		expect(ok.success).toBe(true);
	});

	it("lists multi-cell cube-axis destinations and stops at blockers", () => {
		const { gameConfig } = compileConfig(
			examplePresets["hex-slide-race"].config
		);
		const state = createInitialState(gameConfig);
		const from = { row: 4, col: 2 };
		const dests = legalDestinations(state.grid, from, HEX_SLIDE, HEX_BOARD);
		// Cube-axis rays from (4,2): NE→(0,4), NW→(0,0), E/W along row 4.
		// O at (0,2) is off-ray (not a cube-axis neighbor chain).
		expect(dests).toEqual(
			expect.arrayContaining([
				{ row: 3, col: 2 },
				{ row: 2, col: 3 },
				{ row: 1, col: 3 },
				{ row: 0, col: 4 },
				{ row: 3, col: 1 },
				{ row: 2, col: 1 },
				{ row: 1, col: 0 },
				{ row: 0, col: 0 },
				{ row: 4, col: 3 },
				{ row: 4, col: 4 },
				{ row: 4, col: 1 },
				{ row: 4, col: 0 }
			])
		);
		expect(dests).toHaveLength(12);
		expect(
			canMove(state.grid, from, { row: 0, col: 0 }, "X", HEX_SLIDE, HEX_BOARD)
		).toBe(true);
		expect(
			canMove(state.grid, from, { row: 0, col: 4 }, "X", HEX_SLIDE, HEX_BOARD)
		).toBe(true);
		// Same offset column is not a cube-axis ray — cannot jump to O.
		expect(
			canMove(state.grid, from, { row: 0, col: 2 }, "X", HEX_SLIDE, HEX_BOARD)
		).toBe(false);

		// Mid-ray blocker on NW path: occupy (2,1) → (1,0)/(0,0) unreachable.
		const blockedCells = state.grid.cells.slice();
		const idx = 2 * state.grid.width + 1;
		blockedCells[idx] = "O";
		const blockedGrid = { ...state.grid, cells: blockedCells };
		const blockedDests = legalDestinations(
			blockedGrid,
			from,
			HEX_SLIDE,
			HEX_BOARD
		);
		expect(blockedDests).toEqual(
			expect.arrayContaining([
				{ row: 3, col: 1 },
				{ row: 0, col: 4 }
			])
		);
		expect(
			blockedDests.some((p) => p.row === 1 && p.col === 0)
		).toBe(false);
		expect(
			blockedDests.some((p) => p.row === 0 && p.col === 0)
		).toBe(false);
		expect(
			blockedDests.some((p) => p.row === 2 && p.col === 1)
		).toBe(false);
	});

	it("validates and compiles the hex-slide-race preset", () => {
		const cfg = examplePresets["hex-slide-race"].config;
		expect(validateConfig(cfg).ok).toBe(true);
		const { kernel, gameConfig } = compileConfig(cfg);
		expect(gameConfig.topology).toBe("hex_offset");
		expect(gameConfig.inputMode).toBe("move");
		expect(gameConfig.movement?.range).toBe(4);
		expect(gameConfig.objectiveMode).toBe("reach_row");
		const state = kernel.initialState(cfg.rng.seed);
		const legal = kernel.legalActions(state, 0);
		expect(legal.every((a) => a.type === "move")).toBe(true);
		expect(
			legal.some(
				(a) =>
					a.type === "move" && a.to.row === 0 && a.to.col === 0
			)
		).toBe(true);
		expect(
			legal.some(
				(a) =>
					a.type === "move" && a.to.row === 0 && a.to.col === 2
			)
		).toBe(false);
	});

	it("X wins by sliding along a cube axis to the target row", () => {
		const cfg = examplePresets["hex-slide-race"].config;
		const { kernel } = compileConfig(cfg);
		// One range-4 cube-axis slide reaches row 0 — impossible under range 1.
		const script: Extract<KernelAction, { type: "move" }>[] = [
			{ type: "move", from: { row: 4, col: 2 }, to: { row: 0, col: 0 } }
		];

		let state = kernel.initialState(cfg.rng.seed);
		for (const action of script) {
			const player = playerIdOf(state.currentPlayer);
			expect(
				kernel.legalActions(state, player).some(
					(a) =>
						a.type === "move" &&
						a.from.row === action.from.row &&
						a.from.col === action.from.col &&
						a.to.row === action.to.row &&
						a.to.col === action.to.col
				)
			).toBe(true);
			const result = kernel.stepSync(state, action);
			expect(result.events[0]?.type).toBe("actionApplied");
			state = result.nextState;
		}
		expect(state.status).toBe("won");
		expect(state.winner).toBe("X");
		expect(getCell(state.grid, { row: 0, col: 0 })).toBe("X");

		const replay = replayActions(
			compileConfig(cfg).gameConfig,
			script,
			cfg.rng.seed
		);
		expect(replay.faithful).toBe(true);
		expect(replay.finalState.status).toBe("won");
		expect(replay.finalState.winner).toBe("X");
	});
});

describe("Hex Step Race (topology-aware movement)", () => {
	it("validates hex-step-race and lists hex neighbor destinations", () => {
		const cfg = examplePresets["hex-step-race"].config;
		expect(validateConfig(cfg).ok).toBe(true);
		const { kernel, gameConfig } = compileConfig(cfg);
		expect(gameConfig.topology).toBe("hex_offset");
		expect(gameConfig.inputMode).toBe("move");
		const state = kernel.initialState();
		const legal = kernel.legalActions(state, 0);
		expect(legal.every((a) => a.type === "move")).toBe(true);
		expect(legal.some((a) => a.type === "move" && a.to.row === 3)).toBe(
			true
		);
	});

	it("rejects diagonal adjacency on hex move configs", () => {
		const bad = zConfig.safeParse({
			...examplePresets["hex-step-race"].config,
			movement: { adjacency: "diagonal" as const, range: 1 as const }
		});
		expect(bad.success).toBe(false);
	});
});
