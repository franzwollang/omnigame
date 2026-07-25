import { describe, expect, it } from "vitest";
import { compileConfig, compileToGameConfig } from "@/compiler";
import { zConfig } from "@/schemas/config";
import { examplePresets } from "@/presets/registry";
import { getCell } from "@/engine/types";
import { stepPly, type KernelAction } from "@/engine/kernel";
import { replayActions } from "@/ir/gameIr";
import { validateConfig } from "@/engine/validateConfig";

describe("schema: placement.delayTurns", () => {
	it("accepts alternating n-in-a-row with delayTurns 1", () => {
		const base = examplePresets["tic-tac-toe"].config;
		const ok = zConfig.safeParse({
			...base,
			placement: { ...base.placement, delayTurns: 1 }
		});
		expect(ok.success).toBe(true);
	});

	it("rejects delayTurns with simultaneous, multi-step, or gravity", () => {
		const base = examplePresets["tic-tac-toe"].config;
		const withSim = zConfig.safeParse({
			...base,
			turn: { mode: "turn", schedule: "simultaneous" },
			placement: { ...base.placement, delayTurns: 1 }
		});
		expect(withSim.success).toBe(false);

		const withMulti = zConfig.safeParse({
			...base,
			turn: { mode: "turn", schedule: "alternating", actionsPerTurn: 2 },
			placement: { ...base.placement, delayTurns: 1 }
		});
		expect(withMulti.success).toBe(false);

		const withGravity = zConfig.safeParse({
			...base,
			input: { mode: "column" },
			placement: {
				mode: "gravity",
				gravity: { enabled: true, direction: "down", wrap: false },
				overflow: "reject",
				delayTurns: 1
			}
		});
		expect(withGravity.success).toBe(false);
	});

	it("rejects hex under delayed place foothold", () => {
		const base = examplePresets["tic-tac-toe"].config;
		const hex = zConfig.safeParse({
			...base,
			grid: { ...base.grid, topology: "hex_offset" },
			placement: { ...base.placement, delayTurns: 1 }
		});
		expect(hex.success).toBe(false);
	});
});

describe("kernel: delayed place queue + resolve", () => {
	it("queues on place and materializes after one intervening place", () => {
		const { kernel, gameConfig } = compileConfig(
			examplePresets["delayed-ttt"].config
		);
		expect(gameConfig.delayTurns).toBe(1);
		let state = kernel.initialState();
		expect(state.pendingPlaces).toBeUndefined();

		const first = kernel.stepSync(state, {
			type: "place",
			position: { row: 0, col: 0 }
		});
		expect(first.events[0]?.type).toBe("actionApplied");
		state = first.nextState;
		expect(getCell(state.grid, { row: 0, col: 0 })).toBeNull();
		expect(state.pendingPlaces).toHaveLength(1);
		expect(state.pendingPlaces?.[0]).toMatchObject({
			player: "X",
			position: { row: 0, col: 0 },
			resolveAt: 2
		});
		expect(state.currentPlayer).toBe("O");
		expect(state.moveCount).toBe(1);

		state = kernel.stepSync(state, {
			type: "place",
			position: { row: 1, col: 1 }
		}).nextState;
		expect(getCell(state.grid, { row: 0, col: 0 })).toBe("X");
		expect(getCell(state.grid, { row: 1, col: 1 })).toBeNull();
		expect(state.pendingPlaces).toHaveLength(1);
		expect(state.pendingPlaces?.[0]?.player).toBe("O");
		expect(state.currentPlayer).toBe("X");
	});

	it("reserves pending cells (illegal to place)", () => {
		const { kernel } = compileConfig(examplePresets["delayed-ttt"].config);
		let state = kernel.initialState();
		state = kernel.stepSync(state, {
			type: "place",
			position: { row: 0, col: 0 }
		}).nextState;
		const explained = kernel.explainAction(state, 1, {
			type: "place",
			position: { row: 0, col: 0 }
		});
		expect(explained.legal).toBe(false);
		if (explained.legal === false) {
			expect(explained.reason).toBe("cell_occupied");
		}
		const ignored = kernel.stepSync(state, {
			type: "place",
			position: { row: 0, col: 0 }
		});
		expect(ignored.events[0]?.type).toBe("ignored");
		expect(ignored.nextState.moveCount).toBe(state.moveCount);
	});

	it("wins when a resolved line completes", () => {
		const { kernel } = compileConfig(examplePresets["delayed-ttt"].config);
		let state = kernel.initialState();
		// X queues (0,0); O queues (1,0) → X lands; X queues (0,1); O queues (1,1) → X lands (0,1);
		// X queues (0,2); O queues (2,0) → X lands (0,2) → X wins top row
		const places: Array<{ row: number; col: number }> = [
			{ row: 0, col: 0 },
			{ row: 1, col: 0 },
			{ row: 0, col: 1 },
			{ row: 1, col: 1 },
			{ row: 0, col: 2 },
			{ row: 2, col: 0 }
		];
		for (const position of places) {
			state = kernel.stepSync(state, { type: "place", position }).nextState;
		}
		expect(state.status).toBe("won");
		expect(state.winner).toBe("X");
		expect(getCell(state.grid, { row: 0, col: 0 })).toBe("X");
		expect(getCell(state.grid, { row: 0, col: 1 })).toBe("X");
		expect(getCell(state.grid, { row: 0, col: 2 })).toBe("X");
	});

	it("flushes remaining pending when the board has no free cells", () => {
		const { kernel } = compileConfig(examplePresets["delayed-ttt"].config);
		let state = kernel.initialState();
		// Fill all 9 cells as intents; last place should flush the final pending.
		const order = [
			[0, 0],
			[0, 1],
			[0, 2],
			[1, 0],
			[1, 1],
			[1, 2],
			[2, 0],
			[2, 1],
			[2, 2]
		] as const;
		for (const [row, col] of order) {
			state = kernel.stepSync(state, {
				type: "place",
				position: { row, col }
			}).nextState;
		}
		expect(state.pendingPlaces ?? []).toHaveLength(0);
		expect(state.grid.cells.every((c) => c !== null)).toBe(true);
		expect(state.status === "won" || state.status === "draw").toBe(true);
	});

	it("stepPly + GameIR replay stay deterministic", () => {
		const { kernel } = compileConfig(examplePresets["delayed-ttt"].config);
		let state = kernel.initialState();
		const actions: KernelAction[] = [];
		const picks = [
			{ row: 0, col: 0 },
			{ row: 1, col: 1 },
			{ row: 0, col: 1 },
			{ row: 2, col: 2 }
		];
		for (const position of picks) {
			const result = stepPly(kernel, state, () => ({
				type: "place",
				position
			}));
			expect(result).not.toBeNull();
			state = result!.nextState;
			actions.push({ type: "place", position });
		}
		const replayed = replayActions(kernel, actions, 0);
		expect(replayed.grid.cells).toEqual(state.grid.cells);
		expect(replayed.pendingPlaces).toEqual(state.pendingPlaces);
		expect(replayed.currentPlayer).toBe(state.currentPlayer);
	});

	it("preset validates and compiles with PlacementDelayed contract", () => {
		const cfg = examplePresets["delayed-ttt"].config;
		const v = validateConfig(cfg);
		expect(v.ok).toBe(true);
		const game = compileToGameConfig(cfg);
		expect(game.delayTurns).toBe(1);
	});
});
