import { describe, expect, it } from "vitest";
import { compileConfig, compileToGameConfig } from "@/compiler";
import {
	answerQueryConjunction,
	eliminateAfterQueryConjunction,
	enumerateCompoundQueries,
	enumerateTwoClauseQueries,
	validCompoundClauses
} from "@/engine/deduction";
import { validateConfig } from "@/engine/validateConfig";
import { replayActions } from "@/ir/gameIr";
import { examplePresets } from "@/presets/registry";
import { zConfig } from "@/schemas/config";
import type { KernelAction } from "@/engine/kernel";

const TRAITS = ["glasses", "hat", "beard"] as const;

const ROSTER = [
	{ id: "ann", traits: { glasses: true, hat: true, beard: true } },
	{ id: "bob", traits: { glasses: true, hat: true, beard: false } },
	{ id: "cara", traits: { glasses: true, hat: false, beard: true } },
	{ id: "dan", traits: { glasses: true, hat: false, beard: false } },
	{ id: "eve", traits: { glasses: false, hat: true, beard: true } },
	{ id: "fran", traits: { glasses: false, hat: true, beard: false } },
	{ id: "gus", traits: { glasses: false, hat: false, beard: true } },
	{ id: "hal", traits: { glasses: false, hat: false, beard: false } }
];

const TRIPLE = [
	{ trait: "glasses", value: true },
	{ trait: "hat", value: true },
	{ trait: "beard", value: true }
] as const;

describe("Guess Who And3 Lite schema", () => {
	it("accepts the guess-who-and3-lite preset", () => {
		const cfg = examplePresets["guess-who-and3-lite"].config;
		expect(zConfig.safeParse(cfg).success).toBe(true);
		expect(validateConfig(cfg).ok).toBe(true);
		const { gameConfig } = compileToGameConfig(cfg);
		expect(gameConfig.deduction?.queryShape).toBe("and");
		expect(gameConfig.deduction?.compoundArity).toBe(3);
		expect(gameConfig.deduction?.traits).toEqual([...TRAITS]);
	});

	it("defaults compoundArity to 2 for Guess Who And Lite", () => {
		const { gameConfig } = compileToGameConfig(
			examplePresets["guess-who-and-lite"].config
		);
		expect(gameConfig.deduction?.compoundArity).toBe(2);
	});

	it("rejects compoundArity greater than traits.length", () => {
		const base = examplePresets["guess-who-and3-lite"].config;
		const bad = {
			...base,
			deduction: {
				...base.deduction!,
				traits: ["glasses", "hat"],
				compoundArity: 3,
				roster: [
					{ id: "ann", traits: { glasses: true, hat: false } },
					{ id: "bob", traits: { glasses: false, hat: true } }
				]
			}
		};
		expect(zConfig.safeParse(bad).success).toBe(false);
	});
});

describe("compound arity helpers", () => {
	it("enumerateCompoundQueries yields C(n,k)×2^k", () => {
		expect(enumerateCompoundQueries(["glasses", "hat"], 2)).toHaveLength(4);
		expect(enumerateCompoundQueries([...TRAITS], 3)).toHaveLength(8);
		expect(enumerateCompoundQueries([...TRAITS], 2)).toHaveLength(12);
		expect(enumerateTwoClauseQueries([...TRAITS])).toHaveLength(12);
	});

	it("validCompoundClauses enforces exact arity + distinct traits", () => {
		expect(validCompoundClauses([...TRIPLE], [...TRAITS], 3)).toBe(true);
		expect(validCompoundClauses([...TRIPLE].slice(0, 2), [...TRAITS], 3)).toBe(
			false
		);
		expect(
			validCompoundClauses(
				[
					{ trait: "glasses", value: true },
					{ trait: "glasses", value: false },
					{ trait: "hat", value: true }
				],
				[...TRAITS],
				3
			)
		).toBe(false);
	});

	it("3-clause YES prune differs from any 2-clause YES prune", () => {
		const tripleYes = eliminateAfterQueryConjunction(
			ROSTER,
			[],
			[...TRIPLE],
			true
		);
		// Keep only ann (TTT); prune the other seven.
		expect(tripleYes.sort()).toEqual(
			["bob", "cara", "dan", "eve", "fran", "gus", "hal"].sort()
		);

		const pairYes = eliminateAfterQueryConjunction(
			ROSTER,
			[],
			[
				{ trait: "glasses", value: true },
				{ trait: "hat", value: true }
			],
			true
		);
		// glasses∧hat YES keeps ann+bob → prunes six, not seven.
		expect(pairYes).toHaveLength(6);
		expect(pairYes).not.toContain("ann");
		expect(pairYes).not.toContain("bob");
		expect(pairYes.sort()).not.toEqual(tripleYes.sort());
	});
});

describe("Guess Who And3 Lite play", () => {
	it("legalActions enumerate 8 triple conjunctions", () => {
		const cfg = examplePresets["guess-who-and3-lite"].config;
		const { kernel } = compileConfig(cfg);
		const state = kernel.initialState(cfg.rng.seed);
		const legal = kernel.legalActions(state, 0);
		const queries = legal.filter((a) => a.type === "query");
		expect(queries).toHaveLength(8);
		expect(
			queries.every((a) => a.type === "query" && a.clauses?.length === 3)
		).toBe(true);
	});

	it("rejects 2-clause query under compoundArity 3", () => {
		const cfg = examplePresets["guess-who-and3-lite"].config;
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
		const step = kernel.stepSync(state, {
			type: "query",
			clauses: [
				{ trait: "glasses", value: true },
				{ trait: "hat", value: true }
			]
		});
		expect(step.nextState.moveCount).toBe(state.moveCount);
		expect(step.nextState.deduction?.lastQuery).toBeUndefined();
	});

	it("triple query answers + auto-prunes; transcript replays", () => {
		const cfg = examplePresets["guess-who-and3-lite"].config;
		const { kernel, gameConfig } = compileConfig(cfg);
		const state0 = kernel.initialState(cfg.rng.seed);
		const opponentSecret = state0.deduction!.secret.O;
		const expectedAnswer = answerQueryConjunction(
			opponentSecret,
			ROSTER,
			[...TRIPLE]
		);
		const action: KernelAction = {
			type: "query",
			clauses: [
				{ trait: "glasses", value: true },
				{ trait: "hat", value: true },
				{ trait: "beard", value: true }
			]
		};
		const step = kernel.stepSync(state0, action);
		expect(step.nextState.deduction!.lastQuery).toEqual({
			by: "X",
			op: "and",
			clauses: [...TRIPLE],
			answer: expectedAnswer
		});
		const eliminated = step.nextState.deduction!.eliminated.X;
		expect(eliminated).toEqual(
			eliminateAfterQueryConjunction(ROSTER, [], [...TRIPLE], expectedAnswer)
		);
		expect(eliminated).not.toContain(opponentSecret);

		const answered = step.events.find((e) => e.type === "queryAnswered");
		expect(answered).toMatchObject({
			type: "queryAnswered",
			player: "X",
			op: "and",
			clauses: [...TRIPLE],
			answer: expectedAnswer
		});

		const replay = replayActions(gameConfig, [action], cfg.rng.seed);
		expect(replay.finalState.deduction?.lastQuery).toEqual(
			step.nextState.deduction?.lastQuery
		);
		expect(replay.finalState.deduction?.eliminated.X).toEqual(eliminated);
	});

	it("And Lite still rejects arity-3 queries", () => {
		const cfg = examplePresets["guess-who-and-lite"].config;
		const { kernel } = compileConfig(cfg);
		const state = kernel.initialState(cfg.rng.seed);
		const explain = kernel.explainAction(state, 0, {
			type: "query",
			clauses: [
				{ trait: "glasses", value: true },
				{ trait: "hat", value: true },
				{ trait: "beard", value: true }
			]
		});
		expect(explain.legal).toBe(false);
	});
});
