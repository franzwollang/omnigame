import { describe, expect, it } from "vitest";
import { compileConfig } from "@/compiler";
import type { KernelAction } from "@/engine/kernel";
import { canOrderedSimultaneousMoves } from "@/engine/movement";
import { validateConfig } from "@/engine/validateConfig";
import { getCell } from "@/engine/types";
import { replayActions } from "@/ir/gameIr";
import { zConfig } from "@/schemas/config";
import { examplePresets } from "@/presets/registry";

const JUMP = {
	adjacency: "diagonal" as const,
	range: 1 as const,
	capture: "jump" as const
};

const CONTEST = {
	X: { from: { row: 2, col: 0 }, to: { row: 0, col: 2 } },
	O: { from: { row: 1, col: 1 }, to: { row: 0, col: 0 } }
};

describe("schema: ordered simultaneous jump (M82)", () => {
	it("validates and compiles ordered-simultaneous-jump-race", () => {
		const cfg = examplePresets["ordered-simultaneous-jump-race"].config;
		expect(validateConfig(cfg).ok).toBe(true);
		expect(zConfig.safeParse(cfg).success).toBe(true);
		const { kernel, gameConfig } = compileConfig(cfg);
		expect(gameConfig.turnSchedule).toBe("simultaneous");
		expect(gameConfig.resolveOrder).toBe("x_first");
		expect(gameConfig.movement?.capture).toBe("jump");
		const state = kernel.initialState(cfg.rng.seed);
		expect(kernel.currentPlayer(state)).toBe("simultaneous");
		expect(getCell(state.grid, { row: 2, col: 0 })).toBe("X");
		expect(getCell(state.grid, { row: 1, col: 1 })).toBe("O");
	});

	it("accepts commitReveal under simultaneous jump (M83)", () => {
		const cfg = {
			...examplePresets["ordered-simultaneous-jump-race"].config,
			turn: {
				mode: "turn" as const,
				schedule: "simultaneous" as const,
				resolveOrder: "x_first" as const,
				commitReveal: true
			}
		};
		expect(validateConfig(cfg).ok).toBe(true);
	});

	it("accepts multi-action under ordered simultaneous jump (M84 schema)", () => {
		const cfg = {
			...examplePresets["ordered-simultaneous-jump-race"].config,
			turn: {
				mode: "turn" as const,
				schedule: "simultaneous" as const,
				resolveOrder: "x_first" as const,
				actionsPerTurn: 2
			}
		};
		expect(validateConfig(cfg).ok).toBe(true);
		expect(zConfig.safeParse(cfg).success).toBe(true);
	});

	it("still rejects hex simultaneous jump", () => {
		const cfg = {
			...examplePresets["ordered-simultaneous-jump-race"].config,
			grid: {
				width: 5,
				height: 5,
				topology: "hex_offset" as const,
				wrap: false
			},
			movement: {
				adjacency: "orthogonal" as const,
				range: 1 as const,
				capture: "jump" as const
			}
		};
		expect(validateConfig(cfg).ok).toBe(false);
	});
});

describe("canOrderedSimultaneousMoves jump mid priority", () => {
	it("x_first allows jump capture of fleeing mid (second becomes noop)", () => {
		const { kernel } = compileConfig(
			examplePresets["ordered-simultaneous-jump-race"].config
		);
		const state = kernel.initialState(42);
		expect(
			canOrderedSimultaneousMoves(state.grid, CONTEST, JUMP, "x_first")
		).toBe(true);
	});

	it("o_first rejects flee-then-jump (mid vacated — unlike replace dest land)", () => {
		const { kernel } = compileConfig(
			examplePresets["ordered-simultaneous-jump-race"].config
		);
		const state = kernel.initialState(42);
		expect(
			canOrderedSimultaneousMoves(state.grid, CONTEST, JUMP, "o_first")
		).toBe(false);
	});

	it("allows independent ordered quiet steps that do not interact", () => {
		const cfg = {
			...examplePresets["ordered-simultaneous-jump-race"].config,
			initial: [
				{
					row: 2,
					col: 0,
					player: "X" as const,
					visibility: "public" as const
				},
				{
					row: 1,
					col: 1,
					player: "O" as const,
					visibility: "public" as const
				},
				{
					row: 4,
					col: 4,
					player: "O" as const,
					visibility: "public" as const
				}
			]
		};
		const { kernel } = compileConfig(cfg);
		const state = kernel.initialState(42);
		const moves = {
			X: { from: { row: 2, col: 0 }, to: { row: 0, col: 2 } },
			O: { from: { row: 4, col: 4 }, to: { row: 3, col: 3 } }
		};
		expect(
			canOrderedSimultaneousMoves(state.grid, moves, JUMP, "x_first")
		).toBe(true);
	});
});

describe("Ordered Simultaneous Jump Race", () => {
	it("x_first: X jumps mid before O flees (pieceCaptured + win)", () => {
		const cfg = examplePresets["ordered-simultaneous-jump-race"].config;
		const { kernel } = compileConfig(cfg);
		const action: Extract<KernelAction, { type: "simultaneousMove" }> = {
			type: "simultaneousMove",
			moves: CONTEST
		};
		let state = kernel.initialState(cfg.rng.seed);
		expect(kernel.explainAction(state, 0, action).legal).toBe(true);
		const result = kernel.stepSync(state, action);
		expect(
			result.events.some(
				(e) =>
					e.type === "pieceCaptured" &&
					e.position.row === 1 &&
					e.position.col === 1 &&
					e.captured === "O" &&
					e.by === "X"
			)
		).toBe(true);
		expect(result.events.some((e) => e.type === "terminal")).toBe(true);
		state = result.nextState;
		expect(getCell(state.grid, { row: 0, col: 2 })).toBe("X");
		expect(getCell(state.grid, { row: 1, col: 1 })).toBeNull();
		expect(getCell(state.grid, { row: 0, col: 0 })).toBeNull();
		expect(state.status).toBe("won");
		expect(state.winner).toBe("X");
		expect(state.mustContinueFrom).toBeUndefined();
	});

	it("o_first: flee-before-jump contest is illegal (mid empty)", () => {
		const cfg = {
			...examplePresets["ordered-simultaneous-jump-race"].config,
			turn: {
				mode: "turn" as const,
				schedule: "simultaneous" as const,
				resolveOrder: "o_first" as const
			}
		};
		const { kernel } = compileConfig(cfg);
		const action: Extract<KernelAction, { type: "simultaneousMove" }> = {
			type: "simultaneousMove",
			moves: CONTEST
		};
		const state = kernel.initialState(cfg.rng.seed);
		expect(kernel.explainAction(state, 0, action).legal).toBe(false);
		const result = kernel.stepSync(state, action);
		expect(result.nextState).toBe(state);
		expect(result.events.some((e) => e.type === "pieceCaptured")).toBe(
			false
		);
	});

	it("replays the x_first capture-before-flee win faithfully", () => {
		const cfg = examplePresets["ordered-simultaneous-jump-race"].config;
		const { gameConfig } = compileConfig(cfg);
		const actions: KernelAction[] = [
			{ type: "simultaneousMove", moves: CONTEST }
		];
		const replay = replayActions(gameConfig, actions, cfg.rng.seed);
		expect(replay.faithful).toBe(true);
		expect(replay.finalState.status).toBe("won");
		expect(replay.finalState.winner).toBe("X");
		expect(getCell(replay.finalState.grid, { row: 0, col: 2 })).toBe("X");
		expect(getCell(replay.finalState.grid, { row: 1, col: 1 })).toBeNull();
		expect(
			replay.events.some(
				(e) =>
					e.type === "pieceCaptured" &&
					e.position.row === 1 &&
					e.position.col === 1
			)
		).toBe(true);
	});

	it("contrasts joint: mid flee is illegal under joint vacated-origin", () => {
		const joint = examplePresets["simultaneous-jump-race"].config;
		const { kernel } = compileConfig(joint);
		const state = kernel.initialState(42);
		const action: Extract<KernelAction, { type: "simultaneousMove" }> = {
			type: "simultaneousMove",
			moves: CONTEST
		};
		expect(kernel.explainAction(state, 0, action).legal).toBe(false);
	});
});
