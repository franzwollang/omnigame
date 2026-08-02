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
import { replayActions } from "@/ir/gameIr";
import { validateConfig } from "@/engine/validateConfig";

describe("schema: multi-action simultaneous move", () => {
	it("accepts double-simultaneous-step-race preset", () => {
		const ok = zConfig.safeParse(
			examplePresets["double-simultaneous-step-race"].config
		);
		expect(ok.success).toBe(true);
	});

	it("wires ScheduleMultiActionSimultaneous + ScheduleSimultaneousMove", () => {
		const result = validateConfig(
			examplePresets["double-simultaneous-step-race"].config
		);
		expect(result.ok).toBe(true);
		const { gameConfig } = compileToGameConfig(
			examplePresets["double-simultaneous-step-race"].config
		);
		expect(gameConfig.turnSchedule).toBe("simultaneous");
		expect(gameConfig.inputMode).toBe("move");
		expect(gameConfig.actionsPerTurn).toBe(2);
		expect(gameConfig.objectiveMode).toBe("reach_row");
	});

	it("rejects commitReveal + multi-action simultaneous move", () => {
		const bad = zConfig.safeParse({
			...examplePresets["double-simultaneous-step-race"].config,
			turn: {
				mode: "turn",
				schedule: "simultaneous",
				actionsPerTurn: 2,
				commitReveal: true
			}
		});
		expect(bad.success).toBe(false);
	});

	it("rejects range > 1 and replace under multi-action simultaneous move", () => {
		const slide = zConfig.safeParse({
			...examplePresets["double-simultaneous-step-race"].config,
			movement: { adjacency: "orthogonal", range: 2 }
		});
		expect(slide.success).toBe(false);

		const replace = zConfig.safeParse({
			...examplePresets["double-simultaneous-step-race"].config,
			movement: {
				adjacency: "orthogonal",
				range: 1,
				capture: "replace"
			}
		});
		expect(replace.success).toBe(false);
	});

	it("still rejects alternating multi-step with move input", () => {
		const bad = zConfig.safeParse({
			...examplePresets["step-race"].config,
			turn: { mode: "turn", schedule: "alternating", actionsPerTurn: 2 }
		});
		expect(bad.success).toBe(false);
	});
});

describe("kernel: multi-action simultaneous move", () => {
	it("applies two steps per seat in one round (same-piece chain)", () => {
		const { kernel } = compileConfig(
			examplePresets["double-simultaneous-step-race"].config
		);
		let state = kernel.initialState();
		expect(kernel.currentPlayer(state)).toBe("simultaneous");

		// X: (4,2)→(3,2)→(2,2); O: (0,2)→(1,2)→(2,1) — avoid same dest conflict
		state = kernel.stepSync(state, {
			type: "simultaneousMove",
			moves: {
				X: [
					{ from: { row: 4, col: 2 }, to: { row: 3, col: 2 } },
					{ from: { row: 3, col: 2 }, to: { row: 2, col: 2 } }
				],
				O: [
					{ from: { row: 0, col: 2 }, to: { row: 1, col: 2 } },
					{ from: { row: 1, col: 2 }, to: { row: 1, col: 1 } }
				]
			}
		}).nextState;

		expect(getCell(state.grid, { row: 2, col: 2 })).toBe("X");
		expect(getCell(state.grid, { row: 1, col: 1 })).toBe("O");
		expect(getCell(state.grid, { row: 4, col: 2 })).toBe(null);
		expect(getCell(state.grid, { row: 0, col: 2 })).toBe(null);
		expect(state.moveCount).toBe(1);
		expect(state.status).toBe("playing");
	});

	it("same-destination at index 0 places neither; index 1 still applies", () => {
		const { kernel } = compileConfig(
			examplePresets["double-simultaneous-step-race"].config
		);
		// Place pieces adjacent so index-0 can conflict on the same destination.
		let state = kernel.initialState();
		state = {
			...state,
			grid: {
				...state.grid,
				cells: (() => {
					const cells = Array(25).fill(null) as Array<"X" | "O" | null>;
					cells[2 * 5 + 2] = "X"; // (2,2)
					cells[2 * 5 + 3] = "O"; // (2,3)
					return cells;
				})()
			}
		};
		state = kernel.stepSync(state, {
			type: "simultaneousMove",
			moves: {
				X: [
					{ from: { row: 2, col: 2 }, to: { row: 2, col: 1 } },
					{ from: { row: 2, col: 2 }, to: { row: 1, col: 2 } }
				],
				O: [
					{ from: { row: 2, col: 3 }, to: { row: 2, col: 1 } },
					{ from: { row: 2, col: 3 }, to: { row: 1, col: 3 } }
				]
			}
		}).nextState;
		// Index 0 same dest (2,1) → neither; pieces stay. Index 1 applies from originals.
		expect(getCell(state.grid, { row: 2, col: 1 })).toBe(null);
		expect(getCell(state.grid, { row: 1, col: 2 })).toBe("X");
		expect(getCell(state.grid, { row: 1, col: 3 })).toBe("O");
		expect(getCell(state.grid, { row: 2, col: 2 })).toBe(null);
		expect(getCell(state.grid, { row: 2, col: 3 })).toBe(null);
		expect(state.moveCount).toBe(1);
	});

	it("mid-round reach_row win ends before later sub-steps", () => {
		const { kernel } = compileConfig(
			examplePresets["double-simultaneous-step-race"].config
		);
		// X one step from target row 0 at (1,2); first sub-step reaches, second skipped.
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
					{ from: { row: 1, col: 2 }, to: { row: 0, col: 2 } },
					{ from: { row: 0, col: 2 }, to: { row: 0, col: 1 } }
				],
				O: [
					{ from: { row: 0, col: 0 }, to: { row: 1, col: 0 } },
					{ from: { row: 1, col: 0 }, to: { row: 2, col: 0 } }
				]
			}
		}).nextState;
		expect(state.status).toBe("won");
		expect(state.winner).toBe("X");
		expect(getCell(state.grid, { row: 0, col: 2 })).toBe("X");
		// O's second step must not have applied.
		expect(getCell(state.grid, { row: 2, col: 0 })).toBe(null);
		expect(getCell(state.grid, { row: 1, col: 0 })).toBe("O");
	});

	it("rejects within-seat duplicate pairs and wrong-length payloads", () => {
		const { kernel } = compileConfig(
			examplePresets["double-simultaneous-step-race"].config
		);
		const state = kernel.initialState();
		const dup = kernel.stepSync(state, {
			type: "simultaneousMove",
			moves: {
				X: [
					{ from: { row: 4, col: 2 }, to: { row: 3, col: 2 } },
					{ from: { row: 4, col: 2 }, to: { row: 3, col: 2 } }
				],
				O: [
					{ from: { row: 0, col: 2 }, to: { row: 1, col: 2 } },
					{ from: { row: 1, col: 2 }, to: { row: 2, col: 2 } }
				]
			}
		});
		expect(dup.events[0]?.type).toBe("ignored");

		const short = kernel.stepSync(state, {
			type: "simultaneousMove",
			moves: {
				X: { from: { row: 4, col: 2 }, to: { row: 3, col: 2 } },
				O: { from: { row: 0, col: 2 }, to: { row: 1, col: 2 } }
			}
		});
		expect(short.events[0]?.type).toBe("ignored");
	});

	it("jointMovesFromActions + stepPly collect N chained moves per seat", () => {
		const { kernel } = compileConfig(
			examplePresets["double-simultaneous-step-race"].config
		);
		const state = kernel.initialState();
		const joint = jointMovesFromActions(
			[
				{ type: "move", from: { row: 4, col: 2 }, to: { row: 3, col: 2 } },
				{ type: "move", from: { row: 3, col: 2 }, to: { row: 2, col: 2 } }
			],
			[
				{ type: "move", from: { row: 0, col: 2 }, to: { row: 1, col: 2 } },
				{ type: "move", from: { row: 1, col: 2 }, to: { row: 1, col: 1 } }
			]
		);
		expect(joint).not.toBeNull();
		const after = kernel.stepSync(state, joint!).nextState;
		expect(getCell(after.grid, { row: 2, col: 2 })).toBe("X");
		expect(getCell(after.grid, { row: 1, col: 1 })).toBe("O");

		const ply = stepPly(kernel, state, (_pid, legal) => legal[0] ?? null);
		expect(ply).not.toBeNull();
		expect(ply!.nextState.moveCount).toBe(1);
	});

	it("enumerateJointLegalActions yields multi-move joints", () => {
		const { kernel } = compileConfig(
			examplePresets["double-simultaneous-step-race"].config
		);
		const state = kernel.initialState();
		const joints = enumerateJointLegalActions(kernel, state);
		expect(joints.length).toBeGreaterThan(0);
		expect(joints.every((j) => j.type === "simultaneousMove")).toBe(true);
		const sample = joints[0]!;
		if (sample.type !== "simultaneousMove") throw new Error("expected move");
		expect(Array.isArray(sample.moves.X)).toBe(true);
		expect(Array.isArray(sample.moves.O)).toBe(true);
		expect((sample.moves.X as { from: unknown }[]).length).toBe(2);
		expect((sample.moves.O as { from: unknown }[]).length).toBe(2);
	});

	it("replays multi-action simultaneousMove faithfully", () => {
		const { kernel, gameConfig } = compileConfig(
			examplePresets["double-simultaneous-step-race"].config
		);
		const actions: KernelAction[] = [
			{
				type: "simultaneousMove",
				moves: {
					X: [
						{ from: { row: 4, col: 2 }, to: { row: 3, col: 2 } },
						{ from: { row: 3, col: 2 }, to: { row: 2, col: 2 } }
					],
					O: [
						{ from: { row: 0, col: 2 }, to: { row: 1, col: 2 } },
						{ from: { row: 1, col: 2 }, to: { row: 1, col: 1 } }
					]
				}
			}
		];
		const live = actions.reduce(
			(s, a) => kernel.stepSync(s, a).nextState,
			kernel.initialState()
		);
		const { finalState, faithful } = replayActions(gameConfig, actions);
		expect(faithful).toBe(true);
		expect(finalState.grid).toEqual(live.grid);
		expect(finalState.status).toBe(live.status);
		expect(finalState.moveCount).toBe(live.moveCount);
	});
});
