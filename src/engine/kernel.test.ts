import { describe, expect, it } from "vitest";
import { compileConfig, compileToGameConfig } from "@/compiler";
import {
	formatKernelEvent,
	highlightCellsForActions,
	playerIdOf,
	type KernelAction
} from "@/engine/kernel";
import { examplePresets } from "@/presets/registry";
import { getCell } from "@/engine/types";

describe("GameKernel scaffold", () => {
	it("lists legal cell placements for Tic-Tac-Toe and steps to a win", () => {
		const { kernel } = compileConfig(examplePresets["tic-tac-toe"].config);
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
		const { kernel } = compileConfig(examplePresets["connect-4"].config);
		let state = kernel.initialState();
		expect(kernel.legalActions(state, 0)).toHaveLength(7);

		const drop: KernelAction = { type: "activateColumn", col: 3 };
		const result = kernel.stepSync(state, drop);
		state = result.nextState;
		expect(getCell(state.grid, { row: 5, col: 3 })).toBe("X");
		expect(result.events.some((e) => e.type === "actionApplied")).toBe(true);
	});

	it("lists column activations for Connect 4 gravity-up", () => {
		const { kernel, gameConfig } = compileConfig(
			examplePresets["connect-4-up"].config
		);
		expect(gameConfig.gravityDirection).toBe("up");
		let state = kernel.initialState();
		expect(kernel.legalActions(state, 0)).toHaveLength(7);

		const drop: KernelAction = { type: "activateColumn", col: 3 };
		const result = kernel.stepSync(state, drop);
		state = result.nextState;
		expect(getCell(state.grid, { row: 0, col: 3 })).toBe("X");
	});

	it("lists row activations for Connect 4 gravity-right", () => {
		const { kernel, gameConfig } = compileConfig(
			examplePresets["connect-4-right"].config
		);
		expect(gameConfig.gravityDirection).toBe("right");
		expect(gameConfig.inputMode).toBe("row");
		let state = kernel.initialState();
		expect(kernel.legalActions(state, 0)).toHaveLength(6);

		const drop: KernelAction = { type: "activateRow", row: 2 };
		const result = kernel.stepSync(state, drop);
		state = result.nextState;
		expect(getCell(state.grid, { row: 2, col: 6 })).toBe("X");
	});

	it("includes pop-out actions when overflow is enabled", () => {
		const { kernel } = compileConfig(
			examplePresets["connect-4-popout"].config
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

	it("includes top pop-out actions for gravity-up overflow", () => {
		const { kernel } = compileConfig(
			examplePresets["connect-4-up-popout"].config
		);
		let state = kernel.initialState();
		state = kernel.stepSync(state, { type: "activateColumn", col: 0 }).nextState;
		state = kernel.stepSync(state, { type: "activateColumn", col: 1 }).nextState;
		// X's piece sits at top (row 0) of col 0 under gravity up
		expect(getCell(state.grid, { row: 0, col: 0 })).toBe("X");
		const legal = kernel.legalActions(state, 0);
		expect(legal.some((a) => a.type === "popOutColumn" && a.col === 0)).toBe(
			true
		);
		state = kernel.stepSync(state, { type: "popOutColumn", col: 0 }).nextState;
		expect(getCell(state.grid, { row: 0, col: 0 })).toBe(null);
		expect(getCell(state.grid, { row: 5, col: 0 })).toBe(null);
	});

	it("shifts column toward exit when popping from top", () => {
		const { kernel } = compileConfig(
			examplePresets["connect-4-up-popout"].config
		);
		let state = kernel.initialState();
		// Fill col 0: X, O, X rise to top
		state = kernel.stepSync(state, { type: "activateColumn", col: 0 }).nextState;
		state = kernel.stepSync(state, { type: "activateColumn", col: 0 }).nextState;
		state = kernel.stepSync(state, { type: "activateColumn", col: 0 }).nextState;
		expect(getCell(state.grid, { row: 0, col: 0 })).toBe("X");
		expect(getCell(state.grid, { row: 1, col: 0 })).toBe("O");
		expect(getCell(state.grid, { row: 2, col: 0 })).toBe("X");
		// O's turn — pop own top piece is illegal (top is X); O activates elsewhere
		const oExplain = kernel.explainAction(state, 1, {
			type: "popOutColumn",
			col: 0
		});
		expect(oExplain.legal).toBe(false);
		if (!oExplain.legal) {
			expect(oExplain.reason).toBe("no_own_piece");
		}
		state = kernel.stepSync(state, { type: "activateColumn", col: 1 }).nextState;
		// X pops top of col 0 → O slides to row 0, X to row 1
		state = kernel.stepSync(state, { type: "popOutColumn", col: 0 }).nextState;
		expect(getCell(state.grid, { row: 0, col: 0 })).toBe("O");
		expect(getCell(state.grid, { row: 1, col: 0 })).toBe("X");
		expect(getCell(state.grid, { row: 2, col: 0 })).toBe(null);
	});

	it("marks illegal steps as ignored without mutating state", () => {
		const { kernel } = compileConfig(examplePresets["tic-tac-toe"].config);
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
			reason: "cell_occupied"
		});
		expect(again.nextState).toBe(first.nextState);
	});

	it("explainAction reports cell_occupied and game_over", () => {
		const { kernel } = compileConfig(examplePresets["tic-tac-toe"].config);
		let state = kernel.initialState();
		state = kernel.stepSync(state, {
			type: "place",
			position: { row: 0, col: 0 }
		}).nextState;
		const occupied = kernel.explainAction(state, 1, {
			type: "place",
			position: { row: 0, col: 0 }
		});
		expect(occupied.legal).toBe(false);
		if (!occupied.legal) {
			expect(occupied.reason).toBe("cell_occupied");
		}

		const script: KernelAction[] = [
			{ type: "place", position: { row: 1, col: 0 } },
			{ type: "place", position: { row: 0, col: 1 } },
			{ type: "place", position: { row: 1, col: 1 } },
			{ type: "place", position: { row: 0, col: 2 } }
		];
		for (const action of script) {
			state = kernel.stepSync(state, action).nextState;
		}
		expect(state.status).toBe("won");
		const over = kernel.explainAction(state, 0, {
			type: "place",
			position: { row: 2, col: 2 }
		});
		expect(over.legal).toBe(false);
		if (!over.legal) expect(over.reason).toBe("game_over");
	});

	it("highlightCellsForActions maps place and column drops", () => {
		const { kernel } = compileConfig(examplePresets["connect-4"].config);
		const state = kernel.initialState();
		const legal = kernel.legalActions(state, 0);
		const cells = highlightCellsForActions(state, legal);
		expect(cells).toHaveLength(7);
		expect(cells.every((c) => c.row === 0)).toBe(true);
	});

	it("highlightCellsForActions uses bottom entry for gravity-up", () => {
		const { kernel } = compileConfig(examplePresets["connect-4-up"].config);
		const state = kernel.initialState();
		const legal = kernel.legalActions(state, 0);
		const cells = highlightCellsForActions(state, legal, {
			gravityDirection: "up"
		});
		expect(cells).toHaveLength(7);
		expect(cells.every((c) => c.row === 5)).toBe(true);
	});

	it("highlightCellsForActions uses left entry for gravity-right", () => {
		const { kernel } = compileConfig(
			examplePresets["connect-4-right"].config
		);
		const state = kernel.initialState();
		const legal = kernel.legalActions(state, 0);
		const cells = highlightCellsForActions(state, legal, {
			gravityDirection: "right"
		});
		expect(cells).toHaveLength(6);
		expect(cells.every((c) => c.col === 0)).toBe(true);
	});

	it("emits a terminal event on win and formats event lines", () => {
		const { kernel } = compileConfig(examplePresets["tic-tac-toe"].config);
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

describe("compileToGameConfig defaults", () => {
	it("returns engine defaults when config is null", () => {
		const { gameConfig } = compileToGameConfig(null);
		expect(gameConfig.gridWidth).toBe(3);
		expect(gameConfig.inputMode).toBe("cell");
		expect(gameConfig.overflow).toBe("reject");
		expect(gameConfig.initial).toEqual([]);
	});
});
