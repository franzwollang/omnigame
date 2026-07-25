import { describe, expect, it } from "vitest";
import { compileConfig } from "@/compiler";
import { observe } from "@/engine/observation";
import { getCell } from "@/engine/types";
import { examplePresets } from "@/presets/registry";
import { replayActions } from "@/ir/gameIr";
import type { KernelAction } from "@/engine/kernel";

describe("observation hit/miss (Battleship-lite)", () => {
	it("hides opponent fleet until hit; reveals own ships", () => {
		const { kernel, gameConfig } = compileConfig(
			examplePresets["battleship-lite"].config
		);
		const state = kernel.initialState(42);
		expect(state.hidden).toBeDefined();
		expect(getCell(state.hidden!, { row: 0, col: 0 })).toBe("X");
		expect(getCell(state.hidden!, { row: 4, col: 4 })).toBe("O");
		// Public grid starts empty
		expect(state.grid.cells.every((c) => c === null)).toBe(true);

		const xView = observe(gameConfig, state, "X");
		expect(xView.cells[0]).toBe("X"); // own ship at (0,0)
		expect(xView.cells[1]).toBe("X"); // own ship at (0,1)
		const oShipIdx = 4 * 5 + 4;
		expect(xView.cells[oShipIdx]).toBe(null); // opponent hidden

		const oView = observe(gameConfig, state, "O");
		expect(oView.cells[oShipIdx]).toBe("O");
		expect(oView.cells[0]).toBe(null);
	});

	it("fire yields hit/miss events and asymmetric observations", () => {
		const { kernel } = compileConfig(
			examplePresets["battleship-lite"].config
		);
		let state = kernel.initialState();
		const legal = kernel.legalActions(state, 0);
		expect(legal.some((a) => a.type === "fire")).toBe(true);
		expect(legal.every((a) => a.type === "fire")).toBe(true);

		// X fires at O ship (4,4)
		const hit = kernel.stepSync(state, {
			type: "fire",
			position: { row: 4, col: 4 }
		});
		expect(hit.events.map((e) => e.type)).toEqual([
			"actionApplied",
			"shotResult"
		]);
		expect(hit.events[1]).toMatchObject({
			type: "shotResult",
			result: "hit",
			position: { row: 4, col: 4 }
		});
		state = hit.nextState;
		expect(getCell(state.grid, { row: 4, col: 4 })).toBe("hit");

		// Both players see the hit; X still cannot see O's other ship
		expect(hit.observations[0].cells[4 * 5 + 4]).toBe("hit");
		expect(hit.observations[1].cells[4 * 5 + 4]).toBe("hit");
		expect(hit.observations[0].cells[4 * 5 + 3]).toBe(null);

		// O fires miss at water
		const miss = kernel.stepSync(state, {
			type: "fire",
			position: { row: 2, col: 2 }
		});
		expect(miss.events).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ type: "shotResult", result: "miss" })
			])
		);
		state = miss.nextState;
		expect(getCell(state.grid, { row: 2, col: 2 })).toBe("miss");
	});

	it("cannot fire on own fleet; sink wins destroy_hidden", () => {
		const { kernel } = compileConfig(
			examplePresets["battleship-lite"].config
		);
		let state = kernel.initialState();

		// Own ship fire is illegal
		const own = kernel.stepSync(state, {
			type: "fire",
			position: { row: 0, col: 0 }
		});
		expect(own.events[0]?.type).toBe("ignored");
		expect(own.nextState).toBe(state);

		// Sink both O ships
		state = kernel.stepSync(state, {
			type: "fire",
			position: { row: 4, col: 3 }
		}).nextState;
		// O fires somewhere harmless
		state = kernel.stepSync(state, {
			type: "fire",
			position: { row: 1, col: 1 }
		}).nextState;
		const win = kernel.stepSync(state, {
			type: "fire",
			position: { row: 4, col: 4 }
		});
		expect(win.terminal).toBe(true);
		expect(win.nextState.status).toBe("won");
		expect(win.nextState.winner).toBe("X");
		expect(win.events.some((e) => e.type === "terminal")).toBe(true);
	});

	it("replays fire transcript deterministically via GameIR", () => {
		const config = compileConfig(
			examplePresets["battleship-lite"].config
		).gameConfig;
		const actions: KernelAction[] = [
			{ type: "fire", position: { row: 4, col: 3 } },
			{ type: "fire", position: { row: 1, col: 1 } },
			{ type: "fire", position: { row: 4, col: 4 } }
		];
		const a = replayActions(config, actions, 42);
		const b = replayActions(config, actions, 42);
		expect(a.faithful).toBe(true);
		expect(a.finalState).toEqual(b.finalState);
		expect(a.finalState.status).toBe("won");
		expect(a.finalState.winner).toBe("X");
	});
});
