import { describe, expect, it } from "vitest";
import { compileConfig, compileToGameConfig } from "@/compiler";
import {
	answerQueryConjunction,
	eliminateAfterQueryConjunction,
	enumerateCompoundQueries
} from "@/engine/deduction";
import { observe } from "@/engine/observation";
import { canSearchJointActions } from "@/agents/jointLegal";
import {
	jointQueryFromActions,
	stepPly,
	type KernelAction,
	type PlayerId
} from "@/engine/kernel";
import { validateConfig } from "@/engine/validateConfig";
import { replayActions } from "@/ir/gameIr";
import { examplePresets } from "@/presets/registry";
import { zConfig } from "@/schemas/config";

const andPreset = () =>
	examplePresets["simultaneous-guess-who-and-lite"].config;

function pickFirst(
	_player: PlayerId,
	legal: KernelAction[]
): KernelAction | null {
	return legal[0] ?? null;
}

describe("schema: simultaneous × compound deduction", () => {
	it("accepts the simultaneous-guess-who-and-lite preset", () => {
		const cfg = andPreset();
		expect(zConfig.safeParse(cfg).success).toBe(true);
		expect(validateConfig(cfg).ok).toBe(true);
		const { gameConfig } = compileToGameConfig(cfg);
		expect(gameConfig.turnSchedule).toBe("simultaneous");
		expect(gameConfig.inputMode).toBe("deduction");
		expect(gameConfig.deduction?.queryShape).toBe("and");
		expect(gameConfig.deduction?.compoundArity).toBe(2);
		expect(gameConfig.deduction?.autoEliminate).toBe(true);
	});

	it("accepts simultaneous + queryShape or", () => {
		const base = andPreset();
		expect(
			zConfig.safeParse({
				...base,
				deduction: { ...base.deduction!, queryShape: "or" }
			}).success
		).toBe(true);
	});
});

describe("kernel: simultaneous joint compound query", () => {
	it("exposes C(n,2)×4 compound queries per seat", () => {
		const { kernel } = compileConfig(andPreset());
		const state0 = kernel.initialState(42);
		const a0 = kernel.legalActions(state0, 0);
		const queries = a0.filter((a) => a.type === "query");
		expect(queries).toHaveLength(4);
		expect(queries.every((q) => q.type === "query" && q.clauses?.length === 2)).toBe(
			true
		);
		expect(enumerateCompoundQueries(["glasses", "hat"], 2)).toHaveLength(4);
		expect(canSearchJointActions(kernel)).toBe(false);
	});

	it("joint AND query prunes independently and records lastQueries with op", () => {
		const { kernel } = compileConfig(andPreset());
		const state0 = kernel.initialState(42);
		const clausesX = [
			{ trait: "glasses", value: true },
			{ trait: "hat", value: true }
		] as const;
		const clausesO = [
			{ trait: "glasses", value: false },
			{ trait: "hat", value: false }
		] as const;
		const qx: KernelAction = { type: "query", clauses: [...clausesX] };
		const qo: KernelAction = { type: "query", clauses: [...clausesO] };
		const joint = jointQueryFromActions(qx, qo);
		expect(joint?.type).toBe("simultaneousQuery");

		const result = kernel.stepSync(state0, joint!);
		expect(result.nextState.moveCount).toBe(1);
		expect(result.nextState.deduction?.lastQueries?.X?.op).toBe("and");
		expect(result.nextState.deduction?.lastQueries?.O?.op).toBe("and");
		expect(result.nextState.deduction?.lastQueries?.X?.clauses).toEqual([
			...clausesX
		]);
		expect(result.nextState.deduction?.lastQueries?.O?.clauses).toEqual([
			...clausesO
		]);
		expect(
			result.events.filter((e) => e.type === "queryAnswered")
		).toHaveLength(2);

		const secretO = state0.deduction!.secret.O;
		const secretX = state0.deduction!.secret.X;
		const roster = kernel.config.deduction!.roster;
		const ansX = answerQueryConjunction(secretO, roster, [...clausesX]);
		const ansO = answerQueryConjunction(secretX, roster, [...clausesO]);
		expect(result.nextState.deduction?.lastQueries?.X?.answer).toBe(ansX);
		expect(result.nextState.deduction?.lastQueries?.O?.answer).toBe(ansO);
		expect(result.nextState.deduction?.eliminated.X).toEqual(
			eliminateAfterQueryConjunction(roster, [], [...clausesX], ansX)
		);
		expect(result.nextState.deduction?.eliminated.O).toEqual(
			eliminateAfterQueryConjunction(roster, [], [...clausesO], ansO)
		);

		const obsX = observe(kernel.config, result.nextState, "X");
		expect(obsX.deduction?.lastQuery?.op).toBe("and");
		expect(obsX.deduction?.lastQuery?.clauses).toEqual([...clausesX]);
	});

	it("rejects single-atom query under simultaneous compound shape", () => {
		const { kernel } = compileConfig(andPreset());
		const state0 = kernel.initialState(42);
		const single: KernelAction = {
			type: "simultaneousQuery",
			queries: {
				X: { type: "query", trait: "glasses", value: true },
				O: { type: "query", trait: "hat", value: false }
			}
		};
		expect(kernel.explainAction(state0, 0, single).legal).toBe(false);
		const result = kernel.stepSync(state0, single);
		expect(result.nextState).toEqual(state0);
	});

	it("stepJoint / stepPly compose joint compound queries", () => {
		const { kernel } = compileConfig(andPreset());
		const state0 = kernel.initialState(42);
		const qx = kernel
			.legalActions(state0, 0)
			.find((a) => a.type === "query")!;
		const qo = kernel
			.legalActions(state0, 1)
			.find((a) => a.type === "query")!;
		const stepped = kernel.stepJointSync(state0, { 0: qx, 1: qo });
		expect(stepped.nextState.moveCount).toBe(1);
		expect(stepped.nextState.deduction?.lastQueries?.X?.op).toBe("and");

		const ply = stepPly(kernel, state0, pickFirst, 99);
		expect(ply).not.toBeNull();
		expect(ply!.nextState.moveCount).toBe(1);
	});

	it("replays simultaneousQuery compound via GameIR", () => {
		const { kernel, gameConfig } = compileConfig(andPreset());
		const state0 = kernel.initialState(42);
		const action: KernelAction = {
			type: "simultaneousQuery",
			queries: {
				X: {
					type: "query",
					clauses: [
						{ trait: "glasses", value: true },
						{ trait: "hat", value: false }
					]
				},
				O: {
					type: "query",
					clauses: [
						{ trait: "glasses", value: false },
						{ trait: "hat", value: true }
					]
				}
			}
		};
		const live = kernel.stepSync(state0, action);
		const { finalState, faithful } = replayActions(gameConfig, [action], 42);
		expect(faithful).toBe(true);
		expect(finalState.moveCount).toBe(live.nextState.moveCount);
		expect(finalState.deduction?.eliminated).toEqual(
			live.nextState.deduction?.eliminated
		);
		expect(finalState.deduction?.lastQueries?.X?.op).toBe("and");
	});
});
