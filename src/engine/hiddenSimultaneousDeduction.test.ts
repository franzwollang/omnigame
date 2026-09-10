import { describe, expect, it } from "vitest";
import { compileConfig, compileToGameConfig } from "@/compiler";
import { observe } from "@/engine/observation";
import { canSearchJointActions } from "@/agents/jointLegal";
import {
	stepPly,
	type KernelAction,
	type PlayerId
} from "@/engine/kernel";
import { validateConfig } from "@/engine/validateConfig";
import { replayActions } from "@/ir/gameIr";
import { examplePresets } from "@/presets/registry";
import { zConfig } from "@/schemas/config";

const preset = () =>
	examplePresets["hidden-simultaneous-guess-who-lite"].config;

function pickFirst(
	_player: PlayerId,
	legal: KernelAction[]
): KernelAction | null {
	return legal[0] ?? null;
}

describe("schema: simultaneous deduction × commitReveal", () => {
	it("accepts the hidden-simultaneous-guess-who-lite preset", () => {
		const cfg = preset();
		expect(zConfig.safeParse(cfg).success).toBe(true);
		expect(validateConfig(cfg).ok).toBe(true);
		const { gameConfig } = compileToGameConfig(cfg);
		expect(gameConfig.turnSchedule).toBe("simultaneous");
		expect(gameConfig.commitReveal).toBe(true);
		expect(gameConfig.inputMode).toBe("deduction");
		expect(gameConfig.deduction?.autoEliminate).toBe(true);
	});

	it("rejects commitReveal under alternating deduction", () => {
		const base = preset();
		expect(
			zConfig.safeParse({
				...base,
				turn: {
					mode: "turn",
					schedule: "alternating",
					commitReveal: true
				}
			}).success
		).toBe(false);
	});

	it("accepts autoEliminate false under commitReveal simultaneous", () => {
		const base = preset();
		expect(
			zConfig.safeParse({
				...base,
				deduction: { ...base.deduction!, autoEliminate: false }
			}).success
		).toBe(true);
	});
});

describe("kernel: hidden simultaneous deduction commits", () => {
	it("lists commitQuery/commitGuess; hides opponent commit in observe", () => {
		const { kernel } = compileConfig(preset());
		const state0 = kernel.initialState(42);
		expect(kernel.config.commitReveal).toBe(true);
		expect(canSearchJointActions(kernel)).toBe(false);

		const legalX = kernel.legalActions(state0, 0);
		expect(
			legalX.every(
				(a) => a.type === "commitQuery" || a.type === "commitGuess"
			)
		).toBe(true);
		expect(legalX.filter((a) => a.type === "commitQuery")).toHaveLength(4);

		const commit: KernelAction = {
			type: "commitQuery",
			player: "X",
			query: { type: "query", trait: "glasses", value: true }
		};
		const afterX = kernel.stepSync(state0, commit);
		expect(afterX.nextState.moveCount).toBe(0);
		expect(afterX.nextState.committedDeduction?.X?.kind).toBe("query");
		expect(afterX.events.some((e) => e.type === "queryAnswered")).toBe(
			false
		);

		const obsX = observe(kernel.config, afterX.nextState, "X");
		const obsO = observe(kernel.config, afterX.nextState, "O");
		expect(obsX.deduction?.pendingCommit?.kind).toBe("query");
		if (obsX.deduction?.pendingCommit?.kind === "query") {
			expect(obsX.deduction.pendingCommit.trait).toBe("glasses");
			expect(obsX.deduction.pendingCommit.value).toBe(true);
		}
		expect(obsO.deduction?.pendingCommit).toBeUndefined();

		// After X commits a query, O may only commitQuery (matching kind).
		const legalO = kernel.legalActions(afterX.nextState, 1);
		expect(legalO.every((a) => a.type === "commitQuery")).toBe(true);
		expect(legalO.some((a) => a.type === "commitGuess")).toBe(false);
	});

	it("reveals joint query when both seats commit", () => {
		const { kernel } = compileConfig(preset());
		const state0 = kernel.initialState(42);
		const afterX = kernel.stepSync(state0, {
			type: "commitQuery",
			player: "X",
			query: { type: "query", trait: "glasses", value: true }
		});
		const afterBoth = kernel.stepSync(afterX.nextState, {
			type: "commitQuery",
			player: "O",
			query: { type: "query", trait: "hat", value: true }
		});
		expect(afterBoth.nextState.moveCount).toBe(1);
		expect(afterBoth.nextState.committedDeduction).toBeUndefined();
		expect(afterBoth.nextState.deduction?.lastQueries?.X?.by).toBe("X");
		expect(afterBoth.nextState.deduction?.lastQueries?.O?.by).toBe("O");
		expect(
			afterBoth.events.filter((e) => e.type === "queryAnswered")
		).toHaveLength(2);
		expect(afterBoth.nextState.deduction?.eliminated.X).toBeDefined();
		expect(afterBoth.nextState.deduction?.eliminated.O).toBeDefined();
	});

	it("reveals joint guess when both seats commitGuess", () => {
		const { kernel } = compileConfig(preset());
		const state0 = kernel.initialState(42);
		const secretO = state0.deduction!.secret.O;
		const secretX = state0.deduction!.secret.X;
		const wrongFor = (secret: string) =>
			(["ann", "bob", "cara", "dan"] as const).find((id) => id !== secret)!;

		const afterX = kernel.stepSync(state0, {
			type: "commitGuess",
			player: "X",
			id: secretO
		});
		expect(afterX.nextState.committedDeduction?.X?.kind).toBe("guess");
		const legalO = kernel.legalActions(afterX.nextState, 1);
		expect(legalO.every((a) => a.type === "commitGuess")).toBe(true);

		const xWins = kernel.stepSync(afterX.nextState, {
			type: "commitGuess",
			player: "O",
			id: wrongFor(secretX)
		});
		expect(xWins.nextState.status).toBe("won");
		expect(xWins.nextState.winner).toBe("X");
		expect(xWins.events.filter((e) => e.type === "guessResult")).toHaveLength(
			2
		);
	});

	it("rejects open query under commitReveal (noop)", () => {
		const { kernel } = compileConfig(preset());
		const state0 = kernel.initialState(42);
		const result = kernel.stepSync(state0, {
			type: "query",
			trait: "glasses",
			value: true
		});
		expect(result.nextState).toEqual(state0);
		expect(result.events.some((e) => e.type === "ignored")).toBe(true);
	});

	it("stepPly fills both commits then reveals", () => {
		const { kernel } = compileConfig(preset());
		const state0 = kernel.initialState(42);
		const ply = stepPly(kernel, state0, pickFirst, 99);
		expect(ply).not.toBeNull();
		expect(ply!.nextState.moveCount).toBe(1);
		expect(ply!.nextState.committedDeduction).toBeUndefined();
	});

	it("replays commitQuery sequence via GameIR", () => {
		const { kernel, gameConfig } = compileConfig(preset());
		const actions: KernelAction[] = [
			{
				type: "commitQuery",
				player: "X",
				query: { type: "query", trait: "glasses", value: true }
			},
			{
				type: "commitQuery",
				player: "O",
				query: { type: "query", trait: "hat", value: false }
			}
		];
		const live = (() => {
			let s = kernel.initialState(42);
			let last = kernel.stepSync(s, actions[0]!);
			s = last.nextState;
			last = kernel.stepSync(s, actions[1]!);
			return last;
		})();
		const { finalState, faithful } = replayActions(gameConfig, actions, 42);
		expect(faithful).toBe(true);
		expect(finalState.moveCount).toBe(live.nextState.moveCount);
		expect(finalState.deduction?.eliminated).toEqual(
			live.nextState.deduction?.eliminated
		);
	});
});
