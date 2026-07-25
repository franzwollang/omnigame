import { describe, expect, it } from "vitest";
import { compileConfig } from "@/compiler";
import { observe } from "@/engine/observation";
import { getCell, toIndex } from "@/engine/types";
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
		expect(xView.visible.every(Boolean)).toBe(true);

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

describe("observation fog radius (Fog Connect Lite)", () => {
	it("bootstraps full vision with no own pieces, then fog closes in", () => {
		const { kernel, gameConfig } = compileConfig(
			examplePresets["fog-connect-lite"].config
		);
		const empty = kernel.initialState(42);
		const boot = observe(gameConfig, empty, "X");
		expect(boot.visible.every(Boolean)).toBe(true);
		expect(boot.cells.every((c) => c === null)).toBe(true);

		const placed = kernel.stepSync(empty, {
			type: "place",
			position: { row: 2, col: 2 }
		});
		const state = placed.nextState;
		const xView = observe(gameConfig, state, "X");
		const center = toIndex({ row: 2, col: 2 }, 5);
		expect(xView.cells[center]).toBe("X");
		expect(xView.visible[center]).toBe(true);
		// Chebyshev radius 1 → 3×3 neighborhood visible
		expect(xView.visible[toIndex({ row: 1, col: 1 }, 5)]).toBe(true);
		expect(xView.visible[toIndex({ row: 3, col: 3 }, 5)]).toBe(true);
		// Corner outside radius
		expect(xView.visible[toIndex({ row: 0, col: 0 }, 5)]).toBe(false);
		expect(xView.cells[toIndex({ row: 0, col: 0 }, 5)]).toBe(null);
		// O still has no pieces → full vision bootstrap
		const oView = observe(gameConfig, state, "O");
		expect(oView.visible.every(Boolean)).toBe(true);
		expect(oView.cells[center]).toBe("X");
	});

	it("hides opponent stones outside fog radius", () => {
		const { kernel, gameConfig } = compileConfig(
			examplePresets["fog-connect-lite"].config
		);
		let state = kernel.initialState();
		state = kernel.stepSync(state, {
			type: "place",
			position: { row: 4, col: 0 }
		}).nextState;
		state = kernel.stepSync(state, {
			type: "place",
			position: { row: 0, col: 4 }
		}).nextState;

		const xView = observe(gameConfig, state, "X");
		expect(xView.cells[toIndex({ row: 4, col: 0 }, 5)]).toBe("X");
		expect(xView.visible[toIndex({ row: 0, col: 4 }, 5)]).toBe(false);
		expect(xView.cells[toIndex({ row: 0, col: 4 }, 5)]).toBe(null);

		const oView = observe(gameConfig, state, "O");
		expect(oView.cells[toIndex({ row: 0, col: 4 }, 5)]).toBe("O");
		expect(oView.visible[toIndex({ row: 4, col: 0 }, 5)]).toBe(false);
	});

	it("kernel.observe matches projection; legal play still uses full state", () => {
		const { kernel, gameConfig } = compileConfig(
			examplePresets["fog-connect-lite"].config
		);
		let state = kernel.initialState();
		state = kernel.stepSync(state, {
			type: "place",
			position: { row: 2, col: 2 }
		}).nextState;
		const obs = kernel.observe(state, 0);
		expect(obs).toEqual(observe(gameConfig, state, "X"));
		// Far empty cell remains legal to place even when fogged in view
		const far = { row: 0, col: 0 };
		expect(obs.visible[toIndex(far, 5)]).toBe(false);
		const legal = kernel.legalActions(state, 1);
		expect(legal).toEqual(
			expect.arrayContaining([{ type: "place", position: far }])
		);
	});

	it("replays fog transcript deterministically via GameIR", () => {
		const config = compileConfig(
			examplePresets["fog-connect-lite"].config
		).gameConfig;
		const actions: KernelAction[] = [
			{ type: "place", position: { row: 2, col: 2 } },
			{ type: "place", position: { row: 0, col: 0 } },
			{ type: "place", position: { row: 2, col: 3 } }
		];
		const a = replayActions(config, actions, 7);
		const b = replayActions(config, actions, 7);
		expect(a.faithful).toBe(true);
		expect(a.finalState).toEqual(b.finalState);
		expect(getCell(a.finalState.grid, { row: 2, col: 2 })).toBe("X");
		expect(getCell(a.finalState.grid, { row: 0, col: 0 })).toBe("O");
	});
});
