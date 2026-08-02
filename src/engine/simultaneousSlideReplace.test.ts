import { describe, expect, it } from "vitest";
import { compileConfig } from "@/compiler";
import { zConfig } from "@/schemas/config";
import { examplePresets } from "@/presets/registry";
import { getCell } from "@/engine/types";
import {
	canJointSimultaneousMoves,
	canOrderedSimultaneousMoves
} from "@/engine/movement";
import { type KernelAction } from "@/engine/kernel";
import { replayActions } from "@/ir/gameIr";
import { validateConfig } from "@/engine/validateConfig";

const SLIDE_REPLACE = {
	adjacency: "orthogonal" as const,
	range: 4,
	capture: "replace" as const
};

const SLIDE_NONE = {
	adjacency: "orthogonal" as const,
	range: 4,
	capture: "none" as const
};

describe("schema: simultaneous × slide × replace", () => {
	it("accepts simultaneous-slide-replace-race (joint + range 4 + replace)", () => {
		const cfg = examplePresets["simultaneous-slide-replace-race"].config;
		expect(zConfig.safeParse(cfg).success).toBe(true);
		expect(validateConfig(cfg).ok).toBe(true);
	});

	it("accepts ordered-simultaneous-slide-replace-race", () => {
		const cfg =
			examplePresets["ordered-simultaneous-slide-replace-race"].config;
		expect(zConfig.safeParse(cfg).success).toBe(true);
		expect(validateConfig(cfg).ok).toBe(true);
	});

	it("accepts simultaneous slide + replace on simultaneous-slide-race base", () => {
		const base = examplePresets["simultaneous-slide-race"].config;
		const ok = {
			...base,
			movement: { ...base.movement!, capture: "replace" as const }
		};
		expect(zConfig.safeParse(ok).success).toBe(true);
		expect(validateConfig(ok).ok).toBe(true);
	});
});

describe("canJointSimultaneousMoves slide+replace real-board", () => {
	it("allows sliding onto a stationary enemy while the opponent moves a runner", () => {
		const { kernel } = compileConfig(
			examplePresets["simultaneous-slide-replace-race"].config
		);
		const state = kernel.initialState(42);
		const moves = {
			X: { from: { row: 4, col: 2 }, to: { row: 0, col: 2 } },
			O: { from: { row: 0, col: 0 }, to: { row: 1, col: 0 } }
		};
		expect(
			canJointSimultaneousMoves(state.grid, moves, SLIDE_REPLACE)
		).toBe(true);
		expect(canJointSimultaneousMoves(state.grid, moves, SLIDE_NONE)).toBe(
			false
		);
	});

	it("rejects a slide whose path is blocked on the pre-round board", () => {
		const cfg = {
			...examplePresets["simultaneous-slide-replace-race"].config,
			initial: [
				{
					row: 4,
					col: 2,
					player: "X" as const,
					visibility: "public" as const
				},
				{
					row: 0,
					col: 2,
					player: "O" as const,
					visibility: "public" as const
				},
				{
					row: 2,
					col: 2,
					player: "O" as const,
					visibility: "public" as const
				},
				{
					row: 0,
					col: 0,
					player: "O" as const,
					visibility: "public" as const
				}
			]
		};
		const { kernel } = compileConfig(cfg);
		const state = kernel.initialState(42);
		const moves = {
			X: { from: { row: 4, col: 2 }, to: { row: 0, col: 2 } },
			O: { from: { row: 0, col: 0 }, to: { row: 1, col: 0 } }
		};
		expect(
			canJointSimultaneousMoves(state.grid, moves, SLIDE_REPLACE)
		).toBe(false);
	});
});

describe("canOrderedSimultaneousMoves slide+replace", () => {
	it("x_first allows slide-capture of a fleeing piece (second noop)", () => {
		const { kernel } = compileConfig(
			examplePresets["ordered-simultaneous-slide-replace-race"].config
		);
		const state = kernel.initialState(42);
		const moves = {
			X: { from: { row: 4, col: 2 }, to: { row: 0, col: 2 } },
			O: { from: { row: 0, col: 2 }, to: { row: 0, col: 1 } }
		};
		expect(
			canOrderedSimultaneousMoves(
				state.grid,
				moves,
				SLIDE_REPLACE,
				"x_first"
			)
		).toBe(true);
		expect(
			canOrderedSimultaneousMoves(state.grid, moves, SLIDE_NONE, "x_first")
		).toBe(false);
	});

	it("o_first allows flee then slide onto vacated cell", () => {
		const { kernel } = compileConfig(
			examplePresets["ordered-simultaneous-slide-replace-race"].config
		);
		const state = kernel.initialState(42);
		const moves = {
			X: { from: { row: 4, col: 2 }, to: { row: 0, col: 2 } },
			O: { from: { row: 0, col: 2 }, to: { row: 0, col: 1 } }
		};
		expect(
			canOrderedSimultaneousMoves(
				state.grid,
				moves,
				SLIDE_REPLACE,
				"o_first"
			)
		).toBe(true);
	});
});

describe("Simultaneous Slide Replace Race", () => {
	it("compiles with joint resolve + slide replace", () => {
		const cfg = examplePresets["simultaneous-slide-replace-race"].config;
		const { kernel, gameConfig } = compileConfig(cfg);
		expect(gameConfig.movement?.capture).toBe("replace");
		expect(gameConfig.movement?.range).toBe(4);
		expect(gameConfig.turnSchedule).toBe("simultaneous");
		const state = kernel.initialState(cfg.rng.seed);
		expect(getCell(state.grid, { row: 4, col: 2 })).toBe("X");
		expect(getCell(state.grid, { row: 0, col: 2 })).toBe("O");
		expect(getCell(state.grid, { row: 0, col: 0 })).toBe("O");
	});

	it("joint slide capture emits pieceCaptured and X wins reach_row", () => {
		const cfg = examplePresets["simultaneous-slide-replace-race"].config;
		const { kernel } = compileConfig(cfg);
		const action: Extract<KernelAction, { type: "simultaneousMove" }> = {
			type: "simultaneousMove",
			moves: {
				X: { from: { row: 4, col: 2 }, to: { row: 0, col: 2 } },
				O: { from: { row: 0, col: 0 }, to: { row: 1, col: 0 } }
			}
		};
		let state = kernel.initialState(cfg.rng.seed);
		expect(kernel.explainAction(state, 0, action).legal).toBe(true);
		const result = kernel.stepSync(state, action);
		expect(
			result.events.some(
				(e) =>
					e.type === "pieceCaptured" &&
					e.captured === "O" &&
					e.by === "X" &&
					e.position.row === 0 &&
					e.position.col === 2
			)
		).toBe(true);
		expect(result.events.some((e) => e.type === "terminal")).toBe(true);
		state = result.nextState;
		expect(getCell(state.grid, { row: 0, col: 2 })).toBe("X");
		expect(getCell(state.grid, { row: 4, col: 2 })).toBeNull();
		expect(getCell(state.grid, { row: 1, col: 0 })).toBe("O");
		expect(state.status).toBe("won");
		expect(state.winner).toBe("X");
	});

	it("replays the capture transcript deterministically", () => {
		const cfg = examplePresets["simultaneous-slide-replace-race"].config;
		const { gameConfig } = compileConfig(cfg);
		const actions: KernelAction[] = [
			{
				type: "simultaneousMove",
				moves: {
					X: { from: { row: 4, col: 2 }, to: { row: 0, col: 2 } },
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
});

describe("Ordered Simultaneous Slide Replace Race", () => {
	it("compiles with ordered resolve + slide replace", () => {
		const cfg =
			examplePresets["ordered-simultaneous-slide-replace-race"].config;
		const { kernel, gameConfig } = compileConfig(cfg);
		expect(gameConfig.movement?.capture).toBe("replace");
		expect(gameConfig.movement?.range).toBe(4);
		expect(gameConfig.resolveOrder).toBe("x_first");
		const state = kernel.initialState(cfg.rng.seed);
		expect(getCell(state.grid, { row: 4, col: 2 })).toBe("X");
		expect(getCell(state.grid, { row: 0, col: 2 })).toBe("O");
	});

	it("x_first: X slide-captures before O flees (pieceCaptured + win)", () => {
		const cfg =
			examplePresets["ordered-simultaneous-slide-replace-race"].config;
		const { kernel } = compileConfig(cfg);
		const action: Extract<KernelAction, { type: "simultaneousMove" }> = {
			type: "simultaneousMove",
			moves: {
				X: { from: { row: 4, col: 2 }, to: { row: 0, col: 2 } },
				O: { from: { row: 0, col: 2 }, to: { row: 0, col: 1 } }
			}
		};
		let state = kernel.initialState(cfg.rng.seed);
		expect(kernel.explainAction(state, 0, action).legal).toBe(true);
		const result = kernel.stepSync(state, action);
		expect(
			result.events.some(
				(e) =>
					e.type === "pieceCaptured" && e.by === "X" && e.captured === "O"
			)
		).toBe(true);
		state = result.nextState;
		expect(getCell(state.grid, { row: 0, col: 2 })).toBe("X");
		expect(getCell(state.grid, { row: 0, col: 1 })).toBeNull();
		expect(state.status).toBe("won");
		expect(state.winner).toBe("X");
	});

	it("o_first: O flees then X slides onto vacated cell (no pieceCaptured)", () => {
		const cfg = {
			...examplePresets["ordered-simultaneous-slide-replace-race"].config,
			turn: {
				mode: "turn" as const,
				schedule: "simultaneous" as const,
				resolveOrder: "o_first" as const
			}
		};
		const { kernel } = compileConfig(cfg);
		const action: Extract<KernelAction, { type: "simultaneousMove" }> = {
			type: "simultaneousMove",
			moves: {
				X: { from: { row: 4, col: 2 }, to: { row: 0, col: 2 } },
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

	it("replays x_first capture transcript", () => {
		const cfg =
			examplePresets["ordered-simultaneous-slide-replace-race"].config;
		const { gameConfig } = compileConfig(cfg);
		const actions: KernelAction[] = [
			{
				type: "simultaneousMove",
				moves: {
					X: { from: { row: 4, col: 2 }, to: { row: 0, col: 2 } },
					O: { from: { row: 0, col: 2 }, to: { row: 0, col: 1 } }
				}
			}
		];
		const replay = replayActions(gameConfig, actions, cfg.rng.seed);
		expect(replay.finalState.status).toBe("won");
		expect(replay.finalState.winner).toBe("X");
		expect(getCell(replay.finalState.grid, { row: 0, col: 2 })).toBe("X");
	});
});
