import { describe, expect, it } from "vitest";
import { compileConfig } from "@/compiler";
import {
	canMove,
	legalDestinations,
	type MovementConfig
} from "@/engine/movement";
import { playerIdOf, type KernelAction } from "@/engine/kernel";
import { createInitialState } from "@/engine/reducer";
import { getCell, setCell } from "@/engine/types";
import { examplePresets } from "@/presets/registry";
import { validateConfig } from "@/engine/validateConfig";
import { replayActions } from "@/ir/gameIr";
import { zConfig } from "@/schemas/config";

const REPLACE: MovementConfig = {
	adjacency: "orthogonal",
	range: 1,
	capture: "replace"
};

const SLIDE_REPLACE: MovementConfig = {
	adjacency: "orthogonal",
	range: 4,
	capture: "replace"
};

describe("capture-by-replacement helpers", () => {
	it("lists enemy adjacent cells as legal destinations under replace", () => {
		const { gameConfig } = compileConfig(
			examplePresets["replace-race"].config
		);
		const state = createInitialState(gameConfig);
		const from = { row: 1, col: 2 };
		expect(getCell(state.grid, from)).toBe("X");
		expect(getCell(state.grid, { row: 0, col: 2 })).toBe("O");
		const dests = legalDestinations(state.grid, from, REPLACE);
		expect(dests).toEqual(
			expect.arrayContaining([
				{ row: 0, col: 2 },
				{ row: 1, col: 1 },
				{ row: 1, col: 3 },
				{ row: 2, col: 2 }
			])
		);
		expect(
			canMove(state.grid, from, { row: 0, col: 2 }, "X", REPLACE)
		).toBe(true);
	});

	it("rejects own-piece destinations even with replace", () => {
		const { gameConfig } = compileConfig(
			examplePresets["replace-race"].config
		);
		const state = createInitialState(gameConfig);
		const grid = {
			...state.grid,
			cells: setCell(state.grid, { row: 1, col: 1 }, "X")
		};
		expect(
			canMove(grid, { row: 1, col: 2 }, { row: 1, col: 1 }, "X", REPLACE)
		).toBe(false);
	});

	it("sliding replace lands on first enemy; path must stay empty", () => {
		const base = examplePresets["slide-race"].config;
		const cfg = {
			...base,
			movement: {
				adjacency: "orthogonal" as const,
				range: 4 as const,
				capture: "replace" as const
			}
		};
		const { gameConfig } = compileConfig(cfg);
		const state = createInitialState(gameConfig);
		const from = { row: 4, col: 2 };
		// O at (0,2): empty path (3,2)(2,2)(1,2) then enemy landing.
		expect(
			canMove(state.grid, from, { row: 0, col: 2 }, "X", SLIDE_REPLACE)
		).toBe(true);
		expect(
			legalDestinations(state.grid, from, SLIDE_REPLACE).some(
				(p) => p.row === 0 && p.col === 2
			)
		).toBe(true);

		// Blocker at (2,2) stops the ray before O — cannot jump.
		const blocked = {
			...state.grid,
			cells: setCell(state.grid, { row: 2, col: 2 }, "O")
		};
		expect(
			canMove(blocked, from, { row: 0, col: 2 }, "X", SLIDE_REPLACE)
		).toBe(false);
		expect(
			canMove(blocked, from, { row: 2, col: 2 }, "X", SLIDE_REPLACE)
		).toBe(true);
	});
});

describe("Replace Race (movement.capture = replace)", () => {
	it("validates and compiles the replace-race preset", () => {
		const cfg = examplePresets["replace-race"].config;
		expect(validateConfig(cfg).ok).toBe(true);
		const { kernel, gameConfig } = compileConfig(cfg);
		expect(gameConfig.inputMode).toBe("move");
		expect(gameConfig.movement?.capture).toBe("replace");
		expect(gameConfig.objectiveMode).toBe("reach_row");
		const state = kernel.initialState(cfg.rng.seed);
		expect(getCell(state.grid, { row: 1, col: 2 })).toBe("X");
		expect(getCell(state.grid, { row: 0, col: 2 })).toBe("O");
		const legal = kernel.legalActions(state, 0);
		expect(
			legal.some(
				(a) =>
					a.type === "move" &&
					a.from.row === 1 &&
					a.from.col === 2 &&
					a.to.row === 0 &&
					a.to.col === 2
			)
		).toBe(true);
	});

	it("X captures O on target row and wins (transcript + pieceCaptured)", () => {
		const cfg = examplePresets["replace-race"].config;
		const { kernel } = compileConfig(cfg);
		const action: Extract<KernelAction, { type: "move" }> = {
			type: "move",
			from: { row: 1, col: 2 },
			to: { row: 0, col: 2 }
		};
		let state = kernel.initialState(cfg.rng.seed);
		expect(
			kernel.legalActions(state, playerIdOf(state.currentPlayer)).some(
				(a) =>
					a.type === "move" &&
					a.to.row === 0 &&
					a.to.col === 2
			)
		).toBe(true);
		const result = kernel.stepSync(state, action);
		expect(result.events.some((e) => e.type === "actionApplied")).toBe(
			true
		);
		expect(
			result.events.some(
				(e) =>
					e.type === "pieceCaptured" &&
					e.position.row === 0 &&
					e.position.col === 2 &&
					e.captured === "O" &&
					e.by === "X"
			)
		).toBe(true);
		expect(result.events.some((e) => e.type === "terminal")).toBe(true);
		state = result.nextState;
		expect(getCell(state.grid, { row: 0, col: 2 })).toBe("X");
		expect(getCell(state.grid, { row: 1, col: 2 })).toBeNull();
		expect(state.status).toBe("won");
		expect(state.winner).toBe("X");
	});

	it("replays the capture win faithfully", () => {
		const cfg = examplePresets["replace-race"].config;
		const { gameConfig } = compileConfig(cfg);
		const actions: KernelAction[] = [
			{ type: "move", from: { row: 1, col: 2 }, to: { row: 0, col: 2 } }
		];
		const replay = replayActions(gameConfig, actions, cfg.rng.seed);
		expect(replay.finalState.status).toBe("won");
		expect(replay.finalState.winner).toBe("X");
		expect(getCell(replay.finalState.grid, { row: 0, col: 2 })).toBe("X");
	});

	it("without replace, occupied destinations stay illegal", () => {
		const { gameConfig } = compileConfig(
			examplePresets["replace-race"].config
		);
		const state = createInitialState(gameConfig);
		const none: MovementConfig = {
			adjacency: "orthogonal",
			range: 1,
			capture: "none"
		};
		expect(
			canMove(
				state.grid,
				{ row: 1, col: 2 },
				{ row: 0, col: 2 },
				"X",
				none
			)
		).toBe(false);
	});
});

describe("movement.capture schema / validateConfig", () => {
	it("accepts capture none|replace on rectangle move configs", () => {
		const base = examplePresets["step-race"].config;
		expect(
			zConfig.safeParse({
				...base,
				movement: { adjacency: "orthogonal", range: 1, capture: "none" }
			}).success
		).toBe(true);
		expect(
			zConfig.safeParse({
				...base,
				movement: {
					adjacency: "orthogonal",
					range: 1,
					capture: "replace"
				}
			}).success
		).toBe(true);
	});

	it("rejects replace without move input", () => {
		const base = examplePresets["tic-tac-toe"].config;
		const bad = zConfig.safeParse({
			...base,
			movement: {
				adjacency: "orthogonal",
				range: 1,
				capture: "replace"
			}
		});
		expect(bad.success).toBe(false);
	});

	it("rejects replace on hex topology", () => {
		const bad = zConfig.safeParse({
			...examplePresets["hex-step-race"].config,
			movement: {
				adjacency: "orthogonal",
				range: 1,
				capture: "replace"
			}
		});
		expect(bad.success).toBe(false);
	});

	it("rejects replace with placement.capture", () => {
		const base = examplePresets["replace-race"].config;
		const bad = {
			...base,
			placement: {
				...base.placement,
				capture: { enabled: true, mode: "flip" as const }
			}
		};
		const result = validateConfig(bad);
		expect(result.ok).toBe(false);
		expect(
			result.errors.some((e) => e.toLowerCase().includes("capture"))
		).toBe(true);
	});

	it("rejects replace under simultaneous move", () => {
		const base = examplePresets["simultaneous-step-race"].config;
		const bad = {
			...base,
			movement: {
				...base.movement!,
				capture: "replace" as const
			}
		};
		const result = validateConfig(bad);
		expect(result.ok).toBe(false);
		expect(
			result.errors.some((e) => e.toLowerCase().includes("replace"))
		).toBe(true);
	});
});
