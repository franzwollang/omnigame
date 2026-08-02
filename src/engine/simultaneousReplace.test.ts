import { describe, expect, it } from "vitest";
import { compileConfig } from "@/compiler";
import { zConfig } from "@/schemas/config";
import { examplePresets } from "@/presets/registry";
import { getCell } from "@/engine/types";
import { canJointSimultaneousMoves } from "@/engine/movement";
import { type KernelAction } from "@/engine/kernel";
import { replayActions } from "@/ir/gameIr";
import { validateConfig } from "@/engine/validateConfig";

const REPLACE = {
	adjacency: "orthogonal" as const,
	range: 1,
	capture: "replace" as const
};

const NONE = {
	adjacency: "orthogonal" as const,
	range: 1,
	capture: "none" as const
};

describe("schema: simultaneous × replace", () => {
	it("accepts simultaneous-replace-race (joint + range 1 + replace)", () => {
		const cfg = examplePresets["simultaneous-replace-race"].config;
		expect(zConfig.safeParse(cfg).success).toBe(true);
		expect(validateConfig(cfg).ok).toBe(true);
	});

	it("rejects simultaneous replace with range > 1", () => {
		const base = examplePresets["simultaneous-replace-race"].config;
		const bad = {
			...base,
			movement: { ...base.movement!, range: 4 as const }
		};
		expect(zConfig.safeParse(bad).success).toBe(false);
	});

	it("rejects ordered simultaneous + replace", () => {
		const base = examplePresets["simultaneous-replace-race"].config;
		const bad = {
			...base,
			turn: {
				...base.turn,
				resolveOrder: "x_first" as const
			}
		};
		expect(zConfig.safeParse(bad).success).toBe(false);
	});

	it("still rejects simultaneous-slide + replace", () => {
		const base = examplePresets["simultaneous-slide-race"].config;
		const bad = {
			...base,
			movement: { ...base.movement!, capture: "replace" as const }
		};
		expect(zConfig.safeParse(bad).success).toBe(false);
	});
});

describe("canJointSimultaneousMoves replace real-board legality", () => {
	it("allows capture of a stationary enemy while the opponent moves another piece", () => {
		const { kernel } = compileConfig(
			examplePresets["simultaneous-replace-race"].config
		);
		const state = kernel.initialState(42);
		const moves = {
			X: { from: { row: 1, col: 2 }, to: { row: 0, col: 2 } },
			O: { from: { row: 0, col: 0 }, to: { row: 1, col: 0 } }
		};
		expect(canJointSimultaneousMoves(state.grid, moves, REPLACE)).toBe(
			true
		);
		// Without replace, occupied destination stays illegal on the real board.
		expect(canJointSimultaneousMoves(state.grid, moves, NONE)).toBe(false);
	});

	it("rejects capturing own piece", () => {
		// Place a second X next to the hunter so "own piece" is a possible dest.
		const cfg = {
			...examplePresets["simultaneous-replace-race"].config,
			initial: [
				{ row: 1, col: 2, player: "X" as const, visibility: "public" as const },
				{ row: 1, col: 1, player: "X" as const, visibility: "public" as const },
				{ row: 0, col: 2, player: "O" as const, visibility: "public" as const },
				{ row: 0, col: 0, player: "O" as const, visibility: "public" as const }
			]
		};
		const { kernel: k2 } = compileConfig(cfg);
		const s2 = k2.initialState(42);
		const moves = {
			X: { from: { row: 1, col: 2 }, to: { row: 1, col: 1 } },
			O: { from: { row: 0, col: 0 }, to: { row: 1, col: 0 } }
		};
		expect(canJointSimultaneousMoves(s2.grid, moves, REPLACE)).toBe(false);
	});
});

describe("Simultaneous Replace Race", () => {
	it("compiles and lists the capture joint as legal for X", () => {
		const cfg = examplePresets["simultaneous-replace-race"].config;
		const { kernel, gameConfig } = compileConfig(cfg);
		expect(gameConfig.movement?.capture).toBe("replace");
		expect(gameConfig.turnSchedule).toBe("simultaneous");
		const state = kernel.initialState(cfg.rng.seed);
		expect(getCell(state.grid, { row: 1, col: 2 })).toBe("X");
		expect(getCell(state.grid, { row: 0, col: 2 })).toBe("O");
		expect(getCell(state.grid, { row: 0, col: 0 })).toBe("O");
	});

	it("X captures stationary O on target row and wins (transcript + pieceCaptured)", () => {
		const cfg = examplePresets["simultaneous-replace-race"].config;
		const { kernel } = compileConfig(cfg);
		const action: Extract<KernelAction, { type: "simultaneousMove" }> = {
			type: "simultaneousMove",
			moves: {
				X: { from: { row: 1, col: 2 }, to: { row: 0, col: 2 } },
				O: { from: { row: 0, col: 0 }, to: { row: 1, col: 0 } }
			}
		};
		let state = kernel.initialState(cfg.rng.seed);
		expect(kernel.explainAction(state, 0, action).legal).toBe(true);
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
		expect(getCell(state.grid, { row: 0, col: 0 })).toBeNull();
		expect(getCell(state.grid, { row: 1, col: 0 })).toBe("O");
		expect(state.status).toBe("won");
		expect(state.winner).toBe("X");
	});

	it("does not emit pieceCaptured when the target flees the landing cell", () => {
		const cfg = {
			...examplePresets["simultaneous-step-race"].config,
			movement: {
				adjacency: "orthogonal" as const,
				range: 1 as const,
				capture: "replace" as const
			},
			initial: [
				{ row: 1, col: 2, player: "X" as const, visibility: "public" as const },
				{ row: 0, col: 2, player: "O" as const, visibility: "public" as const }
			]
		};
		const { kernel } = compileConfig(cfg);
		const action: Extract<KernelAction, { type: "simultaneousMove" }> = {
			type: "simultaneousMove",
			moves: {
				X: { from: { row: 1, col: 2 }, to: { row: 0, col: 2 } },
				O: { from: { row: 0, col: 2 }, to: { row: 0, col: 1 } }
			}
		};
		const state = kernel.initialState(cfg.rng.seed);
		expect(kernel.explainAction(state, 0, action).legal).toBe(true);
		const result = kernel.stepSync(state, action);
		expect(result.events.some((e) => e.type === "pieceCaptured")).toBe(
			false
		);
		expect(getCell(result.nextState.grid, { row: 0, col: 2 })).toBe("X");
		expect(getCell(result.nextState.grid, { row: 0, col: 1 })).toBe("O");
		expect(result.nextState.status).toBe("won");
		expect(result.nextState.winner).toBe("X");
	});

	it("replays the stationary capture win faithfully", () => {
		const cfg = examplePresets["simultaneous-replace-race"].config;
		const { gameConfig } = compileConfig(cfg);
		const actions: KernelAction[] = [
			{
				type: "simultaneousMove",
				moves: {
					X: { from: { row: 1, col: 2 }, to: { row: 0, col: 2 } },
					O: { from: { row: 0, col: 0 }, to: { row: 1, col: 0 } }
				}
			}
		];
		const replay = replayActions(gameConfig, actions, cfg.rng.seed);
		expect(replay.finalState.status).toBe("won");
		expect(replay.finalState.winner).toBe("X");
		expect(getCell(replay.finalState.grid, { row: 0, col: 2 })).toBe("X");
		expect(getCell(replay.finalState.grid, { row: 1, col: 0 })).toBe("O");
	});

	it("same-destination joint conflict still moves neither", () => {
		const cfg = {
			...examplePresets["simultaneous-replace-race"].config,
			initial: [
				{ row: 1, col: 2, player: "X" as const, visibility: "public" as const },
				{ row: 0, col: 2, player: "O" as const, visibility: "public" as const },
				{ row: 1, col: 0, player: "O" as const, visibility: "public" as const }
			]
		};
		const { kernel } = compileConfig(cfg);
		const action: Extract<KernelAction, { type: "simultaneousMove" }> = {
			type: "simultaneousMove",
			moves: {
				X: { from: { row: 1, col: 2 }, to: { row: 1, col: 1 } },
				O: { from: { row: 1, col: 0 }, to: { row: 1, col: 1 } }
			}
		};
		const state = kernel.initialState(cfg.rng.seed);
		expect(kernel.explainAction(state, 0, action).legal).toBe(true);
		const result = kernel.stepSync(state, action);
		expect(getCell(result.nextState.grid, { row: 1, col: 2 })).toBe("X");
		expect(getCell(result.nextState.grid, { row: 1, col: 0 })).toBe("O");
		expect(getCell(result.nextState.grid, { row: 1, col: 1 })).toBeNull();
		expect(result.nextState.status).toBe("playing");
	});
});
