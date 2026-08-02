import { describe, expect, it } from "vitest";
import { compileConfig, compileToGameConfig } from "@/compiler";
import {
	answerQuery,
	candidatesInconsistentWithQuery,
	canEliminate,
	eliminateAfterQuery
} from "@/engine/deduction";
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

describe("Guess Who Commit Lite schema", () => {
	it("accepts autoEliminate false + compiles", () => {
		const cfg = examplePresets["guess-who-commit-lite"].config;
		expect(zConfig.safeParse(cfg).success).toBe(true);
		expect(validateConfig(cfg).ok).toBe(true);
		const { gameConfig } = compileToGameConfig(cfg);
		expect(gameConfig.deduction?.autoEliminate).toBe(false);
		expect(gameConfig.deduction?.wrongGuess).toBe("end_turn");
	});

	it("defaults autoEliminate true for Guess Who Lite", () => {
		const cfg = examplePresets["guess-who-lite"].config;
		const { gameConfig } = compileToGameConfig(cfg);
		expect(gameConfig.deduction?.autoEliminate).toBe(true);
	});
});

describe("deduction commit helpers", () => {
	it("candidatesInconsistentWithQuery matches eliminateAfterQuery delta", () => {
		const inconsistent = candidatesInconsistentWithQuery(
			ROSTER,
			[],
			"glasses",
			true,
			true
		);
		expect(inconsistent).toEqual(
			eliminateAfterQuery(ROSTER, [], "glasses", true, true)
		);
		expect(canEliminate(ROSTER, [], "ann")).toBe(true);
		expect(canEliminate(ROSTER, ["ann"], "ann")).toBe(false);
		expect(canEliminate(ROSTER, [], "nobody")).toBe(false);
	});
});

describe("Guess Who Commit Lite play", () => {
	it("query with autoEliminate false records answer without pruning", () => {
		const cfg = examplePresets["guess-who-commit-lite"].config;
		const { kernel } = compileConfig(cfg);
		const state0 = kernel.initialState(cfg.rng.seed);
		const opponentSecret = state0.deduction!.secret.O;
		const character = ROSTER.find((c) => c.id === opponentSecret)!;
		const trait = "glasses";
		const value = character.traits.glasses;

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
		expect(step.nextState.deduction!.eliminated.X).toEqual([]);
		expect(
			step.events.some(
				(e) => e.type === "queryAnswered" && e.answer === true
			)
		).toBe(true);
		// Turn handed to O after query
		expect(step.nextState.currentPlayer).toBe("O");
	});

	it("eliminate after query prunes one candidate + emits candidateEliminated", () => {
		const cfg = examplePresets["guess-who-commit-lite"].config;
		const { kernel } = compileConfig(cfg);
		const state0 = kernel.initialState(cfg.rng.seed);
		const opponentSecret = state0.deduction!.secret.O;
		const character = ROSTER.find((c) => c.id === opponentSecret)!;
		const trait = "glasses";
		const value = character.traits.glasses;
		const answer = answerQuery(opponentSecret, ROSTER, trait, value);

		// X queries
		const afterQuery = kernel.stepSync(state0, {
			type: "query",
			trait,
			value
		});
		// O passes a query to return to X (any legal query)
		const afterO = kernel.stepSync(afterQuery.nextState, {
			type: "query",
			trait: "hat",
			value: true
		});
		expect(afterO.nextState.currentPlayer).toBe("X");

		const inconsistent = candidatesInconsistentWithQuery(
			ROSTER,
			[],
			trait,
			value,
			answer
		);
		expect(inconsistent.length).toBeGreaterThan(0);
		const target = inconsistent[0]!;
		expect(target).not.toBe(opponentSecret);

		const step = kernel.stepSync(afterO.nextState, {
			type: "eliminate",
			id: target
		});
		expect(step.nextState.deduction!.eliminated.X).toEqual([target]);
		expect(
			step.events.some(
				(e) =>
					e.type === "candidateEliminated" &&
					e.player === "X" &&
					e.id === target
			)
		).toBe(true);
	});

	it("illegal eliminate (already eliminated / unknown / auto on) → noop", () => {
		const cfg = examplePresets["guess-who-commit-lite"].config;
		const { kernel } = compileConfig(cfg);
		const state0 = kernel.initialState(cfg.rng.seed);

		const unknown = kernel.stepSync(state0, {
			type: "eliminate",
			id: "nobody"
		});
		expect(unknown.nextState).toEqual(state0);
		expect(unknown.events.some((e) => e.type === "ignored")).toBe(true);

		const first = kernel.stepSync(state0, {
			type: "eliminate",
			id: "ann"
		});
		expect(first.nextState.deduction!.eliminated.X).toEqual(["ann"]);
		// O turn — give back to X with a noop-ish query path
		const back = kernel.stepSync(first.nextState, {
			type: "eliminate",
			id: "bob"
		});
		expect(back.nextState.currentPlayer).toBe("X");
		const dup = kernel.stepSync(back.nextState, {
			type: "eliminate",
			id: "ann"
		});
		expect(dup.nextState.deduction!.eliminated.X).toEqual(
			back.nextState.deduction!.eliminated.X
		);
		expect(dup.events.some((e) => e.type === "ignored")).toBe(true);

		// autoEliminate true: eliminate is mode_mismatch / ignored
		const autoCfg = examplePresets["guess-who-lite"].config;
		const { kernel: autoKernel } = compileConfig(autoCfg);
		const autoState = autoKernel.initialState(autoCfg.rng.seed);
		const autoStep = autoKernel.stepSync(autoState, {
			type: "eliminate",
			id: "ann"
		});
		expect(autoStep.nextState).toEqual(autoState);
		expect(autoStep.events.some((e) => e.type === "ignored")).toBe(true);
	});

	it("correct guess after manual eliminate → win + GameIR replay stable", () => {
		const cfg = examplePresets["guess-who-commit-lite"].config;
		const { kernel, gameConfig } = compileConfig(cfg);
		const state0 = kernel.initialState(cfg.rng.seed);
		const secret = state0.deduction!.secret.O;
		const wrongId = ROSTER.map((c) => c.id).find((id) => id !== secret)!;

		const actions: KernelAction[] = [
			{ type: "eliminate", id: wrongId },
			{ type: "query", trait: "glasses", value: true }, // O
			{ type: "guess", id: secret }
		];
		let state = state0;
		for (const action of actions) {
			state = kernel.stepSync(state, action).nextState;
		}
		expect(state.status).toBe("won");
		expect(state.winner).toBe("X");
		expect(state.deduction!.eliminated.X).toEqual([wrongId]);

		const replay = replayActions(gameConfig, actions, cfg.rng.seed);
		expect(replay.finalState.status).toBe("won");
		expect(replay.finalState.winner).toBe("X");
		expect(replay.finalState.deduction?.eliminated.X).toEqual([wrongId]);
	});

	it("wrongGuess end_turn → handoff without loss", () => {
		const cfg = examplePresets["guess-who-commit-lite"].config;
		const { kernel } = compileConfig(cfg);
		const state0 = kernel.initialState(cfg.rng.seed);
		const secret = state0.deduction!.secret.O;
		const wrongId = ROSTER.map((c) => c.id).find((id) => id !== secret)!;

		const step = kernel.stepSync(state0, { type: "guess", id: wrongId });
		expect(step.nextState.status).toBe("playing");
		expect(step.nextState.winner).toBeNull();
		expect(step.nextState.currentPlayer).toBe("O");
		expect(
			step.events.some(
				(e) =>
					e.type === "guessResult" &&
					e.correct === false &&
					e.targetId === wrongId
			)
		).toBe(true);
	});

	it("legalActions include eliminate only when autoEliminate is false", () => {
		const commitCfg = examplePresets["guess-who-commit-lite"].config;
		const { kernel: commitKernel } = compileConfig(commitCfg);
		const commitLegal = commitKernel.legalActions(
			commitKernel.initialState(commitCfg.rng.seed),
			0
		);
		expect(commitLegal.filter((a) => a.type === "eliminate")).toHaveLength(
			4
		);
		expect(commitLegal.filter((a) => a.type === "guess")).toHaveLength(4);
		expect(commitLegal.filter((a) => a.type === "query")).toHaveLength(4);

		const autoCfg = examplePresets["guess-who-lite"].config;
		const { kernel: autoKernel } = compileConfig(autoCfg);
		const autoLegal = autoKernel.legalActions(
			autoKernel.initialState(autoCfg.rng.seed),
			0
		);
		expect(autoLegal.filter((a) => a.type === "eliminate")).toHaveLength(0);
	});
});
