import { describe, expect, it } from "vitest";
import { compileConfig, compileToGameConfig } from "@/compiler";
import { zConfig } from "@/schemas/config";
import { examplePresets } from "@/presets/registry";
import { getCell } from "@/engine/types";
import {
	stepPly,
	type KernelAction
} from "@/engine/kernel";
import { replayActions } from "@/ir/gameIr";
import { validateConfig } from "@/engine/validateConfig";

describe("schema: turn.commitReveal", () => {
	it("accepts simultaneous + commitReveal and rejects without simultaneous", () => {
		const base = examplePresets["tic-tac-toe"].config;
		const ok = zConfig.safeParse({
			...base,
			turn: {
				mode: "turn",
				schedule: "simultaneous",
				commitReveal: true
			}
		});
		expect(ok.success).toBe(true);

		const bad = zConfig.safeParse({
			...base,
			turn: {
				mode: "turn",
				schedule: "alternating",
				commitReveal: true
			}
		});
		expect(bad.success).toBe(false);
	});

	it("rejects commitReveal with hit_miss / gravity like simultaneous", () => {
		const hit = zConfig.safeParse({
			...examplePresets["battleship-lite"].config,
			turn: {
				mode: "turn",
				schedule: "simultaneous",
				commitReveal: true
			}
		});
		expect(hit.success).toBe(false);
	});
});

describe("kernel: hidden simultaneous commit-reveal", () => {
	it("lists commitPlace actions and hides opponent commit in observe", () => {
		const { kernel, gameConfig } = compileConfig(
			examplePresets["hidden-simultaneous-ttt"].config
		);
		expect(gameConfig.commitReveal).toBe(true);
		expect(gameConfig.turnSchedule).toBe("simultaneous");

		let state = kernel.initialState();
		expect(kernel.currentPlayer(state)).toBe("simultaneous");
		const legalX = kernel.legalActions(state, 0);
		expect(legalX.every((a) => a.type === "commitPlace")).toBe(true);
		expect(legalX).toHaveLength(9);

		const result = kernel.stepSync(state, {
			type: "commitPlace",
			player: "X",
			position: { row: 0, col: 0 }
		});
		state = result.nextState;
		expect(state.moveCount).toBe(0);
		expect(state.committedPlacements?.X).toEqual([{ row: 0, col: 0 }]);
		expect(getCell(state.grid, { row: 0, col: 0 })).toBe(null);

		const obsX = kernel.observe(state, 0);
		const obsO = kernel.observe(state, 1);
		expect(obsX.cells[0]).toBe("X"); // own commit overlaid
		expect(obsO.cells[0]).toBe(null); // opponent commit hidden
		expect(kernel.legalActions(state, 0)).toHaveLength(0);
		expect(kernel.legalActions(state, 1)).toHaveLength(9);
	});

	it("second commit reveals jointly and clears commits", () => {
		const { kernel } = compileConfig(
			examplePresets["hidden-simultaneous-ttt"].config
		);
		let state = kernel.initialState();
		state = kernel.stepSync(state, {
			type: "commitPlace",
			player: "X",
			position: { row: 0, col: 0 }
		}).nextState;
		const result = kernel.stepSync(state, {
			type: "commitPlace",
			player: "O",
			position: { row: 1, col: 1 }
		});
		state = result.nextState;
		expect(getCell(state.grid, { row: 0, col: 0 })).toBe("X");
		expect(getCell(state.grid, { row: 1, col: 1 })).toBe("O");
		expect(state.moveCount).toBe(1);
		expect(state.committedPlacements).toBeUndefined();
	});

	it("same-cell conflict places neither after reveal", () => {
		const { kernel } = compileConfig(
			examplePresets["hidden-simultaneous-ttt"].config
		);
		let state = kernel.initialState();
		state = kernel.stepSync(state, {
			type: "commitPlace",
			player: "X",
			position: { row: 1, col: 1 }
		}).nextState;
		state = kernel.stepSync(state, {
			type: "commitPlace",
			player: "O",
			position: { row: 1, col: 1 }
		}).nextState;
		expect(getCell(state.grid, { row: 1, col: 1 })).toBe(null);
		expect(state.moveCount).toBe(1);
		expect(state.status).toBe("playing");
	});

	it("rejects double commit from the same seat", () => {
		const { kernel } = compileConfig(
			examplePresets["hidden-simultaneous-ttt"].config
		);
		let state = kernel.initialState();
		state = kernel.stepSync(state, {
			type: "commitPlace",
			player: "X",
			position: { row: 0, col: 0 }
		}).nextState;
		const explained = kernel.explainAction(state, 0, {
			type: "commitPlace",
			player: "X",
			position: { row: 0, col: 1 }
		});
		expect(explained.legal).toBe(false);
		if (!explained.legal) {
			expect(explained.reason).toBe("already_committed");
		}
		const ignored = kernel.stepSync(state, {
			type: "commitPlace",
			player: "X",
			position: { row: 0, col: 1 }
		});
		expect(ignored.events[0]?.type).toBe("ignored");
	});

	it("stepPly completes a full commit-reveal round", () => {
		const { kernel } = compileConfig(
			examplePresets["hidden-simultaneous-ttt"].config
		);
		const state = kernel.initialState();
		const result = stepPly(kernel, state, (player) => ({
			type: "commitPlace",
			player: player === 0 ? "X" : "O",
			position: player === 0 ? { row: 0, col: 0 } : { row: 0, col: 1 }
		}));
		expect(result).not.toBeNull();
		expect(getCell(result!.nextState.grid, { row: 0, col: 0 })).toBe("X");
		expect(getCell(result!.nextState.grid, { row: 0, col: 1 })).toBe("O");
		expect(result!.nextState.moveCount).toBe(1);
	});
});

describe("transcript: Hidden Simultaneous TTT", () => {
	it("replays commitPlace sequence to a win", () => {
		const config = compileToGameConfig(
			examplePresets["hidden-simultaneous-ttt"].config
		).gameConfig;
		const actions: KernelAction[] = [
			{
				type: "commitPlace",
				player: "X",
				position: { row: 0, col: 0 }
			},
			{
				type: "commitPlace",
				player: "O",
				position: { row: 1, col: 0 }
			},
			{
				type: "commitPlace",
				player: "X",
				position: { row: 0, col: 1 }
			},
			{
				type: "commitPlace",
				player: "O",
				position: { row: 1, col: 1 }
			},
			{
				type: "commitPlace",
				player: "X",
				position: { row: 0, col: 2 }
			},
			{
				type: "commitPlace",
				player: "O",
				position: { row: 2, col: 0 }
			}
		];
		const replay = replayActions(config, actions, 0);
		expect(replay.faithful).toBe(true);
		expect(replay.finalState.status).toBe("won");
		expect(replay.finalState.winner).toBe("X");
	});
});

describe("validateConfig: commit-reveal contract", () => {
	it("accepts Hidden Simultaneous TTT preset", () => {
		const result = validateConfig(
			examplePresets["hidden-simultaneous-ttt"].config
		);
		expect(result.ok).toBe(true);
	});
});
