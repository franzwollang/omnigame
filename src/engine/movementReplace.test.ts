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

describe("Hex Replace Race (movement.capture = replace on hex_offset)", () => {
	const HEX_BOARD = { topology: "hex_offset" as const };

	it("validates and compiles the hex-replace-race preset", () => {
		const cfg = examplePresets["hex-replace-race"].config;
		expect(validateConfig(cfg).ok).toBe(true);
		const { kernel, gameConfig } = compileConfig(cfg);
		expect(gameConfig.topology).toBe("hex_offset");
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

	it("lists enemy hex neighbors as legal destinations under replace", () => {
		const { gameConfig } = compileConfig(
			examplePresets["hex-replace-race"].config
		);
		const state = createInitialState(gameConfig);
		const from = { row: 1, col: 2 };
		expect(
			canMove(state.grid, from, { row: 0, col: 2 }, "X", REPLACE, HEX_BOARD)
		).toBe(true);
		expect(
			legalDestinations(state.grid, from, REPLACE, HEX_BOARD).some(
				(p) => p.row === 0 && p.col === 2
			)
		).toBe(true);
	});

	it("X captures O on target row and wins (transcript + pieceCaptured)", () => {
		const cfg = examplePresets["hex-replace-race"].config;
		const { kernel } = compileConfig(cfg);
		const action: Extract<KernelAction, { type: "move" }> = {
			type: "move",
			from: { row: 1, col: 2 },
			to: { row: 0, col: 2 }
		};
		let state = kernel.initialState(cfg.rng.seed);
		const result = kernel.stepSync(state, action);
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

	it("replays the hex capture win faithfully", () => {
		const cfg = examplePresets["hex-replace-race"].config;
		const { gameConfig } = compileConfig(cfg);
		const actions: KernelAction[] = [
			{ type: "move", from: { row: 1, col: 2 }, to: { row: 0, col: 2 } }
		];
		const replay = replayActions(gameConfig, actions, cfg.rng.seed);
		expect(replay.finalState.status).toBe("won");
		expect(replay.finalState.winner).toBe("X");
		expect(getCell(replay.finalState.grid, { row: 0, col: 2 })).toBe("X");
	});

	it("sliding hex replace lands on first enemy along a cube-axis ray", () => {
		const base = examplePresets["hex-slide-race"].config;
		const cfg = {
			...base,
			movement: {
				adjacency: "orthogonal" as const,
				range: 4 as const,
				capture: "replace" as const
			},
			initial: [
				// NW cube-axis from (4,2): (3,1)(2,1)(1,0) then O at (0,0).
				{ row: 4, col: 2, player: "X" as const, visibility: "public" as const },
				{ row: 0, col: 0, player: "O" as const, visibility: "public" as const }
			]
		};
		expect(validateConfig(cfg).ok).toBe(true);
		const { gameConfig } = compileConfig(cfg);
		const state = createInitialState(gameConfig);
		const from = { row: 4, col: 2 };
		expect(
			canMove(
				state.grid,
				from,
				{ row: 0, col: 0 },
				"X",
				SLIDE_REPLACE,
				HEX_BOARD
			)
		).toBe(true);
		// Same offset column is not a cube-axis ray.
		expect(
			canMove(
				state.grid,
				from,
				{ row: 0, col: 2 },
				"X",
				SLIDE_REPLACE,
				HEX_BOARD
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

	it("accepts replace on hex topology", () => {
		const ok = zConfig.safeParse({
			...examplePresets["hex-step-race"].config,
			movement: {
				adjacency: "orthogonal",
				range: 1,
				capture: "replace"
			}
		});
		expect(ok.success).toBe(true);
	});

	it("rejects replace on graph topology", () => {
		const bad = zConfig.safeParse({
			...examplePresets["graph-slide-race"].config,
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

	it("accepts joint simultaneous replace at range 1", () => {
		const base = examplePresets["simultaneous-step-race"].config;
		const ok = {
			...base,
			movement: {
				...base.movement!,
				capture: "replace" as const
			}
		};
		expect(validateConfig(ok).ok).toBe(true);
	});

	it("accepts ordered simultaneous + replace at range 1", () => {
		const base = examplePresets["simultaneous-step-race"].config;
		const ok = {
			...base,
			turn: { ...base.turn, resolveOrder: "x_first" as const },
			movement: {
				...base.movement!,
				capture: "replace" as const
			}
		};
		expect(validateConfig(ok).ok).toBe(true);
	});
});
