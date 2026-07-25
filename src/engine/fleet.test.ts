import { describe, expect, it } from "vitest";
import { compileConfig } from "@/compiler";
import {
	isValidShipExtension,
	fleetCellsRequired
} from "@/engine/fleet";
import { getCell } from "@/engine/types";
import { examplePresets } from "@/presets/registry";
import { replayActions } from "@/ir/gameIr";
import type { KernelAction } from "@/engine/kernel";
import { validateConfig } from "@/engine/validateConfig";

describe("fleet placement helpers", () => {
	it("validates contiguous orthogonal ship extension", () => {
		expect(isValidShipExtension([], { row: 1, col: 1 })).toBe(true);
		expect(
			isValidShipExtension([{ row: 1, col: 1 }], { row: 1, col: 2 })
		).toBe(true);
		expect(
			isValidShipExtension([{ row: 1, col: 1 }], { row: 2, col: 2 })
		).toBe(false);
		expect(
			isValidShipExtension(
				[
					{ row: 1, col: 1 },
					{ row: 1, col: 2 }
				],
				{ row: 1, col: 3 }
			)
		).toBe(true);
		expect(
			isValidShipExtension(
				[
					{ row: 1, col: 1 },
					{ row: 1, col: 2 }
				],
				{ row: 1, col: 0 }
			)
		).toBe(true);
		expect(
			isValidShipExtension(
				[
					{ row: 1, col: 1 },
					{ row: 1, col: 2 }
				],
				{ row: 2, col: 2 }
			)
		).toBe(false);
	});

	it("sums fleet cells", () => {
		expect(fleetCellsRequired({ ships: [2, 3] })).toBe(5);
	});
});

describe("observation placement phase (Battleship Place)", () => {
	it("starts in placement with place actions; fire is illegal", () => {
		const { kernel } = compileConfig(
			examplePresets["battleship-place"].config
		);
		const state = kernel.initialState(42);
		expect(state.phase).toBe("placement");
		expect(state.hidden).toBeDefined();
		expect(state.fleetProgress?.X.done).toBe(false);

		const legal = kernel.legalActions(state, 0);
		expect(legal.length).toBe(25);
		expect(legal.every((a) => a.type === "place")).toBe(true);

		const fire = kernel.stepSync(state, {
			type: "fire",
			position: { row: 0, col: 0 }
		});
		expect(fire.events[0]).toMatchObject({
			type: "ignored",
			reason: "wrong_phase"
		});
	});

	it("places contiguous ships then enters combat with phaseChanged", () => {
		const { kernel } = compileConfig(
			examplePresets["battleship-place"].config
		);
		let state = kernel.initialState();

		// X ship length 2: (0,0)-(0,1)
		state = kernel.stepSync(state, {
			type: "place",
			position: { row: 0, col: 0 }
		}).nextState;
		expect(state.currentPlayer).toBe("X"); // still placing
		state = kernel.stepSync(state, {
			type: "place",
			position: { row: 0, col: 1 }
		}).nextState;
		expect(state.fleetProgress?.X.shipIndex).toBe(1);

		// Start length-3 ship, then reject a bent second cell
		state = kernel.stepSync(state, {
			type: "place",
			position: { row: 2, col: 0 }
		}).nextState;
		const bad = kernel.stepSync(state, {
			type: "place",
			position: { row: 3, col: 1 }
		});
		expect(bad.events[0]?.type).toBe("ignored");
		expect(
			(bad.events[0] as { reason?: string }).reason
		).toBe("ship_shape");

		// Finish X ship length 3: (2,0)-(2,1)-(2,2)
		state = kernel.stepSync(state, {
			type: "place",
			position: { row: 2, col: 1 }
		}).nextState;
		state = kernel.stepSync(state, {
			type: "place",
			position: { row: 2, col: 2 }
		}).nextState;
		expect(state.fleetProgress?.X.done).toBe(true);
		expect(state.currentPlayer).toBe("O");
		expect(state.phase).toBe("placement");

		// O ships: (4,0)-(4,1) and (3,2)-(3,3)-(3,4)
		const oPlaces: KernelAction[] = [
			{ type: "place", position: { row: 4, col: 0 } },
			{ type: "place", position: { row: 4, col: 1 } },
			{ type: "place", position: { row: 3, col: 2 } },
			{ type: "place", position: { row: 3, col: 3 } },
			{ type: "place", position: { row: 3, col: 4 } }
		];
		let last = kernel.stepSync(state, oPlaces[0]!);
		for (let i = 1; i < oPlaces.length; i++) {
			last = kernel.stepSync(last.nextState, oPlaces[i]!);
		}
		expect(last.nextState.phase).toBe("combat");
		expect(last.nextState.currentPlayer).toBe("X");
		expect(last.events.some((e) => e.type === "phaseChanged")).toBe(true);
		expect(
			last.events.find((e) => e.type === "phaseChanged")
		).toMatchObject({ type: "phaseChanged", phase: "combat" });

		state = last.nextState;
		expect(getCell(state.hidden!, { row: 0, col: 0 })).toBe("X");
		expect(getCell(state.hidden!, { row: 3, col: 4 })).toBe("O");

		const combatLegal = kernel.legalActions(state, 0);
		expect(combatLegal.every((a) => a.type === "fire")).toBe(true);
		expect(combatLegal.some((a) => a.type === "place")).toBe(false);
	});

	it("sinks after placement via fire transcript", () => {
		const config = compileConfig(
			examplePresets["battleship-place"].config
		).gameConfig;
		const actions: KernelAction[] = [
			// X: 2+3
			{ type: "place", position: { row: 0, col: 0 } },
			{ type: "place", position: { row: 0, col: 1 } },
			{ type: "place", position: { row: 1, col: 0 } },
			{ type: "place", position: { row: 2, col: 0 } },
			{ type: "place", position: { row: 3, col: 0 } },
			// O: 2+3
			{ type: "place", position: { row: 4, col: 4 } },
			{ type: "place", position: { row: 4, col: 3 } },
			{ type: "place", position: { row: 4, col: 0 } },
			{ type: "place", position: { row: 4, col: 1 } },
			{ type: "place", position: { row: 4, col: 2 } },
			// Combat: sink O (5 cells on row 4... wait O has (4,4)(4,3) and (4,0)(4,1)(4,2) — all on row 4)
			{ type: "fire", position: { row: 4, col: 0 } },
			{ type: "fire", position: { row: 0, col: 4 } }, // O miss
			{ type: "fire", position: { row: 4, col: 1 } },
			{ type: "fire", position: { row: 1, col: 4 } },
			{ type: "fire", position: { row: 4, col: 2 } },
			{ type: "fire", position: { row: 2, col: 4 } },
			{ type: "fire", position: { row: 4, col: 3 } },
			{ type: "fire", position: { row: 3, col: 4 } },
			{ type: "fire", position: { row: 4, col: 4 } }
		];
		const result = replayActions(config, actions, 42);
		expect(result.faithful).toBe(true);
		expect(result.finalState.phase).toBe("combat");
		expect(result.finalState.status).toBe("won");
		expect(result.finalState.winner).toBe("X");
	});

	it("validates fleet schema vs owner seeds", () => {
		const ok = validateConfig(examplePresets["battleship-place"].config);
		expect(ok.ok).toBe(true);

		const both = validateConfig({
			...examplePresets["battleship-place"].config,
			initial: [
				{ row: 0, col: 0, player: "X", visibility: "owner" }
			]
		});
		expect(both.ok).toBe(false);
		expect(both.errors.some((e) => e.includes("fleet"))).toBe(true);

		const fixed = validateConfig(examplePresets["battleship-lite"].config);
		expect(fixed.ok).toBe(true);
	});
});
