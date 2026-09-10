import { describe, expect, it } from "vitest";
import { compileConfig, compileToGameConfig } from "@/compiler";
import { zConfig } from "@/schemas/config";
import { examplePresets } from "@/presets/registry";
import { getCell } from "@/engine/types";
import {
	jointMovesFromActions,
	stepPly,
	type KernelAction
} from "@/engine/kernel";
import { enumerateJointLegalActions } from "@/agents/jointLegal";
import { canJointSimultaneousMoves } from "@/engine/movement";
import { replayActions } from "@/ir/gameIr";
import { validateConfig } from "@/engine/validateConfig";

const JUMP = {
	adjacency: "diagonal" as const,
	range: 1 as const,
	capture: "jump" as const
};

describe("schema: multi-action simultaneous jump (M84)", () => {
	it("accepts double-simultaneous-jump-race preset", () => {
		const ok = zConfig.safeParse(
			examplePresets["double-simultaneous-jump-race"].config
		);
		expect(ok.success).toBe(true);
	});

	it("wires ScheduleMultiActionSimultaneous + jump capture", () => {
		const result = validateConfig(
			examplePresets["double-simultaneous-jump-race"].config
		);
		expect(result.ok).toBe(true);
		const { gameConfig } = compileToGameConfig(
			examplePresets["double-simultaneous-jump-race"].config
		);
		expect(gameConfig.turnSchedule).toBe("simultaneous");
		expect(gameConfig.inputMode).toBe("move");
		expect(gameConfig.actionsPerTurn).toBe(2);
		expect(gameConfig.movement?.capture).toBe("jump");
		expect(gameConfig.objectiveMode).toBe("reach_row");
	});

	it("accepts commitReveal + multi-action simultaneous jump (schema)", () => {
		const ok = zConfig.safeParse({
			...examplePresets["double-simultaneous-jump-race"].config,
			turn: {
				mode: "turn",
				schedule: "simultaneous",
				actionsPerTurn: 2,
				commitReveal: true
			}
		});
		expect(ok.success).toBe(true);
	});

	it("still rejects alternating jump with actionsPerTurn > 1", () => {
		const bad = zConfig.safeParse({
			...examplePresets["jump-race"].config,
			turn: { mode: "turn", schedule: "alternating", actionsPerTurn: 2 }
		});
		expect(bad.success).toBe(false);
	});

	it("rejects hex simultaneous multi-action jump", () => {
		const bad = zConfig.safeParse({
			...examplePresets["double-simultaneous-jump-race"].config,
			grid: {
				width: 5,
				height: 5,
				topology: "hex_offset",
				wrap: false
			},
			movement: {
				adjacency: "orthogonal",
				range: 1,
				capture: "jump"
			}
		});
		expect(bad.success).toBe(false);
	});

	it("rejects mustLongestCapture under simultaneous multi-action jump", () => {
		const bad = zConfig.safeParse({
			...examplePresets["double-simultaneous-jump-race"].config,
			movement: {
				...JUMP,
				mustCapture: true,
				mustLongestCapture: true
			}
		});
		expect(bad.success).toBe(false);
	});
});

describe("kernel: multi-action simultaneous jump (M84)", () => {
	it("same-piece double-hop clears two mids and wins; no mustContinueFrom", () => {
		const cfg = examplePresets["double-simultaneous-jump-race"].config;
		const { kernel } = compileConfig(cfg);
		const action: Extract<KernelAction, { type: "simultaneousMove" }> = {
			type: "simultaneousMove",
			moves: {
				X: [
					{ from: { row: 4, col: 0 }, to: { row: 2, col: 2 } },
					{ from: { row: 2, col: 2 }, to: { row: 0, col: 4 } }
				],
				O: [
					{ from: { row: 0, col: 0 }, to: { row: 1, col: 1 } },
					{ from: { row: 1, col: 1 }, to: { row: 2, col: 0 } }
				]
			}
		};
		const state = kernel.initialState(cfg.rng.seed);
		expect(kernel.explainAction(state, 0, action).legal).toBe(true);
		const x0 = (action.moves.X as { from: { row: number; col: number }; to: { row: number; col: number } }[])[0]!;
		const o0 = (action.moves.O as { from: { row: number; col: number }; to: { row: number; col: number } }[])[0]!;
		expect(
			canJointSimultaneousMoves(
				state.grid,
				{ X: x0, O: o0 },
				JUMP
			)
		).toBe(true);

		const result = kernel.stepSync(state, action);
		expect(getCell(result.nextState.grid, { row: 0, col: 4 })).toBe("X");
		expect(getCell(result.nextState.grid, { row: 3, col: 1 })).toBeNull();
		expect(getCell(result.nextState.grid, { row: 1, col: 3 })).toBeNull();
		expect(getCell(result.nextState.grid, { row: 2, col: 0 })).toBe("O");
		expect(result.nextState.mustContinueFrom).toBeUndefined();
		expect(result.nextState.moveCount).toBe(1);
		expect(result.nextState.status).toBe("won");
		expect(result.nextState.winner).toBe("X");

		const captures = result.events.filter((e) => e.type === "pieceCaptured");
		expect(captures).toHaveLength(2);
		expect(captures).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					type: "pieceCaptured",
					position: { row: 3, col: 1 },
					captured: "O",
					by: "X"
				}),
				expect.objectContaining({
					type: "pieceCaptured",
					position: { row: 1, col: 3 },
					captured: "O",
					by: "X"
				})
			])
		);
	});

	it("mid-flee at index 1 makes the joint round illegal", () => {
		const cfg = examplePresets["double-simultaneous-jump-race"].config;
		const { kernel } = compileConfig(cfg);
		const action: Extract<KernelAction, { type: "simultaneousMove" }> = {
			type: "simultaneousMove",
			moves: {
				X: [
					{ from: { row: 4, col: 0 }, to: { row: 2, col: 2 } },
					{ from: { row: 2, col: 2 }, to: { row: 0, col: 4 } }
				],
				O: [
					{ from: { row: 0, col: 0 }, to: { row: 1, col: 1 } },
					// Flee second mid (1,3) after index-0 lands X at (2,2)
					{ from: { row: 1, col: 3 }, to: { row: 0, col: 2 } }
				]
			}
		};
		const state = kernel.initialState(cfg.rng.seed);
		expect(kernel.explainAction(state, 0, action).legal).toBe(false);
		const result = kernel.stepSync(state, action);
		expect(result.nextState.moveCount).toBe(0);
		expect(getCell(result.nextState.grid, { row: 4, col: 0 })).toBe("X");
	});

	it("mid-round reach_row win ends before later sub-steps", () => {
		const { kernel } = compileConfig(
			examplePresets["double-simultaneous-jump-race"].config
		);
		// X one quiet diagonal from target; first sub-step wins, second skipped.
		let state = kernel.initialState();
		state = {
			...state,
			grid: {
				...state.grid,
				cells: (() => {
					const cells = Array(25).fill(null) as Array<"X" | "O" | null>;
					cells[1 * 5 + 2] = "X";
					cells[0 * 5 + 0] = "O";
					return cells;
				})()
			}
		};
		state = kernel.stepSync(state, {
			type: "simultaneousMove",
			moves: {
				X: [
					{ from: { row: 1, col: 2 }, to: { row: 0, col: 1 } },
					{ from: { row: 0, col: 1 }, to: { row: 1, col: 0 } }
				],
				O: [
					{ from: { row: 0, col: 0 }, to: { row: 1, col: 1 } },
					{ from: { row: 1, col: 1 }, to: { row: 2, col: 2 } }
				]
			}
		}).nextState;
		expect(state.status).toBe("won");
		expect(state.winner).toBe("X");
		expect(getCell(state.grid, { row: 0, col: 1 })).toBe("X");
		expect(getCell(state.grid, { row: 1, col: 0 })).toBeNull();
	});

	it("jointMovesFromActions + stepPly compose a double-hop round", () => {
		const { kernel } = compileConfig(
			examplePresets["double-simultaneous-jump-race"].config
		);
		const state = kernel.initialState(42);
		const joint = jointMovesFromActions(
			[
				{ type: "move", from: { row: 4, col: 0 }, to: { row: 2, col: 2 } },
				{ type: "move", from: { row: 2, col: 2 }, to: { row: 0, col: 4 } }
			],
			[
				{ type: "move", from: { row: 0, col: 0 }, to: { row: 1, col: 1 } },
				{ type: "move", from: { row: 1, col: 1 }, to: { row: 2, col: 0 } }
			]
		);
		expect(joint).not.toBeNull();
		expect(kernel.explainAction(state, 0, joint!).legal).toBe(true);

		const ply = stepPly(kernel, state, (_pid, legal) => legal[0] ?? null);
		expect(ply).not.toBeNull();
		expect(ply!.nextState.moveCount).toBe(1);
	});

	it("enumerateJointLegalActions yields length-2 move arrays", () => {
		const { kernel } = compileConfig(
			examplePresets["double-simultaneous-jump-race"].config
		);
		const state = kernel.initialState(42);
		const joints = enumerateJointLegalActions(kernel, state);
		expect(joints.length).toBeGreaterThan(0);
		const sample = joints.find((j) => j.type === "simultaneousMove");
		expect(sample).toBeDefined();
		if (sample?.type === "simultaneousMove") {
			expect(Array.isArray(sample.moves.X)).toBe(true);
			expect(Array.isArray(sample.moves.O)).toBe(true);
			expect(sample.moves.X).toHaveLength(2);
			expect(sample.moves.O).toHaveLength(2);
		}
	});

	it("replayActions is faithful for a double-hop win transcript", () => {
		const cfg = examplePresets["double-simultaneous-jump-race"].config;
		const { gameConfig } = compileConfig(cfg);
		const actions: KernelAction[] = [
			{
				type: "simultaneousMove",
				moves: {
					X: [
						{ from: { row: 4, col: 0 }, to: { row: 2, col: 2 } },
						{ from: { row: 2, col: 2 }, to: { row: 0, col: 4 } }
					],
					O: [
						{ from: { row: 0, col: 0 }, to: { row: 1, col: 1 } },
						{ from: { row: 1, col: 1 }, to: { row: 2, col: 0 } }
					]
				}
			}
		];
		const replay = replayActions(gameConfig, actions, cfg.rng.seed);
		expect(replay.faithful).toBe(true);
		expect(replay.finalState.status).toBe("won");
		expect(replay.finalState.winner).toBe("X");
		expect(getCell(replay.finalState.grid, { row: 0, col: 4 })).toBe("X");
		expect(getCell(replay.finalState.grid, { row: 3, col: 1 })).toBeNull();
		expect(getCell(replay.finalState.grid, { row: 1, col: 3 })).toBeNull();
	});
});
