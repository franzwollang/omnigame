import { describe, expect, it } from "vitest";
import { compileConfig, compileToGameConfig } from "@/compiler";
import {
	answerQuery,
	candidatesInconsistentWithQuery
} from "@/engine/deduction";
import {
	buildFeatureContracts,
	validateConfig
} from "@/engine/validateConfig";
import { replayActions } from "@/ir/gameIr";
import { examplePresets } from "@/presets/registry";
import { zConfig } from "@/schemas/config";
import type { KernelAction } from "@/engine/kernel";

const ROSTER = [
	{ id: "ann", traits: { glasses: true, hat: false } },
	{ id: "bob", traits: { glasses: false, hat: true } },
	{ id: "cara", traits: { glasses: true, hat: true } },
	{ id: "dan", traits: { glasses: false, hat: false } }
];

const commitPhasesBase = () =>
	structuredClone(examplePresets["guess-who-commit-phases-lite"].config);

describe("schema: deduction turn.phases query→eliminate", () => {
	it("accepts query→eliminate with autoEliminate false + compiles", () => {
		const cfg = commitPhasesBase();
		expect(zConfig.safeParse(cfg).success).toBe(true);
		expect(validateConfig(cfg).ok).toBe(true);
		expect(
			buildFeatureContracts(cfg).some((f) => f.id === "ScheduleInTurnPhases")
		).toBe(true);

		const { gameConfig } = compileToGameConfig(cfg);
		expect(gameConfig.turnPhases).toEqual(["query", "eliminate"]);
		expect(gameConfig.deduction?.autoEliminate).toBe(false);
		expect(gameConfig.inputMode).toBe("deduction");
	});

	it("accepts query→guess and query→eliminate→guess", () => {
		expect(
			zConfig.safeParse({
				...commitPhasesBase(),
				turn: {
					mode: "turn",
					schedule: "alternating",
					phases: ["query", "guess"]
				},
				deduction: {
					...commitPhasesBase().deduction!,
					autoEliminate: true
				}
			}).success
		).toBe(true);

		expect(
			zConfig.safeParse({
				...commitPhasesBase(),
				turn: {
					mode: "turn",
					schedule: "alternating",
					phases: ["query", "eliminate", "guess"]
				}
			}).success
		).toBe(true);
	});

	it("rejects eliminate phases with autoEliminate true", () => {
		expect(
			zConfig.safeParse({
				...commitPhasesBase(),
				deduction: {
					...commitPhasesBase().deduction!,
					autoEliminate: true
				}
			}).success
		).toBe(false);
	});

	it("rejects mixing board + deduction phases and invalid orders", () => {
		expect(
			zConfig.safeParse({
				...commitPhasesBase(),
				turn: {
					mode: "turn",
					schedule: "alternating",
					phases: ["query", "move"]
				}
			}).success
		).toBe(false);

		expect(
			zConfig.safeParse({
				...commitPhasesBase(),
				turn: {
					mode: "turn",
					schedule: "alternating",
					phases: ["eliminate", "query"]
				}
			}).success
		).toBe(false);

		expect(
			zConfig.safeParse({
				...examplePresets["place-move-lite"].config,
				turn: {
					mode: "turn",
					schedule: "alternating",
					phases: ["place", "query"]
				}
			}).success
		).toBe(false);
	});

	it("rejects deduction + place→move (cannot mix families)", () => {
		const cfg = {
			...commitPhasesBase(),
			turn: {
				mode: "turn" as const,
				schedule: "alternating" as const,
				phases: ["place", "move"] as ("place" | "move")[]
			},
			movement: { adjacency: "orthogonal" as const, range: 1 as const },
			objective: { mode: "n_in_a_row" as const },
			observation: { mode: "full" as const },
			win: {
				length: 3,
				adjacency: {
					mode: "linear" as const,
					horizontal: true,
					vertical: true,
					backDiagonal: false,
					forwardDiagonal: false
				}
			}
		};
		// Still has deduction block + identify_secret replaced — keep deduction
		// block so deductionActive fires the mix guard via phases family check.
		expect(zConfig.safeParse(cfg).success).toBe(false);
	});
});

describe("kernel: query→eliminate in-turn phases", () => {
	it("routes legal actions by turnPhaseIndex and rejects wrong_phase", () => {
		const { kernel, gameConfig } = compileConfig(commitPhasesBase());
		let state = kernel.initialState(42);
		expect(state.turnPhaseIndex).toBe(0);
		expect(gameConfig.turnPhases).toEqual(["query", "eliminate"]);

		const queryLegal = kernel.legalActions(state, 0);
		expect(queryLegal.length).toBeGreaterThan(0);
		expect(queryLegal.every((a) => a.type === "query")).toBe(true);

		const elimEarly = kernel.explainAction(state, 0, {
			type: "eliminate",
			id: "ann"
		});
		expect(elimEarly.legal).toBe(false);
		if (!elimEarly.legal) expect(elimEarly.reason).toBe("wrong_phase");

		const guessEarly = kernel.explainAction(state, 0, {
			type: "guess",
			id: "ann"
		});
		expect(guessEarly.legal).toBe(false);
		if (!guessEarly.legal) expect(guessEarly.reason).toBe("wrong_phase");

		const opponentSecret = state.deduction!.secret.O;
		const character = ROSTER.find((c) => c.id === opponentSecret)!;
		const trait = "glasses";
		const value = character.traits.glasses;

		const afterQuery = kernel.stepSync(state, {
			type: "query",
			trait,
			value
		});
		state = afterQuery.nextState;
		expect(state.turnPhaseIndex).toBe(1);
		expect(state.currentPlayer).toBe("X");
		expect(state.deduction!.lastQuery?.answer).toBe(true);
		expect(state.deduction!.eliminated.X).toEqual([]);

		const elimLegal = kernel.legalActions(state, 0);
		expect(elimLegal.every((a) => a.type === "eliminate" || a.type === "guess")).toBe(
			true
		);
		expect(elimLegal.filter((a) => a.type === "eliminate")).toHaveLength(4);
		expect(elimLegal.filter((a) => a.type === "guess")).toHaveLength(4);
		expect(elimLegal.some((a) => a.type === "query")).toBe(false);

		const queryLate = kernel.explainAction(state, 0, {
			type: "query",
			trait: "hat",
			value: true
		});
		expect(queryLate.legal).toBe(false);
		if (!queryLate.legal) expect(queryLate.reason).toBe("wrong_phase");

		const answer = answerQuery(opponentSecret, ROSTER, trait, value);
		const inconsistent = candidatesInconsistentWithQuery(
			ROSTER,
			[],
			trait,
			value,
			answer
		);
		expect(inconsistent.length).toBeGreaterThan(0);
		const target = inconsistent[0]!;

		const afterElim = kernel.stepSync(state, {
			type: "eliminate",
			id: target
		});
		state = afterElim.nextState;
		expect(state.currentPlayer).toBe("O");
		expect(state.turnPhaseIndex).toBe(0);
		expect(state.deduction!.eliminated.X).toEqual([target]);
		expect(
			afterElim.events.some(
				(e) =>
					e.type === "candidateEliminated" &&
					e.player === "X" &&
					e.id === target
			)
		).toBe(true);
	});

	it("same-turn query→eliminate without opponent intervening + GameIR replay", () => {
		const cfg = commitPhasesBase();
		const { kernel, gameConfig } = compileConfig(cfg);
		const state0 = kernel.initialState(cfg.rng.seed);
		const secret = state0.deduction!.secret.O;
		const character = ROSTER.find((c) => c.id === secret)!;
		const trait = "hat";
		const value = character.traits.hat;
		const answer = answerQuery(secret, ROSTER, trait, value);
		const inconsistent = candidatesInconsistentWithQuery(
			ROSTER,
			[],
			trait,
			value,
			answer
		);
		const target = inconsistent.find((id) => id !== secret)!;

		const actions: KernelAction[] = [
			{ type: "query", trait, value },
			{ type: "eliminate", id: target }
		];
		let state = state0;
		for (const action of actions) {
			state = kernel.stepSync(state, action).nextState;
		}
		expect(state.currentPlayer).toBe("O");
		expect(state.turnPhaseIndex).toBe(0);
		expect(state.deduction!.eliminated.X).toEqual([target]);

		const replay = replayActions(gameConfig, actions, cfg.rng.seed);
		expect(replay.finalState.currentPlayer).toBe("O");
		expect(replay.finalState.deduction?.eliminated.X).toEqual([target]);
		expect(replay.finalState.turnPhaseIndex).toBe(0);
	});

	it("correct guess during eliminate phase wins + replay stable", () => {
		const cfg = commitPhasesBase();
		const { kernel, gameConfig } = compileConfig(cfg);
		const state0 = kernel.initialState(cfg.rng.seed);
		const secret = state0.deduction!.secret.O;

		const actions: KernelAction[] = [
			{ type: "query", trait: "glasses", value: true },
			{ type: "guess", id: secret }
		];
		let state = state0;
		for (const action of actions) {
			state = kernel.stepSync(state, action).nextState;
		}
		expect(state.status).toBe("won");
		expect(state.winner).toBe("X");

		const replay = replayActions(gameConfig, actions, cfg.rng.seed);
		expect(replay.finalState.status).toBe("won");
		expect(replay.finalState.winner).toBe("X");
	});
});
