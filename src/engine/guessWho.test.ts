import { describe, expect, it } from "vitest";
import { compileConfig, compileToGameConfig } from "@/compiler";
import {
	answerQuery,
	assignSecrets,
	eliminateAfterQuery
} from "@/engine/deduction";
import { observe } from "@/engine/observation";
import { validateConfig } from "@/engine/validateConfig";
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

describe("Guess Who Lite schema", () => {
	it("accepts the guess-who-lite preset", () => {
		const cfg = examplePresets["guess-who-lite"].config;
		expect(zConfig.safeParse(cfg).success).toBe(true);
		expect(validateConfig(cfg).ok).toBe(true);
		const { gameConfig } = compileToGameConfig(cfg);
		expect(gameConfig.inputMode).toBe("deduction");
		expect(gameConfig.observationMode).toBe("deduction");
		expect(gameConfig.objectiveMode).toBe("identify_secret");
		expect(gameConfig.deduction?.roster).toHaveLength(4);
		expect(gameConfig.seed).toBe(42);
	});

	it("rejects missing deduction block and mismatched modes", () => {
		const base = examplePresets["guess-who-lite"].config;
		const missingBlock = {
			...base,
			deduction: undefined
		};
		expect(zConfig.safeParse(missingBlock).success).toBe(false);

		const mismatched = {
			...base,
			observation: { mode: "full" as const }
		};
		expect(zConfig.safeParse(mismatched).success).toBe(false);
	});
});

describe("deduction helpers", () => {
	it("assignSecrets yields distinct deterministic secrets from seed", () => {
		const a = assignSecrets(
			ROSTER.map((c) => c.id),
			42
		);
		const b = assignSecrets(
			ROSTER.map((c) => c.id),
			42
		);
		expect(a).toEqual(b);
		expect(a.X).not.toBe(a.O);
		expect(ROSTER.map((c) => c.id)).toContain(a.X);
		expect(ROSTER.map((c) => c.id)).toContain(a.O);
	});
});

describe("Guess Who Lite play", () => {
	it("initialState assigns distinct deterministic secrets from seed", () => {
		const cfg = examplePresets["guess-who-lite"].config;
		const { kernel, gameConfig } = compileConfig(cfg);
		const state = kernel.initialState(cfg.rng.seed);
		expect(state.deduction).toBeDefined();
		expect(state.deduction!.secret.X).not.toBe(state.deduction!.secret.O);
		const expected = assignSecrets(
			gameConfig.deduction!.roster.map((c) => c.id),
			42
		);
		expect(state.deduction!.secret).toEqual(expected);
	});

	it("query matching trait → answer true + eliminates inconsistent candidates", () => {
		const cfg = examplePresets["guess-who-lite"].config;
		const { kernel } = compileConfig(cfg);
		const state0 = kernel.initialState(cfg.rng.seed);
		const opponentSecret = state0.deduction!.secret.O;
		const character = ROSTER.find((c) => c.id === opponentSecret)!;
		const trait = "glasses";
		const value = character.traits.glasses;
		const expectedAnswer = answerQuery(
			opponentSecret,
			ROSTER,
			trait,
			value
		);
		expect(expectedAnswer).toBe(true);

		const step = kernel.stepSync(state0, {
			type: "query",
			trait,
			value
		});
		expect(step.nextState.deduction!.lastQuery).toEqual({
			by: "X",
			trait,
			value,
			answer: true
		});
		const eliminated = step.nextState.deduction!.eliminated.X;
		const pruned = eliminateAfterQuery(ROSTER, [], trait, value, true);
		expect(eliminated).toEqual(pruned);
		expect(eliminated.length).toBeGreaterThan(0);
		expect(eliminated).not.toContain(opponentSecret);

		const obs = observe(kernel.config, step.nextState, "X");
		expect(obs.deduction?.lastQuery?.answer).toBe(true);
		expect(obs.deduction?.eliminated).toEqual(eliminated);
		const obsO = observe(kernel.config, step.nextState, "O");
		expect(obsO.deduction?.lastQuery).toBeUndefined();

		expect(
			step.events.some(
				(e) => e.type === "queryAnswered" && e.answer === true
			)
		).toBe(true);
	});

	it("query non-matching → answer false + different pruning", () => {
		const cfg = examplePresets["guess-who-lite"].config;
		const { kernel } = compileConfig(cfg);
		const state0 = kernel.initialState(cfg.rng.seed);
		const opponentSecret = state0.deduction!.secret.O;
		const character = ROSTER.find((c) => c.id === opponentSecret)!;
		const trait = "hat";
		const value = !character.traits.hat;
		expect(
			answerQuery(opponentSecret, ROSTER, trait, value)
		).toBe(false);

		const step = kernel.stepSync(state0, {
			type: "query",
			trait,
			value
		});
		expect(step.nextState.deduction!.lastQuery?.answer).toBe(false);
		const eliminated = step.nextState.deduction!.eliminated.X;
		expect(eliminated).toEqual(
			eliminateAfterQuery(ROSTER, [], trait, value, false)
		);
		expect(eliminated).not.toContain(opponentSecret);
	});

	it("wrong guess + wrongGuess lose → opponent wins", () => {
		const cfg = examplePresets["guess-who-lite"].config;
		const { kernel } = compileConfig(cfg);
		const state0 = kernel.initialState(cfg.rng.seed);
		const secret = state0.deduction!.secret.O;
		const wrongId = ROSTER.map((c) => c.id).find((id) => id !== secret)!;
		const step = kernel.stepSync(state0, { type: "guess", id: wrongId });
		expect(step.nextState.status).toBe("won");
		expect(step.nextState.winner).toBe("O");
		expect(
			step.events.some(
				(e) =>
					e.type === "guessResult" &&
					e.correct === false &&
					e.targetId === wrongId
			)
		).toBe(true);
	});

	it("correct guess → querier wins; replayActions transcript stable", () => {
		const cfg = examplePresets["guess-who-lite"].config;
		const { kernel, gameConfig } = compileConfig(cfg);
		const state0 = kernel.initialState(cfg.rng.seed);
		const secret = state0.deduction!.secret.O;
		const step = kernel.stepSync(state0, { type: "guess", id: secret });
		expect(step.nextState.status).toBe("won");
		expect(step.nextState.winner).toBe("X");
		expect(
			step.events.some(
				(e) => e.type === "guessResult" && e.correct === true
			)
		).toBe(true);

		const actions: KernelAction[] = [{ type: "guess", id: secret }];
		const replay = replayActions(gameConfig, actions, cfg.rng.seed);
		expect(replay.finalState.status).toBe("won");
		expect(replay.finalState.winner).toBe("X");
		expect(replay.finalState.deduction?.secret).toEqual(
			state0.deduction!.secret
		);
	});

	it("legalActions include trait queries and non-eliminated guesses", () => {
		const cfg = examplePresets["guess-who-lite"].config;
		const { kernel } = compileConfig(cfg);
		const state = kernel.initialState(cfg.rng.seed);
		const legal = kernel.legalActions(state, 0);
		expect(
			legal.filter((a) => a.type === "query")
		).toHaveLength(4); // 2 traits × 2 values
		expect(legal.filter((a) => a.type === "guess")).toHaveLength(4);
	});
});
