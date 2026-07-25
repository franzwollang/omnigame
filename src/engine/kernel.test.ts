import { describe, expect, it } from "vitest";
import { toGameConfig } from "@/engine/toGameConfig";
import {
	createGameKernel,
	formatKernelEvent,
	playerIdOf,
	type KernelAction
} from "@/engine/kernel";
import { examplePresets } from "@/presets/registry";
import { getCell } from "@/engine/types";

describe("toGameConfig", () => {
	it("maps sandbox Config fields without any-casts", () => {
		const cfg = toGameConfig(examplePresets["connect-4-popout"].config);
		expect(cfg.gridWidth).toBe(7);
		expect(cfg.gridHeight).toBe(6);
		expect(cfg.inputMode).toBe("column");
		expect(cfg.placementMode).toBe("gravity");
		expect(cfg.overflow).toBe("pop_out_bottom");
		expect(cfg.gravityDirection).toBe("down");
		expect(cfg.captureEnabled).toBe(false);
	});

	it("defaults when config is null", () => {
		const cfg = toGameConfig(null);
		expect(cfg.gridWidth).toBe(3);
		expect(cfg.inputMode).toBe("cell");
		expect(cfg.overflow).toBe("reject");
		expect(cfg.initial).toEqual([]);
	});

	it("maps capture demo initial seeds", () => {
		const cfg = toGameConfig(examplePresets.reversi.config);
		expect(cfg.captureEnabled).toBe(true);
		expect(cfg.initial?.length).toBeGreaterThan(0);
	});
});

describe("GameKernel scaffold", () => {
	it("lists legal cell placements for Tic-Tac-Toe and steps to a win", () => {
		const kernel = createGameKernel(
			toGameConfig(examplePresets["tic-tac-toe"].config)
		);
		let state = kernel.initialState(1);
		expect(kernel.legalActions(state, 0)).toHaveLength(9);

		const script: KernelAction[] = [
			{ type: "place", position: { row: 0, col: 0 } },
			{ type: "place", position: { row: 1, col: 0 } },
			{ type: "place", position: { row: 0, col: 1 } },
			{ type: "place", position: { row: 1, col: 1 } },
			{ type: "place", position: { row: 0, col: 2 } }
		];

		for (const action of script) {
			const player = playerIdOf(state.currentPlayer);
			expect(
				kernel.legalActions(state, player).some(
					(a) =>
						a.type === "place" &&
						a.position.row === (action as { position: { row: number } }).position
							.row &&
						a.position.col === (action as { position: { col: number } }).position
							.col
				)
			).toBe(true);
			const result = kernel.stepSync(state, action);
			expect(result.events[0]?.type).toBe("actionApplied");
			state = result.nextState;
		}

		expect(state.status).toBe("won");
		expect(state.winner).toBe("X");
		expect(kernel.legalActions(state, 0)).toEqual([]);
	});

	it("lists column activations for Connect 4 gravity", () => {
		const kernel = createGameKernel(
			toGameConfig(examplePresets["connect-4"].config)
		);
		let state = kernel.initialState();
		expect(kernel.legalActions(state, 0)).toHaveLength(7);

		const drop: KernelAction = { type: "activateColumn", col: 3 };
		const result = kernel.stepSync(state, drop);
		state = result.nextState;
		expect(getCell(state.grid, { row: 5, col: 3 })).toBe("X");
		expect(result.events.some((e) => e.type === "actionApplied")).toBe(true);
	});

	it("includes pop-out actions when overflow is enabled", () => {
		const kernel = createGameKernel(
			toGameConfig(examplePresets["connect-4-popout"].config)
		);
		let state = kernel.initialState();
		state = kernel.stepSync(state, { type: "activateColumn", col: 0 }).nextState;
		// O drops elsewhere
		state = kernel.stepSync(state, { type: "activateColumn", col: 1 }).nextState;
		// X can pop column 0 (bottom is X)
		const legal = kernel.legalActions(state, 0);
		expect(legal.some((a) => a.type === "popOutColumn" && a.col === 0)).toBe(
			true
		);
		state = kernel.stepSync(state, { type: "popOutColumn", col: 0 }).nextState;
		expect(getCell(state.grid, { row: 5, col: 0 })).toBe(null);
	});

	it("marks illegal steps as ignored without mutating state", () => {
		const kernel = createGameKernel(
			toGameConfig(examplePresets["tic-tac-toe"].config)
		);
		const state = kernel.initialState();
		const first = kernel.stepSync(state, {
			type: "place",
			position: { row: 0, col: 0 }
		});
		const again = kernel.stepSync(first.nextState, {
			type: "place",
			position: { row: 0, col: 0 }
		});
		expect(again.events[0]).toEqual({
			type: "ignored",
			action: { type: "place", position: { row: 0, col: 0 } },
			reason: "illegal_or_noop"
		});
		expect(again.nextState).toBe(first.nextState);
	});

	it("emits a terminal event on win and formats event lines", () => {
		const kernel = createGameKernel(
			toGameConfig(examplePresets["tic-tac-toe"].config)
		);
		let state = kernel.initialState();
		const moves: KernelAction[] = [
			{ type: "place", position: { row: 0, col: 0 } },
			{ type: "place", position: { row: 1, col: 0 } },
			{ type: "place", position: { row: 0, col: 1 } },
			{ type: "place", position: { row: 1, col: 1 } }
		];
		for (const action of moves) {
			state = kernel.stepSync(state, action).nextState;
		}
		const win = kernel.stepSync(state, {
			type: "place",
			position: { row: 0, col: 2 }
		});
		expect(win.events.map((e) => e.type)).toEqual([
			"actionApplied",
			"terminal"
		]);
		expect(formatKernelEvent(win.events[0]!)).toBe("X: place (0,2)");
		expect(formatKernelEvent(win.events[1]!)).toBe("terminal: X wins");
	});
});
