import { describe, expect, it } from "vitest";
import { compileConfig } from "@/compiler";
import type { KernelAction } from "@/engine/kernel";
import { canJointSimultaneousMoves } from "@/engine/movement";
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

describe("simultaneous jump (M81)", () => {
	it("validates and compiles the simultaneous-jump-race preset", () => {
		const cfg = examplePresets["simultaneous-jump-race"].config;
		expect(validateConfig(cfg).ok).toBe(true);
		expect(zConfig.safeParse(cfg).success).toBe(true);
		const { kernel, gameConfig } = compileConfig(cfg);
		expect(gameConfig.turnSchedule).toBe("simultaneous");
		expect(gameConfig.movement?.capture).toBe("jump");
		const state = kernel.initialState(cfg.rng.seed);
		expect(kernel.currentPlayer(state)).toBe("simultaneous");
	});

	it("rejects simultaneous jump on hex_offset", () => {
		const cfg = {
			...examplePresets["simultaneous-jump-race"].config,
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

	it("accepts simultaneous jump with ordered resolve (M82)", () => {
		const cfg = {
			...examplePresets["simultaneous-jump-race"].config,
			turn: {
				mode: "turn" as const,
				schedule: "simultaneous" as const,
				resolveOrder: "x_first" as const
			}
		};
		expect(validateConfig(cfg).ok).toBe(true);
		expect(zConfig.safeParse(cfg).success).toBe(true);
	});

	it("rejects simultaneous jump with mustLongestCapture", () => {
		const cfg = {
			...examplePresets["simultaneous-jump-race"].config,
			movement: {
				...JUMP,
				mustCapture: true,
				mustLongestCapture: true
			}
		};
		expect(validateConfig(cfg).ok).toBe(false);
	});

	it("rejects simultaneous jump with actionsPerTurn > 1", () => {
		const cfg = {
			...examplePresets["simultaneous-jump-race"].config,
			turn: {
				mode: "turn" as const,
				schedule: "simultaneous" as const,
				actionsPerTurn: 2
			}
		};
		expect(validateConfig(cfg).ok).toBe(false);
	});

	it("joint legality: stationary mid jump + quiet opponent", () => {
		const { kernel } = compileConfig(
			examplePresets["simultaneous-jump-race"].config
		);
		const state = kernel.initialState(42);
		const moves = {
			X: { from: { row: 2, col: 0 }, to: { row: 0, col: 2 } },
			O: { from: { row: 4, col: 4 }, to: { row: 3, col: 3 } }
		};
		expect(canJointSimultaneousMoves(state.grid, moves, JUMP)).toBe(true);
	});

	it("joint legality: mid flee makes jump illegal", () => {
		const { kernel } = compileConfig(
			examplePresets["simultaneous-jump-race"].config
		);
		const state = kernel.initialState(42);
		const moves = {
			X: { from: { row: 2, col: 0 }, to: { row: 0, col: 2 } },
			O: { from: { row: 1, col: 1 }, to: { row: 0, col: 0 } }
		};
		expect(canJointSimultaneousMoves(state.grid, moves, JUMP)).toBe(false);
	});

	it("clears mid, emits pieceCaptured, reaches win; no mustContinueFrom", () => {
		const cfg = examplePresets["simultaneous-jump-race"].config;
		const { kernel } = compileConfig(cfg);
		const action: Extract<KernelAction, { type: "simultaneousMove" }> = {
			type: "simultaneousMove",
			moves: {
				X: { from: { row: 2, col: 0 }, to: { row: 0, col: 2 } },
				O: { from: { row: 4, col: 4 }, to: { row: 3, col: 3 } }
			}
		};
		const state = kernel.initialState(cfg.rng.seed);
		expect(kernel.explainAction(state, 0, action).legal).toBe(true);
		const result = kernel.stepSync(state, action);
		expect(getCell(result.nextState.grid, { row: 0, col: 2 })).toBe("X");
		expect(getCell(result.nextState.grid, { row: 1, col: 1 })).toBeNull();
		expect(getCell(result.nextState.grid, { row: 3, col: 3 })).toBe("O");
		expect(getCell(result.nextState.grid, { row: 2, col: 0 })).toBeNull();
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
		expect(result.nextState.mustContinueFrom).toBeUndefined();
		expect(result.nextState.status).toBe("won");
		expect(result.nextState.winner).toBe("X");
	});

	it("does not emit pieceCaptured when mid flees (illegal joint)", () => {
		const cfg = examplePresets["simultaneous-jump-race"].config;
		const { kernel } = compileConfig(cfg);
		const action: Extract<KernelAction, { type: "simultaneousMove" }> = {
			type: "simultaneousMove",
			moves: {
				X: { from: { row: 2, col: 0 }, to: { row: 0, col: 2 } },
				O: { from: { row: 1, col: 1 }, to: { row: 0, col: 0 } }
			}
		};
		const state = kernel.initialState(cfg.rng.seed);
		expect(kernel.explainAction(state, 0, action).legal).toBe(false);
	});

	it("mustCapture forbids quiet moves for a seat with a jump", () => {
		const cfg = {
			...examplePresets["simultaneous-jump-race"].config,
			movement: { ...JUMP, mustCapture: true }
		};
		expect(validateConfig(cfg).ok).toBe(true);
		const { kernel } = compileConfig(cfg);
		const state = kernel.initialState(cfg.rng.seed);
		const xLegals = kernel.legalActions(state, 0);
		expect(
			xLegals.some(
				(a) =>
					a.type === "move" &&
					a.from.row === 2 &&
					a.from.col === 0 &&
					a.to.row === 0 &&
					a.to.col === 2
			)
		).toBe(true);
		// Quiet diagonal (2,0)→(3,1) absent when mustCapture.
		expect(
			xLegals.some(
				(a) =>
					a.type === "move" &&
					a.from.row === 2 &&
					a.from.col === 0 &&
					a.to.row === 3 &&
					a.to.col === 1
			)
		).toBe(false);
	});

	it("same-destination joint conflict moves neither", () => {
		const cfg = {
			...examplePresets["simultaneous-jump-race"].config,
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
					col: 2,
					player: "O" as const,
					visibility: "public" as const
				}
			]
		};
		const { kernel } = compileConfig(cfg);
		const state = kernel.initialState(cfg.rng.seed);
		const quietConflict: Extract<
			KernelAction,
			{ type: "simultaneousMove" }
		> = {
			type: "simultaneousMove",
			moves: {
				X: { from: { row: 2, col: 0 }, to: { row: 3, col: 1 } },
				O: { from: { row: 4, col: 2 }, to: { row: 3, col: 1 } }
			}
		};
		expect(kernel.explainAction(state, 0, quietConflict).legal).toBe(true);
		const result = kernel.stepSync(state, quietConflict);
		expect(getCell(result.nextState.grid, { row: 2, col: 0 })).toBe("X");
		expect(getCell(result.nextState.grid, { row: 4, col: 2 })).toBe("O");
		expect(getCell(result.nextState.grid, { row: 3, col: 1 })).toBeNull();
		expect(result.nextState.status).toBe("playing");
	});

	it("replays the stationary mid capture win faithfully", () => {
		const cfg = examplePresets["simultaneous-jump-race"].config;
		const { gameConfig } = compileConfig(cfg);
		const actions: KernelAction[] = [
			{
				type: "simultaneousMove",
				moves: {
					X: { from: { row: 2, col: 0 }, to: { row: 0, col: 2 } },
					O: { from: { row: 4, col: 4 }, to: { row: 3, col: 3 } }
				}
			}
		];
		const replay = replayActions(gameConfig, actions, cfg.rng.seed);
		expect(replay.faithful).toBe(true);
		expect(replay.finalState.status).toBe("won");
		expect(replay.finalState.winner).toBe("X");
		expect(getCell(replay.finalState.grid, { row: 0, col: 2 })).toBe("X");
		expect(getCell(replay.finalState.grid, { row: 1, col: 1 })).toBeNull();
	});
});
