import { describe, expect, it } from "vitest";
import { compileConfig, compileToGameConfig } from "@/compiler";
import { zConfig } from "@/schemas/config";
import { examplePresets } from "@/presets/registry";
import { getCell } from "@/engine/types";
import { stepPly, type KernelAction } from "@/engine/kernel";
import { replayActions } from "@/ir/gameIr";
import { validateConfig } from "@/engine/validateConfig";

describe("schema: delayed gravity", () => {
	it("accepts Connect 4 + delayTurns", () => {
		const base = examplePresets["connect-4"].config;
		const ok = zConfig.safeParse({
			...base,
			placement: { ...base.placement, delayTurns: 1 }
		});
		expect(ok.success).toBe(true);
	});

	it("rejects delayed gravity with pop-out overflow", () => {
		const base = examplePresets["connect-4-popout"].config;
		const bad = zConfig.safeParse({
			...base,
			placement: { ...base.placement, delayTurns: 1 }
		});
		expect(bad.success).toBe(false);
	});

	it("rejects delayed gravity with simultaneous", () => {
		const base = examplePresets["connect-4"].config;
		const bad = zConfig.safeParse({
			...base,
			turn: { mode: "turn", schedule: "simultaneous" },
			placement: { ...base.placement, delayTurns: 1 }
		});
		expect(bad.success).toBe(false);
	});
});

describe("kernel: delayed gravity column intents", () => {
	it("queues column intent and settles after one intervening drop", () => {
		const { kernel, gameConfig } = compileConfig(
			examplePresets["delayed-connect-4"].config
		);
		expect(gameConfig.delayTurns).toBe(1);
		expect(gameConfig.gravityDirection).toBe("down");
		let state = kernel.initialState();

		const first = kernel.stepSync(state, { type: "activateColumn", col: 3 });
		expect(first.events[0]?.type).toBe("actionApplied");
		state = first.nextState;
		// Board unchanged; intent queued
		expect(state.grid.cells.every((c) => c === null)).toBe(true);
		expect(state.pendingPlaces).toHaveLength(1);
		expect(state.pendingPlaces?.[0]).toMatchObject({
			player: "X",
			kind: "column",
			col: 3,
			resolveAt: 2
		});
		expect(state.currentPlayer).toBe("O");
		expect(state.moveCount).toBe(1);

		// O drops in same column — still queues; then X's prior intent settles
		state = kernel.stepSync(state, {
			type: "activateColumn",
			col: 3
		}).nextState;
		expect(getCell(state.grid, { row: 5, col: 3 })).toBe("X");
		expect(getCell(state.grid, { row: 4, col: 3 })).toBeNull();
		expect(state.pendingPlaces).toHaveLength(1);
		expect(state.pendingPlaces?.[0]).toMatchObject({
			player: "O",
			kind: "column",
			col: 3
		});
		expect(state.currentPlayer).toBe("X");
	});

	it("settles at current gravity landing after intervening drops elsewhere", () => {
		const { kernel } = compileConfig(
			examplePresets["delayed-connect-4"].config
		);
		let state = kernel.initialState();
		// X queues col 0; O queues col 1 → X lands bottom of col 0
		state = kernel.stepSync(state, { type: "activateColumn", col: 0 }).nextState;
		state = kernel.stepSync(state, { type: "activateColumn", col: 1 }).nextState;
		expect(getCell(state.grid, { row: 5, col: 0 })).toBe("X");
		expect(getCell(state.grid, { row: 5, col: 1 })).toBeNull();

		// X queues col 0 again; O queues col 2 → X lands stacked above prior X
		state = kernel.stepSync(state, { type: "activateColumn", col: 0 }).nextState;
		state = kernel.stepSync(state, { type: "activateColumn", col: 2 }).nextState;
		expect(getCell(state.grid, { row: 4, col: 0 })).toBe("X");
		expect(getCell(state.grid, { row: 5, col: 0 })).toBe("X");
	});

	it("reserves column slots (illegal when over-committed)", () => {
		const raw = {
			...examplePresets["delayed-connect-4"].config,
			placement: {
				...examplePresets["delayed-connect-4"].config.placement,
				delayTurns: 8
			}
		};
		const { kernel } = compileConfig(raw);
		let state = kernel.initialState();
		// Queue six intents on one column (height 6) before any resolve
		for (let i = 0; i < 6; i++) {
			const result = kernel.stepSync(state, {
				type: "activateColumn",
				col: 0
			});
			expect(result.events[0]?.type).toBe("actionApplied");
			state = result.nextState;
		}
		expect(state.pendingPlaces).toHaveLength(6);
		const explained = kernel.explainAction(state, 0, {
			type: "activateColumn",
			col: 0
		});
		expect(explained.legal).toBe(false);
		if (explained.legal === false) {
			expect(explained.reason).toBe("column_full");
		}
		const legal = kernel.legalActions(state, 0);
		expect(
			legal.some((a) => a.type === "activateColumn" && a.col === 0)
		).toBe(false);
		expect(
			legal.some((a) => a.type === "activateColumn" && a.col === 1)
		).toBe(true);
	});

	it("wins when resolved gravity line completes", () => {
		const { kernel } = compileConfig(
			examplePresets["delayed-connect-4"].config
		);
		let state = kernel.initialState();
		// X queues cols 0–3 with O parking in col 6; each intervening drop
		// lands the prior X disc on the bottom row → four-in-a-row.
		const cols = [0, 6, 1, 6, 2, 6, 3, 6];
		for (const col of cols) {
			state = kernel.stepSync(state, { type: "activateColumn", col }).nextState;
			if (state.status !== "playing") break;
		}
		expect(state.status).toBe("won");
		expect(state.winner).toBe("X");
		expect(getCell(state.grid, { row: 5, col: 0 })).toBe("X");
		expect(getCell(state.grid, { row: 5, col: 1 })).toBe("X");
		expect(getCell(state.grid, { row: 5, col: 2 })).toBe("X");
		expect(getCell(state.grid, { row: 5, col: 3 })).toBe("X");
	});

	it("stepPly + GameIR replay stay deterministic", () => {
		const { kernel, gameConfig } = compileConfig(
			examplePresets["delayed-connect-4"].config
		);
		let state = kernel.initialState();
		const actions: KernelAction[] = [];
		const picks = [2, 3, 2, 4, 2];
		for (const col of picks) {
			const result = stepPly(kernel, state, () => ({
				type: "activateColumn",
				col
			}));
			expect(result).not.toBeNull();
			state = result!.nextState;
			actions.push({ type: "activateColumn", col });
		}
		const replayed = replayActions(gameConfig, actions, 0);
		expect(replayed.faithful).toBe(true);
		expect(replayed.finalState.grid.cells).toEqual(state.grid.cells);
		expect(replayed.finalState.pendingPlaces).toEqual(state.pendingPlaces);
		expect(replayed.finalState.currentPlayer).toBe(state.currentPlayer);
	});

	it("preset validates and compiles with PlacementDelayed contract", () => {
		const cfg = examplePresets["delayed-connect-4"].config;
		const v = validateConfig(cfg);
		expect(v.ok).toBe(true);
		expect(cfg.placement.delayTurns).toBe(1);
		const game = compileToGameConfig(cfg).gameConfig;
		expect(game.delayTurns).toBe(1);
		expect(game.gravityDirection).toBe("down");
	});
});
