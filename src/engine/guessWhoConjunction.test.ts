import { describe, expect, it } from "vitest";
import { compileConfig, compileToGameConfig } from "@/compiler";
import {
	answerQueryConjunction,
	eliminateAfterQuery,
	eliminateAfterQueryConjunction,
	enumerateConjunctionQueries
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

describe("Guess Who And Lite schema", () => {
	it("accepts the guess-who-and-lite preset", () => {
		const cfg = examplePresets["guess-who-and-lite"].config;
		expect(zConfig.safeParse(cfg).success).toBe(true);
		expect(validateConfig(cfg).ok).toBe(true);
		const { gameConfig } = compileToGameConfig(cfg);
		expect(gameConfig.deduction?.queryShape).toBe("and");
		expect(gameConfig.deduction?.autoEliminate).toBe(true);
	});

	it("rejects queryShape and with fewer than 2 traits", () => {
		const base = examplePresets["guess-who-and-lite"].config;
		const bad = {
			...base,
			deduction: {
				...base.deduction!,
				traits: ["glasses"],
				roster: [
					{ id: "ann", traits: { glasses: true } },
					{ id: "bob", traits: { glasses: false } }
				]
			}
		};
		expect(zConfig.safeParse(bad).success).toBe(false);
	});

	it("defaults queryShape to single for Guess Who Lite", () => {
		const { gameConfig } = compileToGameConfig(
			examplePresets["guess-who-lite"].config
		);
		expect(gameConfig.deduction?.queryShape).toBe("single");
	});
});

describe("conjunction helpers", () => {
	it("answerQueryConjunction requires all clauses", () => {
		expect(
			answerQueryConjunction("cara", ROSTER, [
				{ trait: "glasses", value: true },
				{ trait: "hat", value: true }
			])
		).toBe(true);
		expect(
			answerQueryConjunction("bob", ROSTER, [
				{ trait: "glasses", value: true },
				{ trait: "hat", value: true }
			])
		).toBe(false);
		expect(
			answerQueryConjunction("ann", ROSTER, [
				{ trait: "glasses", value: true },
				{ trait: "hat", value: true }
			])
		).toBe(false);
	});

	it("compound NO prunes differently than sequential atomics", () => {
		// glasses=true AND hat=true → NO for bob: only cara matches both, so
		// prune cara. Atomic glasses=true YES would prune bob+dan; hat=true
		// YES would prune ann+dan — neither single step yields only-cara prune.
		const compound = eliminateAfterQueryConjunction(
			ROSTER,
			[],
			[
				{ trait: "glasses", value: true },
				{ trait: "hat", value: true }
			],
			false
		);
		expect(compound).toEqual(["cara"]);

		const glassesYes = eliminateAfterQuery(ROSTER, [], "glasses", true, true);
		const hatYes = eliminateAfterQuery(ROSTER, [], "hat", true, true);
		expect(glassesYes).not.toEqual(compound);
		expect(hatYes).not.toEqual(compound);
	});

	it("enumerateConjunctionQueries yields C(n,2)×4", () => {
		expect(enumerateConjunctionQueries(["glasses", "hat"])).toHaveLength(4);
		expect(
			enumerateConjunctionQueries(["glasses", "hat", "beard"])
		).toHaveLength(12);
	});
});

describe("Guess Who And Lite play", () => {
	it("legalActions enumerate 4 conjunction queries for 2 traits", () => {
		const cfg = examplePresets["guess-who-and-lite"].config;
		const { kernel } = compileConfig(cfg);
		const state = kernel.initialState(cfg.rng.seed);
		const legal = kernel.legalActions(state, 0);
		const queries = legal.filter((a) => a.type === "query");
		expect(queries).toHaveLength(4);
		expect(queries.every((a) => a.type === "query" && a.clauses?.length === 2)).toBe(
			true
		);
		expect(queries.every((a) => a.type === "query" && a.trait === undefined)).toBe(
			true
		);
	});

	it("rejects single-atom query under queryShape and", () => {
		const cfg = examplePresets["guess-who-and-lite"].config;
		const { kernel } = compileConfig(cfg);
		const state = kernel.initialState(cfg.rng.seed);
		const explain = kernel.explainAction(state, 0, {
			type: "query",
			trait: "glasses",
			value: true
		});
		expect(explain.legal).toBe(false);
		const step = kernel.stepSync(state, {
			type: "query",
			trait: "glasses",
			value: true
		});
		expect(step.nextState.moveCount).toBe(state.moveCount);
		expect(step.nextState.deduction?.lastQuery).toBeUndefined();
	});

	it("conjunction query answers + auto-prunes compound-inconsistent candidates", () => {
		const cfg = examplePresets["guess-who-and-lite"].config;
		const { kernel } = compileConfig(cfg);
		const state0 = kernel.initialState(cfg.rng.seed);
		const opponentSecret = state0.deduction!.secret.O;
		const clauses = [
			{ trait: "glasses", value: true },
			{ trait: "hat", value: true }
		] as const;
		const expectedAnswer = answerQueryConjunction(
			opponentSecret,
			ROSTER,
			clauses
		);
		const step = kernel.stepSync(state0, {
			type: "query",
			clauses: [
				{ trait: "glasses", value: true },
				{ trait: "hat", value: true }
			]
		});
		expect(step.nextState.deduction!.lastQuery).toEqual({
			by: "X",
			op: "and",
			clauses: [
				{ trait: "glasses", value: true },
				{ trait: "hat", value: true }
			],
			answer: expectedAnswer
		});
		const eliminated = step.nextState.deduction!.eliminated.X;
		expect(eliminated).toEqual(
			eliminateAfterQueryConjunction(ROSTER, [], clauses, expectedAnswer)
		);
		expect(eliminated).not.toContain(opponentSecret);

		const answered = step.events.find((e) => e.type === "queryAnswered");
		expect(answered).toMatchObject({
			type: "queryAnswered",
			player: "X",
			op: "and",
			clauses: [
				{ trait: "glasses", value: true },
				{ trait: "hat", value: true }
			],
			answer: expectedAnswer
		});

		const obs = observe(kernel.config, step.nextState, "X");
		expect(obs.deduction?.lastQuery?.clauses).toEqual([
			{ trait: "glasses", value: true },
			{ trait: "hat", value: true }
		]);
	});

	it("GameIR transcript replay restores conjunction lastQuery + eliminations", () => {
		const cfg = examplePresets["guess-who-and-lite"].config;
		const { kernel, gameConfig } = compileConfig(cfg);
		const state0 = kernel.initialState(cfg.rng.seed);
		const action: KernelAction = {
			type: "query",
			clauses: [
				{ trait: "glasses", value: true },
				{ trait: "hat", value: true }
			]
		};
		const step = kernel.stepSync(state0, action);
		const replay = replayActions(gameConfig, [action], cfg.rng.seed);
		expect(replay.finalState.deduction?.lastQuery).toEqual(
			step.nextState.deduction?.lastQuery
		);
		expect(replay.finalState.deduction?.eliminated.X).toEqual(
			step.nextState.deduction?.eliminated.X
		);
		expect(replay.finalState.deduction?.secret).toEqual(
			state0.deduction?.secret
		);
	});

	it("single-shape Guess Who Lite still rejects clauses", () => {
		const cfg = examplePresets["guess-who-lite"].config;
		const { kernel } = compileConfig(cfg);
		const state = kernel.initialState(cfg.rng.seed);
		const explain = kernel.explainAction(state, 0, {
			type: "query",
			clauses: [
				{ trait: "glasses", value: true },
				{ trait: "hat", value: true }
			]
		});
		expect(explain.legal).toBe(false);
	});
});
