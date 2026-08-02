import { describe, expect, it } from "vitest";
import { compileConfig, compileToGameConfig } from "@/compiler";
import { canSearchJointActions, enumerateJointLegalActions } from "@/agents/jointLegal";
import {
	jointEliminateFromActions,
	jointQueryFromActions,
	type KernelAction
} from "@/engine/kernel";
import { validateConfig } from "@/engine/validateConfig";
import { replayActions } from "@/ir/gameIr";
import { examplePresets } from "@/presets/registry";
import { zConfig } from "@/schemas/config";

const preset = () =>
	examplePresets["simultaneous-guess-who-commit-lite"].config;

describe("schema: simultaneous × deduction manual eliminate", () => {
	it("accepts the simultaneous-guess-who-commit-lite preset", () => {
		const cfg = preset();
		expect(zConfig.safeParse(cfg).success).toBe(true);
		expect(validateConfig(cfg).ok).toBe(true);
		const { gameConfig } = compileToGameConfig(cfg);
		expect(gameConfig.turnSchedule).toBe("simultaneous");
		expect(gameConfig.inputMode).toBe("deduction");
		expect(gameConfig.deduction?.autoEliminate).toBe(false);
		expect(gameConfig.commitReveal).not.toBe(true);
	});

	it("rejects autoEliminate false under commitReveal and under phases", () => {
		const base = preset();
		expect(
			zConfig.safeParse({
				...base,
				turn: {
					mode: "turn",
					schedule: "simultaneous",
					commitReveal: true
				}
			}).success
		).toBe(false);

		expect(
			zConfig.safeParse({
				...base,
				turn: {
					mode: "turn",
					schedule: "simultaneous",
					phases: ["query", "eliminate"]
				}
			}).success
		).toBe(false);
	});
});

describe("kernel: simultaneousEliminate", () => {
	it("lists query, guess, and eliminate per seat", () => {
		const { kernel } = compileConfig(preset());
		const state0 = kernel.initialState(42);
		expect(kernel.currentPlayer(state0)).toBe("simultaneous");
		const a0 = kernel.legalActions(state0, 0);
		expect(
			a0.every(
				(a) =>
					a.type === "query" ||
					a.type === "guess" ||
					a.type === "eliminate"
			)
		).toBe(true);
		expect(a0.filter((a) => a.type === "query")).toHaveLength(4);
		expect(a0.filter((a) => a.type === "guess")).toHaveLength(4);
		expect(a0.filter((a) => a.type === "eliminate")).toHaveLength(4);
	});

	it("simultaneousQuery records answers without pruning", () => {
		const { kernel } = compileConfig(preset());
		const state0 = kernel.initialState(42);
		const joint = jointQueryFromActions(
			{ type: "query", trait: "glasses", value: true },
			{ type: "query", trait: "hat", value: false }
		)!;
		const step = kernel.stepSync(state0, joint);
		expect(step.events.some((e) => e.type === "queryAnswered")).toBe(true);
		expect(step.nextState.deduction?.lastQueries?.X?.answer).toBeDefined();
		expect(step.nextState.deduction?.lastQueries?.O?.answer).toBeDefined();
		expect(step.nextState.deduction?.eliminated.X).toEqual([]);
		expect(step.nextState.deduction?.eliminated.O).toEqual([]);
		expect(step.nextState.moveCount).toBe(1);
	});

	it("simultaneousEliminate prunes independently and emits candidateEliminated", () => {
		const { kernel } = compileConfig(preset());
		const state0 = kernel.initialState(42);
		const joint = jointEliminateFromActions(
			{ type: "eliminate", id: "ann" },
			{ type: "eliminate", id: "bob" }
		)!;
		expect(joint.type).toBe("simultaneousEliminate");
		const step = kernel.stepSync(state0, joint);
		expect(step.nextState.deduction?.eliminated.X).toEqual(["ann"]);
		expect(step.nextState.deduction?.eliminated.O).toEqual(["bob"]);
		const elimEvents = step.events.filter(
			(e) => e.type === "candidateEliminated"
		);
		expect(elimEvents).toHaveLength(2);
		expect(step.nextState.moveCount).toBe(1);
		expect(step.nextState.status).toBe("playing");
	});

	it("bare eliminate / query are noops under simultaneous", () => {
		const { kernel } = compileConfig(preset());
		const state0 = kernel.initialState(42);
		const bareElim = kernel.stepSync(state0, {
			type: "eliminate",
			id: "ann"
		});
		expect(bareElim.events.some((e) => e.type === "ignored")).toBe(true);
		expect(bareElim.nextState.moveCount).toBe(0);

		const bareQuery = kernel.stepSync(state0, {
			type: "query",
			trait: "glasses",
			value: true
		});
		expect(bareQuery.events.some((e) => e.type === "ignored")).toBe(true);
	});

	it("rejects already-eliminated joint eliminate", () => {
		const { kernel } = compileConfig(preset());
		const state0 = kernel.initialState(42);
		const after = kernel.stepSync(
			state0,
			jointEliminateFromActions(
				{ type: "eliminate", id: "ann" },
				{ type: "eliminate", id: "bob" }
			)!
		).nextState;
		const again = kernel.stepSync(
			after,
			jointEliminateFromActions(
				{ type: "eliminate", id: "ann" },
				{ type: "eliminate", id: "cara" }
			)!
		);
		expect(again.events.some((e) => e.type === "ignored")).toBe(true);
		expect(again.nextState.deduction?.eliminated.X).toEqual(["ann"]);
	});

	it("stepJoint composes eliminate×eliminate", () => {
		const { kernel } = compileConfig(preset());
		const state0 = kernel.initialState(42);
		const step = kernel.stepJointSync(state0, {
			0: { type: "eliminate", id: "cara" },
			1: { type: "eliminate", id: "dan" }
		});
		expect(step.nextState.deduction?.eliminated.X).toEqual(["cara"]);
		expect(step.nextState.deduction?.eliminated.O).toEqual(["dan"]);
	});

	it("GameIR replays query then eliminate rounds", () => {
		const { kernel } = compileConfig(preset());
		const seed = 42;
		const state0 = kernel.initialState(seed);
		const actions: KernelAction[] = [
			jointQueryFromActions(
				{ type: "query", trait: "glasses", value: true },
				{ type: "query", trait: "glasses", value: false }
			)!,
			jointEliminateFromActions(
				{ type: "eliminate", id: "ann" },
				{ type: "eliminate", id: "bob" }
			)!
		];
		const live = actions.reduce(
			(s, a) => kernel.stepSync(s, a).nextState,
			state0
		);
		const replayed = replayActions(kernel, actions, seed);
		expect(replayed.deduction?.eliminated).toEqual(live.deduction?.eliminated);
		expect(replayed.moveCount).toBe(live.moveCount);
	});

	it("enumerates 48 kind-matched joints (16+16+16)", () => {
		const { kernel } = compileConfig(preset());
		const state = kernel.initialState(42);
		expect(canSearchJointActions(kernel)).toBe(true);
		const joints = enumerateJointLegalActions(kernel, state);
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
	});
});
