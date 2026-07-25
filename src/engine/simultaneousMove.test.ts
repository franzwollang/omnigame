import { describe, expect, it } from "vitest";
import { compileConfig, compileToGameConfig } from "@/compiler";
import { zConfig } from "@/schemas/config";
import { examplePresets } from "@/presets/registry";
import { getCell } from "@/engine/types";
import {
	jointMoveFromActions,
	stepPly,
	type KernelAction
} from "@/engine/kernel";
import { replayActions } from "@/ir/gameIr";
import { validateConfig } from "@/engine/validateConfig";

describe("schema: simultaneous move", () => {
	it("accepts simultaneous + move + reach_row on rectangle", () => {
		const ok = zConfig.safeParse(
			examplePresets["simultaneous-step-race"].config
		);
		expect(ok.success).toBe(true);
	});

	it("rejects hex/graph simultaneous move and commitReveal", () => {
		const base = examplePresets["simultaneous-step-race"].config;
		const hex = zConfig.safeParse({
			...base,
			grid: { ...base.grid, topology: "hex_offset" as const }
		});
		expect(hex.success).toBe(false);

		const hidden = zConfig.safeParse({
			...base,
			turn: { mode: "turn", schedule: "simultaneous", commitReveal: true }
		});
		expect(hidden.success).toBe(false);

		const multi = zConfig.safeParse({
			...base,
			turn: { mode: "turn", schedule: "simultaneous", actionsPerTurn: 2 }
		});
		expect(multi.success).toBe(false);
	});

	it("still accepts simultaneous place and rejects gravity under simultaneous", () => {
		const place = zConfig.safeParse({
			...examplePresets["tic-tac-toe"].config,
			turn: { mode: "turn", schedule: "simultaneous" }
		});
		expect(place.success).toBe(true);

		const gravity = zConfig.safeParse({
			...examplePresets["tic-tac-toe"].config,
			turn: { mode: "turn", schedule: "simultaneous" },
			placement: {
				mode: "gravity",
				gravity: { enabled: true, direction: "down", wrap: false },
				overflow: "reject"
			},
			input: { mode: "column" }
		});
		expect(gravity.success).toBe(false);
	});
});

describe("kernel: simultaneous joint move", () => {
	it("lists per-seat moves and wires ScheduleSimultaneousMove", () => {
		const { kernel, gameConfig } = compileConfig(
			examplePresets["simultaneous-step-race"].config
		);
		expect(gameConfig.turnSchedule).toBe("simultaneous");
		expect(gameConfig.inputMode).toBe("move");
		expect(gameConfig.objectiveMode).toBe("reach_row");
		const validated = validateConfig(
			examplePresets["simultaneous-step-race"].config
		);
		expect(validated.ok).toBe(true);
		expect(
			validated.errors.every((e) => !e.includes("ScheduleSimultaneousMove"))
		).toBe(true);

		const state = kernel.initialState();
		expect(kernel.currentPlayer(state)).toBe("simultaneous");
		const xMoves = kernel.legalActions(state, 0);
		const oMoves = kernel.legalActions(state, 1);
		expect(xMoves.every((a) => a.type === "move")).toBe(true);
		expect(oMoves.every((a) => a.type === "move")).toBe(true);
		expect(xMoves.length).toBeGreaterThan(0);
		expect(oMoves.length).toBeGreaterThan(0);
	});

	it("applies both moves when destinations differ", () => {
		const { kernel } = compileConfig(
			examplePresets["simultaneous-step-race"].config
		);
		let state = kernel.initialState();
		const joint: KernelAction = {
			type: "simultaneousMove",
			moves: {
				X: { from: { row: 4, col: 2 }, to: { row: 3, col: 2 } },
				O: { from: { row: 0, col: 2 }, to: { row: 1, col: 2 } }
			}
		};
		const result = kernel.stepSync(state, joint);
		expect(result.events[0]?.type).toBe("actionApplied");
		if (result.events[0]?.type === "actionApplied") {
			expect(result.events[0].player).toBe("simultaneous");
		}
		state = result.nextState;
		expect(getCell(state.grid, { row: 3, col: 2 })).toBe("X");
		expect(getCell(state.grid, { row: 1, col: 2 })).toBe("O");
		expect(getCell(state.grid, { row: 4, col: 2 })).toBe(null);
		expect(getCell(state.grid, { row: 0, col: 2 })).toBe(null);
		expect(state.moveCount).toBe(1);
		expect(kernel.currentPlayer(state)).toBe("simultaneous");
	});

	it("same-destination conflict moves neither under joint", () => {
		// Place both near a shared empty cell they can both step to.
		const seeded = {
			...examplePresets["simultaneous-step-race"].config,
			initial: [
				{ row: 2, col: 1, player: "X" as const, visibility: "public" as const },
				{ row: 2, col: 3, player: "O" as const, visibility: "public" as const }
			]
		};
		const { kernel } = compileConfig(seeded);
		let state = kernel.initialState();
		const joint: KernelAction = {
			type: "simultaneousMove",
			moves: {
				X: { from: { row: 2, col: 1 }, to: { row: 2, col: 2 } },
				O: { from: { row: 2, col: 3 }, to: { row: 2, col: 2 } }
			}
		};
		const result = kernel.stepSync(state, joint);
		state = result.nextState;
		expect(getCell(state.grid, { row: 2, col: 2 })).toBe(null);
		expect(getCell(state.grid, { row: 2, col: 1 })).toBe("X");
		expect(getCell(state.grid, { row: 2, col: 3 })).toBe("O");
		expect(state.moveCount).toBe(1);
		expect(state.status).toBe("playing");
	});

	it("ordered resolve: first seat wins same destination", () => {
		const seeded = {
			...examplePresets["simultaneous-step-race"].config,
			turn: {
				mode: "turn" as const,
				schedule: "simultaneous" as const,
				resolveOrder: "x_first" as const
			},
			initial: [
				{ row: 2, col: 1, player: "X" as const, visibility: "public" as const },
				{ row: 2, col: 3, player: "O" as const, visibility: "public" as const }
			]
		};
		const { kernel, gameConfig } = compileConfig(seeded);
		expect(gameConfig.resolveOrder).toBe("x_first");
		let state = kernel.initialState();
		const result = kernel.stepSync(state, {
			type: "simultaneousMove",
			moves: {
				X: { from: { row: 2, col: 1 }, to: { row: 2, col: 2 } },
				O: { from: { row: 2, col: 3 }, to: { row: 2, col: 2 } }
			}
		});
		state = result.nextState;
		expect(getCell(state.grid, { row: 2, col: 2 })).toBe("X");
		expect(getCell(state.grid, { row: 2, col: 1 })).toBe(null);
		expect(getCell(state.grid, { row: 2, col: 3 })).toBe("O");
	});

	it("single move is ignored under simultaneous schedule", () => {
		const { kernel } = compileConfig(
			examplePresets["simultaneous-step-race"].config
		);
		const state = kernel.initialState();
		const result = kernel.stepSync(state, {
			type: "move",
			from: { row: 4, col: 2 },
			to: { row: 3, col: 2 }
		});
		expect(result.events[0]?.type).toBe("ignored");
		expect(result.nextState.moveCount).toBe(0);
	});

	it("stepJoint builds simultaneousMove from two moves", () => {
		const { kernel } = compileConfig(
			examplePresets["simultaneous-step-race"].config
		);
		const state = kernel.initialState();
		const built = jointMoveFromActions(
			{ type: "move", from: { row: 4, col: 2 }, to: { row: 3, col: 2 } },
			{ type: "move", from: { row: 0, col: 2 }, to: { row: 0, col: 1 } }
		);
		expect(built?.type).toBe("simultaneousMove");
		const result = kernel.stepJointSync(state, {
			0: { type: "move", from: { row: 4, col: 2 }, to: { row: 3, col: 2 } },
			1: { type: "move", from: { row: 0, col: 2 }, to: { row: 0, col: 1 } }
		});
		expect(getCell(result.nextState.grid, { row: 3, col: 2 })).toBe("X");
		expect(getCell(result.nextState.grid, { row: 0, col: 1 })).toBe("O");
	});

	it("reach_row win after simultaneous move; mutual reach is draw", () => {
		const nearWin = {
			...examplePresets["simultaneous-step-race"].config,
			initial: [
				{ row: 1, col: 2, player: "X" as const, visibility: "public" as const },
				{ row: 3, col: 0, player: "O" as const, visibility: "public" as const }
			]
		};
		const { kernel } = compileConfig(nearWin);
		const win = kernel.stepSync(kernel.initialState(), {
			type: "simultaneousMove",
			moves: {
				X: { from: { row: 1, col: 2 }, to: { row: 0, col: 2 } },
				O: { from: { row: 3, col: 0 }, to: { row: 3, col: 1 } }
			}
		});
		expect(win.nextState.status).toBe("won");
		expect(win.nextState.winner).toBe("X");

		const mutual = {
			...examplePresets["simultaneous-step-race"].config,
			initial: [
				{ row: 1, col: 2, player: "X" as const, visibility: "public" as const },
				{ row: 3, col: 2, player: "O" as const, visibility: "public" as const }
			]
		};
		const { kernel: k2 } = compileConfig(mutual);
		const draw = k2.stepSync(k2.initialState(), {
			type: "simultaneousMove",
			moves: {
				X: { from: { row: 1, col: 2 }, to: { row: 0, col: 2 } },
				O: { from: { row: 3, col: 2 }, to: { row: 4, col: 2 } }
			}
		});
		expect(draw.nextState.status).toBe("draw");
		expect(draw.nextState.winner).toBe(null);
	});

	it("stepPly advances a simultaneous move round via picks", () => {
		const { kernel } = compileConfig(
			examplePresets["simultaneous-step-race"].config
		);
		const state = kernel.initialState();
		const result = stepPly(kernel, state, (player) => {
			const legal = kernel.legalActions(state, player);
			const prefer =
				player === 0
					? legal.find(
							(a) =>
								a.type === "move" &&
								a.to.row === 3 &&
								a.to.col === 2
						)
					: legal.find(
							(a) =>
								a.type === "move" &&
								a.to.row === 1 &&
								a.to.col === 2
						);
			return prefer ?? legal[0] ?? null;
		});
		expect(result).not.toBeNull();
		expect(getCell(result!.nextState.grid, { row: 3, col: 2 })).toBe("X");
		expect(getCell(result!.nextState.grid, { row: 1, col: 2 })).toBe("O");
	});

	it("replays simultaneousMove faithfully", () => {
		const { kernel, gameConfig } = compileConfig(
			examplePresets["simultaneous-step-race"].config
		);
		const actions: KernelAction[] = [
			{
				type: "simultaneousMove",
				moves: {
					X: { from: { row: 4, col: 2 }, to: { row: 3, col: 2 } },
					O: { from: { row: 0, col: 2 }, to: { row: 1, col: 2 } }
				}
			},
			{
				type: "simultaneousMove",
				moves: {
					X: { from: { row: 3, col: 2 }, to: { row: 2, col: 2 } },
					O: { from: { row: 1, col: 2 }, to: { row: 1, col: 1 } }
				}
			}
		];
		const live = actions.reduce(
			(s, a) => kernel.stepSync(s, a).nextState,
			kernel.initialState()
		);
		const replayed = replayActions(gameConfig, actions);
		expect(replayed.finalState.grid.cells).toEqual(live.grid.cells);
		expect(replayed.finalState.moveCount).toBe(2);
	});

	it("normalizes simultaneous-step-race through compiler", () => {
		const { gameConfig } = compileToGameConfig(
			examplePresets["simultaneous-step-race"].config
		);
		expect(gameConfig.turnSchedule).toBe("simultaneous");
		expect(gameConfig.inputMode).toBe("move");
		expect(gameConfig.movement?.adjacency).toBe("orthogonal");
		expect(gameConfig.targetRows).toEqual({ X: 0, O: 4 });
	});
});
