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

const tripleBase = () =>
	structuredClone(examplePresets["place-move-fire-lite"].config);

describe("schema: turn.phases place→move→fire", () => {
	it("accepts place→move→fire with connect_or_destroy + hit_miss + movement + win", () => {
		expect(zConfig.safeParse(tripleBase()).success).toBe(true);
	});

	it("rejects triple without movement, win, or with destroy_hidden / fleet", () => {
		const noMove = tripleBase();
		delete (noMove as { movement?: unknown }).movement;
		expect(zConfig.safeParse(noMove).success).toBe(false);

		const noWin = tripleBase();
		delete (noWin as { win?: unknown }).win;
		expect(zConfig.safeParse(noWin).success).toBe(false);

		expect(
			zConfig.safeParse({
				...tripleBase(),
				objective: { mode: "destroy_hidden" }
			}).success
		).toBe(false);

		expect(
			zConfig.safeParse({
				...tripleBase(),
				fleet: { ships: [2] },
				initial: []
			}).success
		).toBe(false);

		expect(
			zConfig.safeParse({
				...tripleBase(),
				turn: {
					mode: "turn",
					schedule: "alternating",
					phases: ["place", "fire", "move"]
				}
			}).success
		).toBe(false);
	});

	it("rejects connect_or_destroy without the triple phases", () => {
		expect(
			zConfig.safeParse({
				...examplePresets["place-fire-lite"].config,
				objective: { mode: "connect_or_destroy" },
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
	});

	it("validates and compiles the place-move-fire-lite preset", () => {
		const cfg = examplePresets["place-move-fire-lite"].config;
		expect(zConfig.safeParse(cfg).success).toBe(true);
		expect(validateConfig(cfg).ok).toBe(true);
		const contracts = buildFeatureContracts(cfg);
		expect(contracts.some((f) => f.id === "ScheduleInTurnPhases")).toBe(true);
		expect(contracts.some((f) => f.id === "ConnectOrDestroy")).toBe(true);
		expect(contracts.some((f) => f.id === "NInARow")).toBe(false);
		expect(contracts.some((f) => f.id === "DestroyHidden")).toBe(false);

		const { gameConfig } = compileToGameConfig(cfg);
		expect(gameConfig.turnPhases).toEqual(["place", "move", "fire"]);
		expect(gameConfig.observationMode).toBe("hit_miss");
		expect(gameConfig.objectiveMode).toBe("connect_or_destroy");
		expect(gameConfig.movement?.range).toBe(1);
		expect(gameConfig.winLength).toBe(3);
	});
});

describe("kernel: place→move→fire dual-objective phases", () => {
	it("routes legal actions place→move→fire and rejects wrong_phase", () => {
		const { kernel, gameConfig } = compileConfig(
			examplePresets["place-move-fire-lite"].config
		);
		let state = kernel.initialState();
		expect(state.turnPhaseIndex).toBe(0);
		expect(gameConfig.turnPhases).toEqual(["place", "move", "fire"]);

		const placeLegal = kernel.legalActions(state, 0);
		expect(placeLegal.length).toBeGreaterThan(0);
		expect(placeLegal.every((a) => a.type === "place")).toBe(true);

		const fireEarly = kernel.explainAction(state, 0, {
			type: "fire",
			position: { row: 2, col: 2 }
		});
		expect(fireEarly.legal).toBe(false);
		if (!fireEarly.legal) expect(fireEarly.reason).toBe("wrong_phase");

		const placePos = (
			placeLegal[0] as Extract<KernelAction, { type: "place" }>
		).position;
		state = kernel.stepSync(state, {
			type: "place",
			position: placePos
		}).nextState;
		expect(state.turnPhaseIndex).toBe(1);
		expect(state.currentPlayer).toBe("X");
		expect(getCell(state.grid, placePos)).toBe("X");

		const moveLegal = kernel.legalActions(state, 0);
		expect(moveLegal.length).toBeGreaterThan(0);
		expect(moveLegal.every((a) => a.type === "move")).toBe(true);

		const placeWhileMove = kernel.explainAction(state, 0, {
			type: "place",
			position: { row: 2, col: 2 }
		});
		expect(placeWhileMove.legal).toBe(false);
		if (!placeWhileMove.legal) expect(placeWhileMove.reason).toBe("wrong_phase");

		const move = moveLegal[0] as Extract<KernelAction, { type: "move" }>;
		state = kernel.stepSync(state, {
			type: "move",
			from: move.from,
			to: move.to
		}).nextState;
		expect(state.turnPhaseIndex).toBe(2);
		expect(state.currentPlayer).toBe("X");

		const fireLegal = kernel.legalActions(state, 0);
		expect(fireLegal.length).toBeGreaterThan(0);
		expect(fireLegal.every((a) => a.type === "fire")).toBe(true);

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

	it("shows public stones in hit_miss observation after place and move", () => {
		const { kernel, gameConfig } = compileConfig(
			examplePresets["place-move-fire-lite"].config
		);
		let state = kernel.initialState();
		state = kernel.stepSync(state, {
			type: "place",
			position: { row: 2, col: 2 }
		}).nextState;
		state = kernel.stepSync(state, {
			type: "move",
			from: { row: 2, col: 2 },
			to: { row: 2, col: 3 }
		}).nextState;

		const xView = observe(gameConfig, state, "X");
		const oView = observe(gameConfig, state, "O");
		expect(xView.cells[2 * 5 + 3]).toBe("X");
		expect(oView.cells[2 * 5 + 3]).toBe("X");
		expect(xView.cells[0]).toBe("X");
		expect(oView.cells[4 * 5 + 4]).toBe("O");
	});

	it("wins on place when n-in-a-row completes (connect leg)", () => {
		const cfg = {
			...tripleBase(),
			grid: { width: 3, height: 3, topology: "rectangle" as const, wrap: false },
			win: {
				length: 3,
				adjacency: {
					mode: "linear" as const,
					horizontal: true,
					vertical: true,
					backDiagonal: false,
					forwardDiagonal: false
				}
			},
			initial: [
				{ row: 0, col: 0, player: "X" as const, visibility: "owner" as const },
				{ row: 2, col: 2, player: "O" as const, visibility: "owner" as const },
				{ row: 1, col: 0, player: "X" as const, visibility: "public" as const },
				{ row: 1, col: 1, player: "X" as const, visibility: "public" as const }
			]
		};
		const { kernel } = compileConfig(cfg);
		const state = kernel.stepSync(kernel.initialState(), {
			type: "place",
			position: { row: 1, col: 2 }
		}).nextState;
		expect(state.status).toBe("won");
		expect(state.winner).toBe("X");
	});

	it("wins on move when n-in-a-row completes", () => {
		const cfg = {
			...tripleBase(),
			grid: { width: 3, height: 3, topology: "rectangle" as const, wrap: false },
			win: {
				length: 3,
				adjacency: {
					mode: "linear" as const,
					horizontal: true,
					vertical: true,
					backDiagonal: false,
					forwardDiagonal: false
				}
			},
			initial: [
				{ row: 0, col: 0, player: "X" as const, visibility: "owner" as const },
				{ row: 2, col: 2, player: "O" as const, visibility: "owner" as const },
				{ row: 1, col: 0, player: "X" as const, visibility: "public" as const },
				{ row: 1, col: 1, player: "X" as const, visibility: "public" as const },
				{ row: 0, col: 2, player: "X" as const, visibility: "public" as const }
			]
		};
		const { kernel } = compileConfig(cfg);
		let state = kernel.initialState();
		state = kernel.stepSync(state, {
			type: "place",
			position: { row: 2, col: 0 }
		}).nextState;
		expect(state.turnPhaseIndex).toBe(1);
		state = kernel.stepSync(state, {
			type: "move",
			from: { row: 0, col: 2 },
			to: { row: 1, col: 2 }
		}).nextState;
		expect(state.status).toBe("won");
		expect(state.winner).toBe("X");
	});

	it("wins on fire when opponent fleet is destroyed (destroy leg)", () => {
		const { kernel } = compileConfig(
			examplePresets["place-move-fire-lite"].config
		);
		let state = kernel.initialState();

		const playTurn = (
			place: { row: number; col: number },
			moveTo: { row: number; col: number },
			fire: { row: number; col: number }
		) => {
			state = kernel.stepSync(state, { type: "place", position: place })
				.nextState;
			state = kernel.stepSync(state, {
				type: "move",
				from: place,
				to: moveTo
			}).nextState;
			state = kernel.stepSync(state, { type: "fire", position: fire }).nextState;
		};

		playTurn({ row: 2, col: 0 }, { row: 3, col: 0 }, { row: 4, col: 3 });
		expect(state.status).toBe("playing");
		expect(state.currentPlayer).toBe("O");

		playTurn({ row: 2, col: 1 }, { row: 3, col: 1 }, { row: 1, col: 1 });
		expect(state.currentPlayer).toBe("X");

		playTurn({ row: 2, col: 2 }, { row: 3, col: 2 }, { row: 4, col: 4 });
		expect(state.status).toBe("won");
		expect(state.winner).toBe("X");
	});

	it("replays place/move/fire sink transcript via GameIR", () => {
		const { gameConfig } = compileConfig(
			examplePresets["place-move-fire-lite"].config
		);
		const actions: KernelAction[] = [
			{ type: "place", position: { row: 2, col: 0 } },
			{ type: "move", from: { row: 2, col: 0 }, to: { row: 3, col: 0 } },
			{ type: "fire", position: { row: 4, col: 3 } },
			{ type: "place", position: { row: 2, col: 1 } },
			{ type: "move", from: { row: 2, col: 1 }, to: { row: 3, col: 1 } },
			{ type: "fire", position: { row: 1, col: 1 } },
			{ type: "place", position: { row: 2, col: 2 } },
			{ type: "move", from: { row: 2, col: 2 }, to: { row: 3, col: 2 } },
			{ type: "fire", position: { row: 4, col: 4 } }
		];
		const replayed = replayActions(gameConfig, actions, 42);
		expect(replayed.faithful).toBe(true);
		expect(replayed.finalState.status).toBe("won");
		expect(replayed.finalState.winner).toBe("X");
	});
});
