/**
 * Playability heuristics for sampled configs (M7 + depth).
 *
 * Pipeline: compile → opening legality → random playout → greedy dual probe.
 * Labels: invalid | unplayable | noise | playable (+ score 0–100).
 */
import { compile } from "@/compiler";
import { createGreedyAgent, createRandomAgent } from "@/agents";
import type { Config } from "@/schemas/config";
import type { PlayabilityReport } from "@/library/types";
import type { GameKernel, KernelAction, PlayerId } from "@/engine/kernel";
import { stepPly } from "@/engine/kernel";
import type { GameState } from "@/engine/types";

export type AssessOptions = {
	/** Master seed for the probe (also used as kernel seed). */
	seed?: number;
	/** Max random playout steps. */
	maxPlayoutSteps?: number;
	/** Max greedy dual-probe steps (defaults to maxPlayoutSteps). */
	maxGreedySteps?: number;
};

const DEFAULT_MAX_STEPS = 24;

type PlayoutStats = {
	stepsTaken: number;
	terminated: boolean;
	playersMoved: Set<string>;
};

function runPlayout(
	kernel: GameKernel,
	start: GameState,
	pickAction: (
		kernel: GameKernel,
		state: GameState,
		player: PlayerId
	) => KernelAction | null,
	maxSteps: number
): PlayoutStats {
	let state = start;
	let stepsTaken = 0;
	let terminated = false;
	const playersMoved = new Set<string>();

	for (let i = 0; i < maxSteps; i++) {
		if (state.status !== "playing") {
			terminated = true;
			break;
		}
		const before = state.moveCount;
		const sideBefore = kernel.currentPlayer(state);
		const result = stepPly(kernel, state, (player, _legal) =>
			pickAction(kernel, state, player)
		);
		if (!result) break;
		state = result.nextState;
		if (
			state.moveCount > before ||
			result.events.some((e) => e.type !== "ignored")
		) {
			stepsTaken += 1;
			if (sideBefore === "simultaneous") {
				playersMoved.add("0");
				playersMoved.add("1");
			} else {
				playersMoved.add(String(sideBefore));
			}
		}
		if (result.terminal || state.status !== "playing") {
			terminated = true;
			break;
		}
	}

	return { stepsTaken, terminated, playersMoved };
}

/**
 * Score a playable find: branching, progress, termination, dual-agent signal.
 * Pure / deterministic for fixed probe stats.
 */
export function scorePlayable(opts: {
	openingLegal: number;
	random: PlayoutStats;
	greedy: PlayoutStats;
}): number {
	let score = 0;
	score += Math.min(30, opts.openingLegal * 2);
	score += Math.min(25, opts.random.stepsTaken);
	if (opts.random.terminated) score += 20;
	if (opts.random.playersMoved.size >= 2) score += 10;
	// Greedy dual probe: stronger play finds terminal or more progress
	if (opts.greedy.terminated) score += 10;
	else if (opts.greedy.stepsTaken > opts.random.stepsTaken) score += 5;
	return Math.min(100, Math.max(0, score));
}

/**
 * Assess whether a raw config object is playable vs noise.
 * Pure / deterministic for a given seed.
 */
export function assessPlayability(
	raw: unknown,
	opts: AssessOptions = {}
): PlayabilityReport {
	const seed = (opts.seed ?? 0) >>> 0;
	const maxSteps = opts.maxPlayoutSteps ?? DEFAULT_MAX_STEPS;
	const greedySteps = opts.maxGreedySteps ?? maxSteps;

	const compiled = compile(raw);
	if (!compiled.ok) {
		return {
			kind: "invalid",
			reasons: compiled.errors.slice(0, 5),
			stepsTaken: 0,
			terminated: false
		};
	}

	const { kernel, config } = compiled;
	const initial = kernel.initialState(seed);
	const side = kernel.currentPlayer(initial);
	const openingPlayer: PlayerId = side === "simultaneous" ? 0 : side;
	const opening = kernel.legalActions(initial, openingPlayer);

	if (opening.length === 0) {
		return {
			kind: "unplayable",
			reasons: ["no legal opening actions"],
			stepsTaken: 0,
			terminated: false,
			openingLegal: 0
		};
	}

	const randomAgent = createRandomAgent(seed ^ 0x9e3779b9);
	const random = runPlayout(
		kernel,
		initial,
		(k, s, p) => randomAgent.act(k, s, p),
		maxSteps
	);

	const greedyAgent = createGreedyAgent(seed ^ 0x85ebca6b);
	const greedy = runPlayout(
		kernel,
		initial,
		(k, s, p) => greedyAgent.act(k, s, p),
		greedySteps
	);

	const progressed =
		random.terminated ||
		random.stepsTaken >= Math.min(4, maxSteps) ||
		greedy.terminated ||
		greedy.stepsTaken >= Math.min(4, maxSteps);

	if (progressed) {
		const score = scorePlayable({
			openingLegal: opening.length,
			random,
			greedy
		});
		const reasons: string[] = [];
		if (random.terminated) {
			reasons.push(`random playout terminated after ${random.stepsTaken} steps`);
		} else {
			reasons.push(`random playout progressed ${random.stepsTaken} steps`);
		}
		if (greedy.terminated) {
			reasons.push(`greedy probe terminated after ${greedy.stepsTaken} steps`);
		} else if (greedy.stepsTaken > 0) {
			reasons.push(`greedy probe progressed ${greedy.stepsTaken} steps`);
		}
		reasons.push(`score=${score}`);

		return {
			kind: "playable",
			reasons,
			stepsTaken: Math.max(random.stepsTaken, greedy.stepsTaken),
			terminated: random.terminated || greedy.terminated,
			openingLegal: opening.length,
			score
		};
	}

	return {
		kind: "noise",
		reasons: [
			`compile ok but playout stalled (steps=${random.stepsTaken}/${greedy.stepsTaken}, opening=${opening.length})`,
			summarizeMechanics(config)
		],
		stepsTaken: random.stepsTaken,
		terminated: false,
		openingLegal: opening.length
	};
}

function summarizeMechanics(config: Config): string {
	const bits = [
		`grid=${config.grid.width}x${config.grid.height}/${config.grid.topology}`,
		`input=${config.input.mode}`,
		`placement=${config.placement.mode}`,
		`objective=${config.objective.mode}`
	];
	return bits.join(" ");
}
