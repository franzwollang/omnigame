/**
 * Playability heuristics for sampled configs (M7).
 *
 * Pipeline: compile → opening legality → short random playout.
 * Labels: invalid | unplayable | noise | playable.
 */
import { compile } from "@/compiler";
import { createRandomAgent } from "@/agents";
import type { Config } from "@/schemas/config";
import type { PlayabilityReport } from "@/library/types";

export type AssessOptions = {
	/** Master seed for the probe (also used as kernel seed). */
	seed?: number;
	/** Max random playout steps. */
	maxPlayoutSteps?: number;
};

const DEFAULT_MAX_STEPS = 24;

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
	let state = kernel.initialState(seed);
	const player = kernel.currentPlayer(state);
	const opening = kernel.legalActions(state, player);

	if (opening.length === 0) {
		return {
			kind: "unplayable",
			reasons: ["no legal opening actions"],
			stepsTaken: 0,
			terminated: false,
			openingLegal: 0
		};
	}

	const agent = createRandomAgent(seed ^ 0x9e3779b9);
	let stepsTaken = 0;
	let terminated = false;

	for (let i = 0; i < maxSteps; i++) {
		if (state.status !== "playing") {
			terminated = true;
			break;
		}
		const p = kernel.currentPlayer(state);
		const action = agent.act(kernel, state, p);
		if (!action) {
			// No legal moves mid-game — stuck / draw-like noise for this probe
			break;
		}
		const before = state.moveCount;
		const result = kernel.stepSync(state, action);
		state = result.nextState;
		if (state.moveCount > before || result.events.some((e) => e.type !== "ignored")) {
			stepsTaken += 1;
		}
		if (result.terminal || state.status !== "playing") {
			terminated = true;
			break;
		}
	}

	if (terminated || stepsTaken >= Math.min(4, maxSteps)) {
		return {
			kind: "playable",
			reasons: terminated
				? [`random playout terminated after ${stepsTaken} steps`]
				: [`random playout progressed ${stepsTaken} steps`],
			stepsTaken,
			terminated,
			openingLegal: opening.length
		};
	}

	return {
		kind: "noise",
		reasons: [
			`compile ok but playout stalled (steps=${stepsTaken}, opening=${opening.length})`,
			summarizeMechanics(config)
		],
		stepsTaken,
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
