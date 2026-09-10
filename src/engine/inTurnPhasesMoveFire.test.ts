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

const moveFireBase = () => {
	const base = structuredClone(examplePresets["place-fire-lite"].config);
	return {
		...base,
		turn: {
			mode: "turn" as const,
			schedule: "alternating" as const,
			phases: ["move", "fire"] as ("move" | "fire")[]
		},
		movement: { adjacency: "orthogonal" as const, range: 1 as const },
		initial: [
			{ row: 2, col: 1, player: "X" as const, visibility: "public" as const },
			{ row: 2, col: 3, player: "O" as const, visibility: "public" as const },
			{ row: 0, col: 0, player: "X" as const, visibility: "owner" as const },
			{ row: 0, col: 1, player: "X" as const, visibility: "owner" as const },
			{ row: 4, col: 3, player: "O" as const, visibility: "owner" as const },
			{ row: 4, col: 4, player: "O" as const, visibility: "owner" as const }
		]
	};
};

describe("schema: turn.phases move→fire", () => {
	it("accepts move→fire with hit_miss + destroy_hidden + movement + public seeds", () => {
		expect(zConfig.safeParse(moveFireBase()).success).toBe(true);
	});

	it("rejects move→fire without movement, without public seeds, or with wrong objective", () => {
		const noMove = moveFireBase();
		delete (noMove as { movement?: unknown }).movement;
		expect(zConfig.safeParse(noMove).success).toBe(false);

		expect(
			zConfig.safeParse({
				...moveFireBase(),
				initial: [
					{ row: 0, col: 0, player: "X", visibility: "owner" },
					{ row: 4, col: 4, player: "O", visibility: "owner" }
				]
			}).success
		).toBe(false);

		expect(
			zConfig.safeParse({
				...moveFireBase(),
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
	});

	it("rejects fire→move and move-only sequences", () => {
		expect(
			zConfig.safeParse({
				...moveFireBase(),
				turn: {
					mode: "turn",
					schedule: "alternating",
					phases: ["fire", "move"]
				}
			}).success
		).toBe(false);

		expect(
			zConfig.safeParse({
				...moveFireBase(),
				turn: {
					mode: "turn",
					schedule: "alternating",
					phases: ["move", "move"]
				},
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
	});

	it("validates and compiles the move-fire-lite preset", () => {
		const cfg = examplePresets["move-fire-lite"].config;
		expect(zConfig.safeParse(cfg).success).toBe(true);
		expect(validateConfig(cfg).ok).toBe(true);
		expect(
			buildFeatureContracts(cfg).some((f) => f.id === "ScheduleInTurnPhases")
		).toBe(true);

		const { gameConfig } = compileToGameConfig(cfg);
		expect(gameConfig.turnPhases).toEqual(["move", "fire"]);
		expect(gameConfig.observationMode).toBe("hit_miss");
		expect(gameConfig.objectiveMode).toBe("destroy_hidden");
		expect(gameConfig.movement).toEqual({
			adjacency: "orthogonal",
			range: 1,
			capture: "none"
		});
		expect(gameConfig.inputMode).toBe("cell");
	});
});

describe("kernel: move→fire in-turn phases", () => {
	it("routes legal actions by turnPhaseIndex and rejects wrong_phase", () => {
		const { kernel, gameConfig } = compileConfig(
			examplePresets["move-fire-lite"].config
		);
		let state = kernel.initialState();
		expect(state.turnPhaseIndex).toBe(0);
		expect(gameConfig.turnPhases).toEqual(["move", "fire"]);
		expect(getCell(state.grid, { row: 2, col: 1 })).toBe("X");
		expect(getCell(state.grid, { row: 2, col: 3 })).toBe("O");

		const moveLegal = kernel.legalActions(state, 0);
		expect(moveLegal.length).toBeGreaterThan(0);
		expect(moveLegal.every((a) => a.type === "move")).toBe(true);

		const fireEarly = kernel.explainAction(state, 0, {
			type: "fire",
			position: { row: 1, col: 1 }
		});
		expect(fireEarly.legal).toBe(false);
		if (!fireEarly.legal) expect(fireEarly.reason).toBe("wrong_phase");

		const placeEarly = kernel.explainAction(state, 0, {
			type: "place",
			position: { row: 1, col: 1 }
		});
		expect(placeEarly.legal).toBe(false);
		if (!placeEarly.legal) expect(placeEarly.reason).toBe("wrong_phase");

		const firstMove = moveLegal[0] as Extract<KernelAction, { type: "move" }>;
		const afterMove = kernel.stepSync(state, firstMove);
		state = afterMove.nextState;
		expect(state.turnPhaseIndex).toBe(1);
		expect(state.currentPlayer).toBe("X");
		expect(getCell(state.grid, firstMove.from)).toBeNull();
		expect(getCell(state.grid, firstMove.to)).toBe("X");

		const fireLegal = kernel.legalActions(state, 0);
		expect(fireLegal.length).toBeGreaterThan(0);
		expect(fireLegal.every((a) => a.type === "fire")).toBe(true);

		const moveWhileFire = kernel.explainAction(state, 0, {
			type: "move",
			from: firstMove.to,
			to: { row: firstMove.to.row, col: firstMove.to.col + 1 }
		});
		expect(moveWhileFire.legal).toBe(false);
		if (!moveWhileFire.legal) expect(moveWhileFire.reason).toBe("wrong_phase");

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
			examplePresets["move-fire-lite"].config
		);
		const state = kernel.initialState();
		const xView = observe(gameConfig, state, "X");
		const oView = observe(gameConfig, state, "O");
		expect(xView.cells[2 * 5 + 1]).toBe("X");
		expect(oView.cells[2 * 5 + 1]).toBe("X");
		expect(xView.cells[2 * 5 + 3]).toBe("O");
		expect(oView.cells[2 * 5 + 3]).toBe("O");
		expect(xView.cells[0]).toBe("X");
		expect(oView.cells[4 * 5 + 4]).toBe("O");
	});

	it("wins on fire when opponent fleet is destroyed", () => {
		const { kernel } = compileConfig(examplePresets["move-fire-lite"].config);
		let state = kernel.initialState();

		// X moves spotter then sinks first O fleet cell
		state = kernel.stepSync(state, {
			type: "move",
			from: { row: 2, col: 1 },
			to: { row: 2, col: 0 }
		}).nextState;
		state = kernel.stepSync(state, {
			type: "fire",
			position: { row: 4, col: 3 }
		}).nextState;
		expect(state.status).toBe("playing");
		expect(state.currentPlayer).toBe("O");

		// O moves then misses
		state = kernel.stepSync(state, {
			type: "move",
			from: { row: 2, col: 3 },
			to: { row: 2, col: 4 }
		}).nextState;
		state = kernel.stepSync(state, {
			type: "fire",
			position: { row: 1, col: 1 }
		}).nextState;
		expect(state.currentPlayer).toBe("X");

		// X moves again then sinks remaining O cell
		state = kernel.stepSync(state, {
			type: "move",
			from: { row: 2, col: 0 },
			to: { row: 1, col: 0 }
		}).nextState;
		state = kernel.stepSync(state, {
			type: "fire",
			position: { row: 4, col: 4 }
		}).nextState;
		expect(state.status).toBe("won");
		expect(state.winner).toBe("X");
	});

	it("replays move/fire transcript via GameIR", () => {
		const { gameConfig } = compileConfig(
			examplePresets["move-fire-lite"].config
		);
		const actions: KernelAction[] = [
			{ type: "move", from: { row: 2, col: 1 }, to: { row: 2, col: 0 } },
			{ type: "fire", position: { row: 4, col: 3 } },
			{ type: "move", from: { row: 2, col: 3 }, to: { row: 2, col: 4 } },
			{ type: "fire", position: { row: 1, col: 1 } },
			{ type: "move", from: { row: 2, col: 0 }, to: { row: 1, col: 0 } },
			{ type: "fire", position: { row: 4, col: 4 } }
		];
		const replayed = replayActions(gameConfig, actions, 42);
		expect(replayed.faithful).toBe(true);
		expect(replayed.finalState.status).toBe("won");
		expect(replayed.finalState.winner).toBe("X");
	});
});
