import { describe, expect, it } from "vitest";
import { compileConfig, compileToGameConfig } from "@/compiler";
import { zConfig } from "@/schemas/config";
import { examplePresets } from "@/presets/registry";
import { getCell } from "@/engine/types";
import { type KernelAction } from "@/engine/kernel";
import { observe } from "@/engine/observation";
import { replayActions } from "@/ir/gameIr";
import {
	buildFeatureContracts,
	validateConfig
} from "@/engine/validateConfig";

const placeFireBase = () => {
	const base = structuredClone(examplePresets["battleship-lite"].config);
	return {
		...base,
		turn: {
			mode: "turn" as const,
			schedule: "alternating" as const,
			phases: ["place", "fire"] as ("place" | "fire")[]
		}
	};
};

describe("schema: turn.phases place→fire", () => {
	it("accepts place→fire with hit_miss + destroy_hidden + seeded fleets", () => {
		expect(zConfig.safeParse(placeFireBase()).success).toBe(true);
	});

	it("rejects place→fire without hit_miss or with fleet / move / triple", () => {
		expect(
			zConfig.safeParse({
				...placeFireBase(),
				observation: { mode: "full" },
				objective: { mode: "n_in_a_row" },
				win: {
					length: 3,
					adjacency: {
						mode: "linear",
						horizontal: true,
						vertical: true,
						backDiagonal: false,
						forwardDiagonal: false
					}
				}
			}).success
		).toBe(false);

		expect(
			zConfig.safeParse({
				...placeFireBase(),
				fleet: { ships: [2, 3] },
				initial: []
			}).success
		).toBe(false);

		expect(
			zConfig.safeParse({
				...placeFireBase(),
				movement: { adjacency: "orthogonal", range: 1 }
			}).success
		).toBe(false);

		expect(
			zConfig.safeParse({
				...placeFireBase(),
				turn: {
					mode: "turn",
					schedule: "alternating",
					phases: ["place", "move", "fire"]
				},
				movement: { adjacency: "orthogonal", range: 1 }
			}).success
		).toBe(false);
	});

	it("validates and compiles the place-fire-lite preset", () => {
		const cfg = examplePresets["place-fire-lite"].config;
		expect(zConfig.safeParse(cfg).success).toBe(true);
		expect(validateConfig(cfg).ok).toBe(true);
		expect(
			buildFeatureContracts(cfg).some((f) => f.id === "ScheduleInTurnPhases")
		).toBe(true);

		const { gameConfig } = compileToGameConfig(cfg);
		expect(gameConfig.turnPhases).toEqual(["place", "fire"]);
		expect(gameConfig.observationMode).toBe("hit_miss");
		expect(gameConfig.objectiveMode).toBe("destroy_hidden");
		expect(gameConfig.inputMode).toBe("cell");
	});
});

describe("kernel: place→fire in-turn phases", () => {
	it("routes legal actions by turnPhaseIndex and rejects wrong_phase", () => {
		const { kernel, gameConfig } = compileConfig(
			examplePresets["place-fire-lite"].config
		);
		let state = kernel.initialState();
		expect(state.turnPhaseIndex).toBe(0);
		expect(gameConfig.turnPhases).toEqual(["place", "fire"]);

		const placeLegal = kernel.legalActions(state, 0);
		expect(placeLegal.length).toBeGreaterThan(0);
		expect(placeLegal.every((a) => a.type === "place")).toBe(true);

		const fireEarly = kernel.explainAction(state, 0, {
			type: "fire",
			position: { row: 2, col: 2 }
		});
		expect(fireEarly.legal).toBe(false);
		if (!fireEarly.legal) expect(fireEarly.reason).toBe("wrong_phase");

		const placePos = (placeLegal[0] as Extract<KernelAction, { type: "place" }>)
			.position;
		const afterPlace = kernel.stepSync(state, {
			type: "place",
			position: placePos
		});
		state = afterPlace.nextState;
		expect(state.turnPhaseIndex).toBe(1);
		expect(state.currentPlayer).toBe("X");
		expect(getCell(state.grid, placePos)).toBe("X");

		const fireLegal = kernel.legalActions(state, 0);
		expect(fireLegal.length).toBeGreaterThan(0);
		expect(fireLegal.every((a) => a.type === "fire")).toBe(true);

		const placeWhileFire = kernel.explainAction(state, 0, {
			type: "place",
			position: { row: 2, col: 2 }
		});
		expect(placeWhileFire.legal).toBe(false);
		if (!placeWhileFire.legal) expect(placeWhileFire.reason).toBe("wrong_phase");

		const firePos = (fireLegal[0] as Extract<KernelAction, { type: "fire" }>)
			.position;
		const afterFire = kernel.stepSync(state, {
			type: "fire",
			position: firePos
		});
		state = afterFire.nextState;
		expect(state.currentPlayer).toBe("O");
		expect(state.turnPhaseIndex).toBe(0);
		expect(afterFire.events.some((e) => e.type === "shotResult")).toBe(true);
	});

	it("shows public spotters in hit_miss observation", () => {
		const { kernel, gameConfig } = compileConfig(
			examplePresets["place-fire-lite"].config
		);
		let state = kernel.initialState();
		state = kernel.stepSync(state, {
			type: "place",
			position: { row: 2, col: 2 }
		}).nextState;

		const xView = observe(gameConfig, state, "X");
		const oView = observe(gameConfig, state, "O");
		expect(xView.cells[2 * 5 + 2]).toBe("X");
		expect(oView.cells[2 * 5 + 2]).toBe("X");
		// Own hidden fleets still projected
		expect(xView.cells[0]).toBe("X");
		expect(oView.cells[4 * 5 + 4]).toBe("O");
	});

	it("wins on fire when opponent fleet is destroyed", () => {
		const { kernel } = compileConfig(
			examplePresets["place-fire-lite"].config
		);
		let state = kernel.initialState();

		// X place then sink O's two-cell fleet at (4,3)(4,4)
		state = kernel.stepSync(state, {
			type: "place",
			position: { row: 2, col: 0 }
		}).nextState;
		state = kernel.stepSync(state, {
			type: "fire",
			position: { row: 4, col: 3 }
		}).nextState;
		expect(state.status).toBe("playing");
		expect(state.currentPlayer).toBe("O");

		state = kernel.stepSync(state, {
			type: "place",
			position: { row: 2, col: 1 }
		}).nextState;
		state = kernel.stepSync(state, {
			type: "fire",
			position: { row: 1, col: 1 }
		}).nextState;
		expect(state.currentPlayer).toBe("X");

		state = kernel.stepSync(state, {
			type: "place",
			position: { row: 2, col: 2 }
		}).nextState;
		state = kernel.stepSync(state, {
			type: "fire",
			position: { row: 4, col: 4 }
		}).nextState;
		expect(state.status).toBe("won");
		expect(state.winner).toBe("X");
	});

	it("replays place/fire transcript via GameIR", () => {
		const { gameConfig } = compileConfig(
			examplePresets["place-fire-lite"].config
		);
		const actions: KernelAction[] = [
			{ type: "place", position: { row: 2, col: 0 } },
			{ type: "fire", position: { row: 4, col: 3 } },
			{ type: "place", position: { row: 2, col: 1 } },
			{ type: "fire", position: { row: 1, col: 1 } },
			{ type: "place", position: { row: 2, col: 2 } },
			{ type: "fire", position: { row: 4, col: 4 } }
		];
		const replayed = replayActions(gameConfig, actions, 42);
		expect(replayed.faithful).toBe(true);
		expect(replayed.finalState.status).toBe("won");
		expect(replayed.finalState.winner).toBe("X");
	});

	it("rejects placing a spotter on a hidden fleet cell", () => {
		const { kernel } = compileConfig(
			examplePresets["place-fire-lite"].config
		);
		const state = kernel.initialState();
		const onShip = kernel.explainAction(state, 0, {
			type: "place",
			position: { row: 0, col: 0 }
		});
		expect(onShip.legal).toBe(false);
	});
});
