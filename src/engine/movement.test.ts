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

	it("accepts king adjacency in schema and rejects range > 1", () => {
		const base = examplePresets["step-race"].config;
		const king = zConfig.safeParse({
			...base,
			movement: { adjacency: "king", range: 1 }
		});
		expect(king.success).toBe(true);

		const badRange = zConfig.safeParse({
			...base,
			movement: { adjacency: "diagonal", range: 2 }
		});
		expect(badRange.success).toBe(false);
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
