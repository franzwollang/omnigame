/**
 * GameIR v0 — serializable action transcript + deterministic replay.
 *
 * Minimal M2 foothold: seed + applied actions → same final state.
 * Events are derived during replay (not stored) so the IR stays compact.
 * Full event-transcript IR can grow here without changing the Kernel ABI.
 */
import type { GameState } from "@/engine/types";
import {
	createGameKernel,
	type GameKernel,
	type KernelAction,
	type KernelEvent,
	type Seed,
	type StepResult
} from "@/engine/kernel";
import type { GameConfig } from "@/engine/reducer";

export const GAME_IR_VERSION = 1 as const;

/** Compact, JSON-serializable play transcript. */
export type GameIRTranscript = {
	version: typeof GAME_IR_VERSION;
	seed: Seed;
	actions: KernelAction[];
};

export type ReplayResult = {
	finalState: GameState;
	events: KernelEvent[];
	/** Actions that were applied (illegal/no-op steps omitted). */
	appliedActions: KernelAction[];
	/** True if every transcript action produced an `actionApplied` event. */
	faithful: boolean;
};

/** Build a v1 transcript from a seed and action list. */
export function createTranscript(
	actions: KernelAction[],
	seed: Seed = 0
): GameIRTranscript {
	return { version: GAME_IR_VERSION, seed, actions: [...actions] };
}

/** Extract applied actions from a kernel event log (sandbox / debug). */
export function actionsFromEventLog(events: KernelEvent[]): KernelAction[] {
	const actions: KernelAction[] = [];
	for (const event of events) {
		if (event.type === "actionApplied") actions.push(event.action);
	}
	return actions;
}

export function serializeTranscript(transcript: GameIRTranscript): string {
	return JSON.stringify(transcript);
}

export function parseTranscript(json: string): GameIRTranscript {
	const raw = JSON.parse(json) as unknown;
	if (!raw || typeof raw !== "object") {
		throw new Error("GameIR: transcript must be an object");
	}
	const obj = raw as Record<string, unknown>;
	if (obj.version !== GAME_IR_VERSION) {
		throw new Error(`GameIR: unsupported version ${String(obj.version)}`);
	}
	if (typeof obj.seed !== "number" || !Number.isFinite(obj.seed)) {
		throw new Error("GameIR: seed must be a finite number");
	}
	if (!Array.isArray(obj.actions)) {
		throw new Error("GameIR: actions must be an array");
	}
	return {
		version: GAME_IR_VERSION,
		seed: obj.seed,
		actions: obj.actions as KernelAction[]
	};
}

/**
 * Replay `seed + actions` through a kernel.
 * Illegal/no-op actions are recorded as `ignored` events; `faithful` is false
 * if any step was ignored (transcript may still be useful for debugging).
 */
export function replayTranscript(
	kernel: GameKernel,
	transcript: GameIRTranscript
): ReplayResult {
	let state = kernel.initialState(transcript.seed);
	const events: KernelEvent[] = [];
	const appliedActions: KernelAction[] = [];
	let faithful = true;

	for (const action of transcript.actions) {
		const result: StepResult = kernel.stepSync(
			state,
			action,
			transcript.seed
		);
		state = result.nextState;
		events.push(...result.events);
		const applied = result.events.some((e) => e.type === "actionApplied");
		if (applied) appliedActions.push(action);
		else faithful = false;
	}

	return { finalState: state, events, appliedActions, faithful };
}

/** Convenience: create kernel from flat config and replay. */
export function replayActions(
	config: GameConfig,
	actions: KernelAction[],
	seed: Seed = 0
): ReplayResult {
	const kernel = createGameKernel(config);
	return replayTranscript(kernel, createTranscript(actions, seed));
}
