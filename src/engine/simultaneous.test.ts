import { describe, expect, it } from "vitest";
import { compileConfig, compileToGameConfig } from "@/compiler";
import { zConfig } from "@/schemas/config";
import { examplePresets } from "@/presets/registry";
import { getCell } from "@/engine/types";
import {
	jointPlaceFromActions,
	stepPly,
	type KernelAction
} from "@/engine/kernel";
import { replayActions } from "@/ir/gameIr";
import { validateConfig } from "@/engine/validateConfig";

describe("schema: turn.schedule simultaneous", () => {
	it("accepts rectangle n-in-a-row simultaneous and rejects gravity", () => {
		const base = examplePresets["tic-tac-toe"].config;
		const ok = zConfig.safeParse({
			...base,
			turn: { mode: "turn", schedule: "simultaneous" }
		});
		expect(ok.success).toBe(true);

		const bad = zConfig.safeParse({
			...base,
			turn: { mode: "turn", schedule: "simultaneous" },
			placement: {
				mode: "gravity",
				gravity: { enabled: true, direction: "down", wrap: false },
				overflow: "reject"
			},
			input: { mode: "column" }
		});
		expect(bad.success).toBe(false);
	});

	it("rejects hex/graph and hit_miss under simultaneous", () => {
		const base = examplePresets["tic-tac-toe"].config;
		const hex = zConfig.safeParse({
			...base,
			grid: { ...base.grid, topology: "hex_offset" },
			turn: { mode: "turn", schedule: "simultaneous" }
		});
		expect(hex.success).toBe(false);

		const hit = zConfig.safeParse({
			...examplePresets["battleship-lite"].config,
			turn: { mode: "turn", schedule: "simultaneous" }
		});
		expect(hit.success).toBe(false);
	});
});

describe("kernel: simultaneous joint place", () => {
	it("lists per-player places and currentPlayer is simultaneous", () => {
		const { kernel, gameConfig } = compileConfig(
			examplePresets["simultaneous-ttt"].config
		);
		expect(gameConfig.turnSchedule).toBe("simultaneous");
		const state = kernel.initialState();
		expect(kernel.currentPlayer(state)).toBe("simultaneous");
		expect(kernel.legalActions(state, 0)).toHaveLength(9);
		expect(kernel.legalActions(state, 1)).toHaveLength(9);
	});

	it("places both stones when cells differ", () => {
		const { kernel } = compileConfig(
			examplePresets["simultaneous-ttt"].config
		);
		let state = kernel.initialState();
		const joint: KernelAction = {
			type: "simultaneousPlace",
			placements: {
				X: { row: 0, col: 0 },
				O: { row: 1, col: 1 }
			}
		};
		const result = kernel.stepSync(state, joint);
		expect(result.events[0]?.type).toBe("actionApplied");
		if (result.events[0]?.type === "actionApplied") {
			expect(result.events[0].player).toBe("simultaneous");
		}
		state = result.nextState;
		expect(getCell(state.grid, { row: 0, col: 0 })).toBe("X");
		expect(getCell(state.grid, { row: 1, col: 1 })).toBe("O");
		expect(state.moveCount).toBe(1);
		expect(kernel.currentPlayer(state)).toBe("simultaneous");
	});

	it("same-cell conflict places neither but advances the round", () => {
		const { kernel } = compileConfig(
			examplePresets["simultaneous-ttt"].config
		);
		let state = kernel.initialState();
		const joint: KernelAction = {
			type: "simultaneousPlace",
			placements: {
				X: { row: 1, col: 1 },
				O: { row: 1, col: 1 }
			}
		};
		const result = kernel.stepSync(state, joint);
		expect(result.events.some((e) => e.type === "actionApplied")).toBe(true);
		state = result.nextState;
		expect(getCell(state.grid, { row: 1, col: 1 })).toBe(null);
		expect(state.moveCount).toBe(1);
		expect(state.status).toBe("playing");
	});

	it("single place is ignored under simultaneous schedule", () => {
		const { kernel } = compileConfig(
			examplePresets["simultaneous-ttt"].config
		);
		const state = kernel.initialState();
		const result = kernel.stepSync(state, {
			type: "place",
			position: { row: 0, col: 0 }
		});
		expect(result.events[0]?.type).toBe("ignored");
		expect(result.nextState.moveCount).toBe(0);
	});

	it("stepJoint builds simultaneousPlace from two places", () => {
		const { kernel } = compileConfig(
			examplePresets["simultaneous-ttt"].config
		);
		const state = kernel.initialState();
		const built = jointPlaceFromActions(
			{ type: "place", position: { row: 0, col: 0 } },
			{ type: "place", position: { row: 2, col: 2 } }
		);
		expect(built?.type).toBe("simultaneousPlace");
		const result = kernel.stepJointSync(state, {
			0: { type: "place", position: { row: 0, col: 0 } },
			1: { type: "place", position: { row: 2, col: 2 } }
		});
		expect(getCell(result.nextState.grid, { row: 0, col: 0 })).toBe("X");
		expect(getCell(result.nextState.grid, { row: 2, col: 2 })).toBe("O");
	});

	it("mutual win in one round is a draw", () => {
		// Seed a board where one more X and O each complete a line.
		const cfg = compileToGameConfig({
			...examplePresets["simultaneous-ttt"].config,
			initial: [
				{ row: 0, col: 0, player: "X" },
				{ row: 0, col: 1, player: "X" },
				{ row: 2, col: 0, player: "O" },
				{ row: 2, col: 1, player: "O" }
			]
		}).gameConfig;
		const { kernel } = compileConfig({
			...examplePresets["simultaneous-ttt"].config,
			initial: [
				{ row: 0, col: 0, player: "X" },
				{ row: 0, col: 1, player: "X" },
				{ row: 2, col: 0, player: "O" },
				{ row: 2, col: 1, player: "O" }
			]
		});
		expect(cfg.turnSchedule).toBe("simultaneous");
		const state = kernel.initialState();
		const result = kernel.stepSync(state, {
			type: "simultaneousPlace",
			placements: {
				X: { row: 0, col: 2 },
				O: { row: 2, col: 2 }
			}
		});
		expect(result.nextState.status).toBe("draw");
		expect(result.nextState.winner).toBe(null);
	});

	it("stepPly advances a simultaneous round via picks", () => {
		const { kernel } = compileConfig(
			examplePresets["simultaneous-ttt"].config
		);
		const state = kernel.initialState();
		const result = stepPly(kernel, state, (player) => ({
			type: "place",
			position: player === 0 ? { row: 0, col: 0 } : { row: 0, col: 1 }
		}));
		expect(result).not.toBeNull();
		expect(getCell(result!.nextState.grid, { row: 0, col: 0 })).toBe("X");
		expect(getCell(result!.nextState.grid, { row: 0, col: 1 })).toBe("O");
	});
});

describe("transcript: Simultaneous TTT", () => {
	it("replays joint places to a win", () => {
		const config = compileToGameConfig(
			examplePresets["simultaneous-ttt"].config
		).gameConfig;
		const actions: KernelAction[] = [
			{
				type: "simultaneousPlace",
				placements: {
					X: { row: 0, col: 0 },
					O: { row: 1, col: 0 }
				}
			},
			{
				type: "simultaneousPlace",
				placements: {
					X: { row: 0, col: 1 },
					O: { row: 1, col: 1 }
				}
			},
			{
				type: "simultaneousPlace",
				placements: {
					X: { row: 0, col: 2 },
					O: { row: 2, col: 0 }
				}
			}
		];
		const replay = replayActions(config, actions, 0);
		expect(replay.faithful).toBe(true);
		expect(replay.finalState.status).toBe("won");
		expect(replay.finalState.winner).toBe("X");
	});
});

describe("validateConfig: simultaneous contract", () => {
	it("accepts Simultaneous TTT preset", () => {
		const result = validateConfig(examplePresets["simultaneous-ttt"].config);
		expect(result.ok).toBe(true);
	});
});
