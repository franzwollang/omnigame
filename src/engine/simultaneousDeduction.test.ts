import { describe, expect, it } from "vitest";
import { compileConfig, compileToGameConfig } from "@/compiler";
import { observe } from "@/engine/observation";
import { canSearchJointActions } from "@/agents/jointLegal";
import {
	jointGuessFromActions,
	jointQueryFromActions,
	stepPly,
	type KernelAction,
	type PlayerId
} from "@/engine/kernel";
import { validateConfig } from "@/engine/validateConfig";
import { replayActions } from "@/ir/gameIr";
import { examplePresets } from "@/presets/registry";
import { zConfig } from "@/schemas/config";

const preset = () => examplePresets["simultaneous-guess-who-lite"].config;

function pickFirst(
	_player: PlayerId,
	legal: KernelAction[]
): KernelAction | null {
	return legal[0] ?? null;
}

describe("schema: simultaneous × deduction", () => {
	it("accepts the simultaneous-guess-who-lite preset", () => {
		const cfg = preset();
		expect(zConfig.safeParse(cfg).success).toBe(true);
		expect(validateConfig(cfg).ok).toBe(true);
		const { gameConfig } = compileToGameConfig(cfg);
		expect(gameConfig.turnSchedule).toBe("simultaneous");
		expect(gameConfig.inputMode).toBe("deduction");
		expect(gameConfig.observationMode).toBe("deduction");
		expect(gameConfig.deduction?.queryShape).toBe("single");
		expect(gameConfig.deduction?.autoEliminate).toBe(true);
	});

	it("rejects autoEliminate false and phases; allows compound queryShape and commitReveal", () => {
		const base = preset();
		expect(
			zConfig.safeParse({
				...base,
				deduction: {
					...base.deduction!,
					queryShape: "and",
					traits: ["glasses", "hat"],
					roster: base.deduction!.roster
				}
			}).success
		).toBe(true);

		expect(
			zConfig.safeParse({
				...base,
				deduction: {
					...base.deduction!,
					queryShape: "or",
					traits: ["glasses", "hat"],
					roster: base.deduction!.roster
				}
			}).success
		).toBe(true);

		expect(
			zConfig.safeParse({
				...base,
				deduction: { ...base.deduction!, autoEliminate: false }
			}).success
		).toBe(false);

		expect(
			zConfig.safeParse({
				...base,
				turn: {
					mode: "turn",
					schedule: "simultaneous",
					phases: ["query", "guess"]
				}
			}).success
		).toBe(false);

		expect(
			zConfig.safeParse({
				...base,
				turn: {
					mode: "turn",
					schedule: "simultaneous",
					commitReveal: true
				}
			}).success
		).toBe(true);
	});
});

describe("kernel: simultaneous joint query / guess", () => {
	it("exposes per-seat queries and guesses; currentPlayer is simultaneous", () => {
		const { kernel } = compileConfig(preset());
		const state0 = kernel.initialState(42);
		expect(kernel.currentPlayer(state0)).toBe("simultaneous");
		const a0 = kernel.legalActions(state0, 0);
		const a1 = kernel.legalActions(state0, 1);
		expect(a0.every((a) => a.type === "query" || a.type === "guess")).toBe(
			true
		);
		expect(a1.every((a) => a.type === "query" || a.type === "guess")).toBe(
			true
		);
		expect(a0.filter((a) => a.type === "query")).toHaveLength(4);
		expect(canSearchJointActions(kernel)).toBe(false);
	});

	it("joint query prunes each seat independently and records lastQueries", () => {
		const { kernel } = compileConfig(preset());
		const state0 = kernel.initialState(42);
		const qx: KernelAction = {
			type: "query",
			trait: "glasses",
			value: true
		};
		const qo: KernelAction = { type: "query", trait: "hat", value: true };
		const joint = jointQueryFromActions(qx, qo);
		expect(joint?.type).toBe("simultaneousQuery");
		const result = kernel.stepSync(state0, joint!);
		expect(result.nextState.moveCount).toBe(1);
		expect(result.nextState.currentPlayer).toBe(state0.currentPlayer);
		expect(result.nextState.deduction?.lastQueries?.X?.by).toBe("X");
		expect(result.nextState.deduction?.lastQueries?.O?.by).toBe("O");
		expect(
			result.events.filter((e) => e.type === "queryAnswered")
		).toHaveLength(2);

		const obsX = observe(kernel.config, result.nextState, "X");
		const obsO = observe(kernel.config, result.nextState, "O");
		expect(obsX.deduction?.lastQuery?.by).toBe("X");
		expect(obsO.deduction?.lastQuery?.by).toBe("O");
		expect(obsX.deduction?.lastQuery?.trait).toBe("glasses");
		expect(obsO.deduction?.lastQuery?.trait).toBe("hat");
		expect(result.nextState.deduction?.eliminated.X).toBeDefined();
		expect(result.nextState.deduction?.eliminated.O).toBeDefined();
	});

	it("single query under simultaneous is a noop / ignored", () => {
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

	it("stepJoint / stepPly compose joint queries", () => {
		const { kernel } = compileConfig(preset());
		const state0 = kernel.initialState(42);
		const qx = kernel
			.legalActions(state0, 0)
			.find((a) => a.type === "query")!;
		const qo = kernel
			.legalActions(state0, 1)
			.find((a) => a.type === "query")!;
		const stepped = kernel.stepJointSync(state0, { 0: qx, 1: qo });
		expect(stepped.nextState.moveCount).toBe(1);
		expect(
			stepped.events.some((e) => e.type === "actionApplied")
		).toBe(true);

		const ply = stepPly(kernel, state0, pickFirst, 99);
		expect(ply).not.toBeNull();
		expect(ply!.nextState.moveCount).toBe(1);
	});

	it("joint guess: one correct wins; both correct draws; both wrong continues", () => {
		const { kernel } = compileConfig(preset());
		const state0 = kernel.initialState(42);
		const secretO = state0.deduction!.secret.O;
		const secretX = state0.deduction!.secret.X;
		const ids = ["ann", "bob", "cara", "dan"] as const;
		const wrongFor = (secret: string) =>
			ids.find((id) => id !== secret)!;

		const xWins = kernel.stepSync(state0, {
			type: "simultaneousGuess",
			guesses: { X: secretO, O: wrongFor(secretX) }
		});
		expect(xWins.nextState.status).toBe("won");
		expect(xWins.nextState.winner).toBe("X");

		const draw = kernel.stepSync(state0, {
			type: "simultaneousGuess",
			guesses: { X: secretO, O: secretX }
		});
		expect(draw.nextState.status).toBe("draw");

		const bothWrong = kernel.stepSync(state0, {
			type: "simultaneousGuess",
			guesses: { X: wrongFor(secretO), O: wrongFor(secretX) }
		});
		expect(bothWrong.nextState.status).toBe("playing");
		expect(bothWrong.nextState.moveCount).toBe(1);

		const built = jointGuessFromActions(
			{ type: "guess", id: secretO },
			{ type: "guess", id: secretX }
		);
		expect(built?.type).toBe("simultaneousGuess");
	});

	it("replays simultaneousQuery via GameIR", () => {
		const { kernel, gameConfig } = compileConfig(preset());
		const state0 = kernel.initialState(42);
		const action: KernelAction = {
			type: "simultaneousQuery",
			queries: {
				X: { type: "query", trait: "glasses", value: true },
				O: { type: "query", trait: "hat", value: false }
			}
		};
		const live = kernel.stepSync(state0, action);
		const { finalState, faithful } = replayActions(gameConfig, [action], 42);
		expect(faithful).toBe(true);
		expect(finalState.moveCount).toBe(live.nextState.moveCount);
		expect(finalState.deduction?.eliminated).toEqual(
			live.nextState.deduction?.eliminated
		);
	});
});
