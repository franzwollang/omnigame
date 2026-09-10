import { describe, expect, it } from "vitest";
import { compileConfig, compileToGameConfig } from "@/compiler";
import {
	answerQueryDisjunction,
	eliminateAfterQuery,
	eliminateAfterQueryConjunction,
	eliminateAfterQueryDisjunction,
	enumerateTwoClauseQueries
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

describe("Guess Who Or Lite schema", () => {
	it("accepts the guess-who-or-lite preset", () => {
		const cfg = examplePresets["guess-who-or-lite"].config;
		expect(zConfig.safeParse(cfg).success).toBe(true);
		expect(validateConfig(cfg).ok).toBe(true);
		const { gameConfig } = compileToGameConfig(cfg);
		expect(gameConfig.deduction?.queryShape).toBe("or");
		expect(gameConfig.deduction?.autoEliminate).toBe(true);
	});

	it("rejects queryShape or with fewer than 2 traits", () => {
		const base = examplePresets["guess-who-or-lite"].config;
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
});

describe("disjunction helpers", () => {
	it("answerQueryDisjunction requires any clause", () => {
		const clauses = [
			{ trait: "glasses", value: true },
			{ trait: "hat", value: true }
		] as const;
		expect(answerQueryDisjunction("cara", ROSTER, clauses)).toBe(true);
		expect(answerQueryDisjunction("ann", ROSTER, clauses)).toBe(true);
		expect(answerQueryDisjunction("bob", ROSTER, clauses)).toBe(true);
		expect(answerQueryDisjunction("dan", ROSTER, clauses)).toBe(false);
	});

	it("compound OR NO prunes differently than AND NO and atomics", () => {
		const clauses = [
			{ trait: "glasses", value: true },
			{ trait: "hat", value: true }
		] as const;
		// OR NO (dan secret): prune anyone matching glasses OR hat → ann,bob,cara
		const orNo = eliminateAfterQueryDisjunction(ROSTER, [], clauses, false);
		expect(orNo).toEqual(["ann", "bob", "cara"]);

		// AND NO: prune only those matching both → cara
		const andNo = eliminateAfterQueryConjunction(ROSTER, [], clauses, false);
		expect(andNo).toEqual(["cara"]);
		expect(orNo).not.toEqual(andNo);

		// Atomic glasses=false YES would prune ann+cara — not the OR NO set
		const glassesFalseYes = eliminateAfterQuery(
			ROSTER,
			[],
			"glasses",
			false,
			true
		);
		expect(glassesFalseYes).not.toEqual(orNo);
	});

	it("compound OR YES keeps anyone matching ≥1 clause", () => {
		const clauses = [
			{ trait: "glasses", value: true },
			{ trait: "hat", value: true }
		] as const;
		const orYes = eliminateAfterQueryDisjunction(ROSTER, [], clauses, true);
		expect(orYes).toEqual(["dan"]);
	});

	it("enumerateTwoClauseQueries yields C(n,2)×4 for or configs too", () => {
		expect(enumerateTwoClauseQueries(["glasses", "hat"])).toHaveLength(4);
		expect(
			enumerateTwoClauseQueries(["glasses", "hat", "beard"])
		).toHaveLength(12);
	});
});

describe("Guess Who Or Lite play", () => {
	it("legalActions enumerate 4 disjunction queries for 2 traits", () => {
		const cfg = examplePresets["guess-who-or-lite"].config;
		const { kernel } = compileConfig(cfg);
		const state = kernel.initialState(cfg.rng.seed);
		const legal = kernel.legalActions(state, 0);
		const queries = legal.filter((a) => a.type === "query");
		expect(queries).toHaveLength(4);
		expect(
			queries.every((a) => a.type === "query" && a.clauses?.length === 2)
		).toBe(true);
		expect(
			queries.every((a) => a.type === "query" && a.trait === undefined)
		).toBe(true);
	});

	it("rejects single-atom query under queryShape or", () => {
		const cfg = examplePresets["guess-who-or-lite"].config;
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

	it("disjunction query answers + auto-prunes compound-inconsistent candidates", () => {
		const cfg = examplePresets["guess-who-or-lite"].config;
		const { kernel } = compileConfig(cfg);
		const state0 = kernel.initialState(cfg.rng.seed);
		const opponentSecret = state0.deduction!.secret.O;
		const clauses = [
			{ trait: "glasses", value: true },
			{ trait: "hat", value: true }
		] as const;
		const expectedAnswer = answerQueryDisjunction(
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
			op: "or",
			clauses: [
				{ trait: "glasses", value: true },
				{ trait: "hat", value: true }
			],
			answer: expectedAnswer
		});
		const eliminated = step.nextState.deduction!.eliminated.X;
		expect(eliminated).toEqual(
			eliminateAfterQueryDisjunction(ROSTER, [], clauses, expectedAnswer)
		);
		expect(eliminated).not.toContain(opponentSecret);

		const answered = step.events.find((e) => e.type === "queryAnswered");
		expect(answered).toMatchObject({
			type: "queryAnswered",
			player: "X",
			op: "or",
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
		expect(obs.deduction?.lastQuery?.op).toBe("or");
	});

	it("OR prune set differs from AND on the same clauses", () => {
		const orCfg = examplePresets["guess-who-or-lite"].config;
		const andCfg = examplePresets["guess-who-and-lite"].config;
		const { kernel: orKernel } = compileConfig(orCfg);
		const { kernel: andKernel } = compileConfig(andCfg);
		const orState = orKernel.initialState(orCfg.rng.seed);
		const andState = andKernel.initialState(andCfg.rng.seed);
		expect(orState.deduction!.secret).toEqual(andState.deduction!.secret);

		const action: KernelAction = {
			type: "query",
			clauses: [
				{ trait: "glasses", value: true },
				{ trait: "hat", value: true }
			]
		};
		const orStep = orKernel.stepSync(orState, action);
		const andStep = andKernel.stepSync(andState, action);
		expect(orStep.nextState.deduction!.lastQuery?.op).toBe("or");
		expect(andStep.nextState.deduction!.lastQuery?.op).toBe("and");
		expect(orStep.nextState.deduction!.eliminated.X).not.toEqual(
			andStep.nextState.deduction!.eliminated.X
		);
	});

	it("GameIR transcript replay restores disjunction lastQuery + eliminations", () => {
		const cfg = examplePresets["guess-who-or-lite"].config;
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

	it("and-shape Guess Who And Lite still rejects being treated as or-only", () => {
		const cfg = examplePresets["guess-who-and-lite"].config;
		const { kernel } = compileConfig(cfg);
		const state = kernel.initialState(cfg.rng.seed);
		const step = kernel.stepSync(state, {
			type: "query",
			clauses: [
				{ trait: "glasses", value: true },
				{ trait: "hat", value: true }
			]
		});
		expect(step.nextState.deduction?.lastQuery?.op).toBe("and");
	});
});
