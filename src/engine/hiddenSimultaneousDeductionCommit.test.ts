import { describe, expect, it } from "vitest";
import { compileConfig, compileToGameConfig } from "@/compiler";
import { observe } from "@/engine/observation";
import {
	canSearchCommitRevealJoint,
	canSearchJointActions,
	enumerateCommitRevealJoints,
	seatCommitFromJoint
} from "@/agents/jointLegal";
import { type KernelAction } from "@/engine/kernel";
import { validateConfig } from "@/engine/validateConfig";
import { replayActions } from "@/ir/gameIr";
import { examplePresets } from "@/presets/registry";
import { zConfig } from "@/schemas/config";

const preset = () =>
	examplePresets["hidden-simultaneous-guess-who-commit-lite"].config;

describe("schema: commitReveal × manual eliminate (M37)", () => {
	it("accepts the hidden-simultaneous-guess-who-commit-lite preset", () => {
		const cfg = preset();
		expect(zConfig.safeParse(cfg).success).toBe(true);
		expect(validateConfig(cfg).ok).toBe(true);
		const { gameConfig } = compileToGameConfig(cfg);
		expect(gameConfig.turnSchedule).toBe("simultaneous");
		expect(gameConfig.commitReveal).toBe(true);
		expect(gameConfig.inputMode).toBe("deduction");
		expect(gameConfig.deduction?.autoEliminate).toBe(false);
	});

	it("rejects commitReveal + phases under simultaneous deduction", () => {
		const base = preset();
		expect(
			zConfig.safeParse({
				...base,
				turn: {
					...base.turn,
					phases: ["query", "eliminate"]
				}
			}).success
		).toBe(false);
	});
});

describe("kernel: commitEliminate under commitReveal", () => {
	it("lists commitQuery/commitGuess/commitEliminate on fresh round", () => {
		const { kernel } = compileConfig(preset());
		const state0 = kernel.initialState(42);
		expect(canSearchJointActions(kernel)).toBe(false);
		expect(canSearchCommitRevealJoint(kernel, state0)).toBe(true);

		const legalX = kernel.legalActions(state0, 0);
		expect(
			legalX.every(
				(a) =>
					a.type === "commitQuery" ||
					a.type === "commitGuess" ||
					a.type === "commitEliminate"
			)
		).toBe(true);
		expect(legalX.filter((a) => a.type === "commitQuery")).toHaveLength(4);
		expect(legalX.filter((a) => a.type === "commitGuess")).toHaveLength(4);
		expect(legalX.filter((a) => a.type === "commitEliminate")).toHaveLength(
			4
		);
	});

	it("kind-locks O to commitEliminate after X commits eliminate", () => {
		const { kernel } = compileConfig(preset());
		const state0 = kernel.initialState(42);
		const afterX = kernel.stepSync(state0, {
			type: "commitEliminate",
			player: "X",
			id: "ann"
		});
		expect(afterX.nextState.moveCount).toBe(0);
		expect(afterX.nextState.committedDeduction?.X).toEqual({
			kind: "eliminate",
			id: "ann"
		});

		const obsX = observe(kernel.config, afterX.nextState, "X");
		const obsO = observe(kernel.config, afterX.nextState, "O");
		expect(obsX.deduction?.pendingCommit).toEqual({
			kind: "eliminate",
			id: "ann"
		});
		expect(obsO.deduction?.pendingCommit).toBeUndefined();

		const legalO = kernel.legalActions(afterX.nextState, 1);
		expect(legalO.every((a) => a.type === "commitEliminate")).toBe(true);
		expect(legalO.some((a) => a.type === "commitQuery")).toBe(false);
		expect(legalO).toHaveLength(4);
	});

	it("reveals joint eliminate when both seats commitEliminate", () => {
		const { kernel } = compileConfig(preset());
		const state0 = kernel.initialState(42);
		const afterX = kernel.stepSync(state0, {
			type: "commitEliminate",
			player: "X",
			id: "ann"
		}).nextState;
		const afterBoth = kernel.stepSync(afterX, {
			type: "commitEliminate",
			player: "O",
			id: "bob"
		});
		expect(afterBoth.nextState.moveCount).toBe(1);
		expect(afterBoth.nextState.committedDeduction).toBeUndefined();
		expect(afterBoth.nextState.deduction?.eliminated.X).toEqual(["ann"]);
		expect(afterBoth.nextState.deduction?.eliminated.O).toEqual(["bob"]);
		expect(
			afterBoth.events.filter((e) => e.type === "candidateEliminated")
		).toHaveLength(2);
	});

	it("manual commitQuery reveals answers without pruning", () => {
		const { kernel } = compileConfig(preset());
		const state0 = kernel.initialState(42);
		const afterX = kernel.stepSync(state0, {
			type: "commitQuery",
			player: "X",
			query: { type: "query", trait: "glasses", value: true }
		}).nextState;
		const afterBoth = kernel.stepSync(afterX, {
			type: "commitQuery",
			player: "O",
			query: { type: "query", trait: "hat", value: false }
		});
		expect(afterBoth.nextState.moveCount).toBe(1);
		expect(afterBoth.nextState.committedDeduction).toBeUndefined();
		expect(afterBoth.nextState.deduction?.eliminated.X).toEqual([]);
		expect(afterBoth.nextState.deduction?.eliminated.O).toEqual([]);
		expect(afterBoth.nextState.deduction?.lastQueries?.X).toBeDefined();
		expect(afterBoth.nextState.deduction?.lastQueries?.O).toBeDefined();
		expect(
			afterBoth.events.filter((e) => e.type === "queryAnswered")
		).toHaveLength(2);
	});

	it("bare eliminate/query are noops under commitReveal", () => {
		const { kernel } = compileConfig(preset());
		const state0 = kernel.initialState(42);
		const afterEliminate = kernel.stepSync(state0, {
			type: "eliminate",
			id: "ann"
		});
		expect(afterEliminate.nextState).toEqual(state0);
		const afterQuery = kernel.stepSync(state0, {
			type: "query",
			trait: "glasses",
			value: true
		});
		expect(afterQuery.nextState).toEqual(state0);
	});

	it("replays commitEliminate sequence via GameIR", () => {
		const { gameConfig } = compileConfig(preset());
		const actions: KernelAction[] = [
			{ type: "commitEliminate", player: "X", id: "cara" },
			{ type: "commitEliminate", player: "O", id: "dan" }
		];
		const { finalState, faithful } = replayActions(gameConfig, actions, 42);
		expect(faithful).toBe(true);
		expect(finalState.status).toBe("playing");
		expect(finalState.deduction?.eliminated.X).toEqual(["cara"]);
		expect(finalState.deduction?.eliminated.O).toEqual(["dan"]);
		expect(finalState.moveCount).toBe(1);
	});

	it("enumerates 48 commitReveal joints including eliminate", () => {
		const { kernel } = compileConfig(preset());
		const state = kernel.initialState(42);
		const joints = enumerateCommitRevealJoints(kernel, state);
		expect(joints).toHaveLength(48);
		expect(
			joints.filter((a) => a.type === "simultaneousQuery")
		).toHaveLength(16);
		expect(
			joints.filter((a) => a.type === "simultaneousGuess")
		).toHaveLength(16);
		expect(
			joints.filter((a) => a.type === "simultaneousEliminate")
		).toHaveLength(16);

		const joint = joints.find((a) => a.type === "simultaneousEliminate")!;
		expect(seatCommitFromJoint(joint, 0)?.type).toBe("commitEliminate");
		expect(seatCommitFromJoint(joint, 1)?.type).toBe("commitEliminate");
	});
});
