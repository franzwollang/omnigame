import type { GameState } from "@/engine/types";
import type {
	GameKernel,
	KernelAction,
	PlayerId,
	Seed
} from "@/engine/kernel";
import { playerOf, stepPly } from "@/engine/kernel";
import { mulberry32 } from "@/engine/rng";
import type { Agent } from "@/agents/types";
import { createHuntAgent } from "@/agents/hunt";
import {
	canSearchJointActions,
	enumerateJointLegalActions,
	jointStateFingerprint,
	seatComponentFromJoint
} from "@/agents/jointLegal";

function cloneAction(action: KernelAction): KernelAction {
	return structuredClone(action);
}

function rolloutValue(
	kernel: GameKernel,
	state: GameState,
	rootPlayer: PlayerId,
	next: () => number,
	depthLimit: number
): number {
	let s = state;
	let depth = 0;
	while (s.status === "playing" && depth < depthLimit) {
		const result = stepPly(kernel, s, (_player, legal) => {
			if (legal.length === 0) return null;
			return legal[Math.floor(next() * legal.length)]!;
		});
		if (!result) break;
		s = result.nextState;
		depth += 1;
	}
	if (s.status === "won") {
		return s.winner === playerOf(rootPlayer) ? 1 : -1;
	}
	if (s.status === "draw") return 0;
	return 0;
}

function scoreRootAction(
	kernel: GameKernel,
	state: GameState,
	action: KernelAction,
	player: PlayerId,
	next: () => number,
	rolloutsPerAction: number,
	depthLimit: number
): number {
	let sum = 0;
	for (let i = 0; i < rolloutsPerAction; i++) {
		const after = kernel.stepSync(state, action).nextState;
		if (after.status === "won" && after.winner === playerOf(player)) {
			sum += 1;
			continue;
		}
		if (after.status === "won") {
			sum -= 1;
			continue;
		}
		if (after.status === "draw") continue;
		sum += rolloutValue(kernel, after, player, next, depthLimit);
	}
	return sum / rolloutsPerAction;
}

type JointDecisionCache = {
	fingerprint: string;
	joint: KernelAction;
};

/**
 * Tiny flat MCTS-ish: for each legal root action, run N random rollouts via
 * `kernel.stepSync` and pick the best mean score. Under open simultaneous
 * (budget 1), evaluates joint place/move actions and caches the decision for
 * dual-`act` consistency. On hit/miss configs, delegates to the observation
 * hunt agent (no hidden-fleet rollouts).
 */
export function createTinyMctsAgent(
	seed: Seed = 0,
	opts?: { rolloutsPerAction?: number; depthLimit?: number }
): Agent {
	const rolloutsPerAction = opts?.rolloutsPerAction ?? 12;
	const depthLimit = opts?.depthLimit ?? 24;
	let next = mulberry32(seed >>> 0);
	let jointCache: JointDecisionCache | null = null;
	const hunt = createHuntAgent(seed);

	return {
		kind: "mcts",
		reset(s: Seed) {
			next = mulberry32(s >>> 0);
			jointCache = null;
			hunt.reset(s);
		},
		act(kernel: GameKernel, state: GameState, player: PlayerId): KernelAction | null {
			const legal = kernel.legalActions(state, player);
			if (legal.length === 0) return null;

			if ((kernel.config.observationMode ?? "full") === "hit_miss") {
				const pick = hunt.act(kernel, state, player);
				return pick ? cloneAction(pick) : null;
			}

			const simultaneous =
				(kernel.config.turnSchedule ?? "alternating") === "simultaneous";

			if (simultaneous && !canSearchJointActions(kernel)) {
				// commitReveal / multi-action: joint cartesian deferred.
				return cloneAction(legal[Math.floor(next() * legal.length)]!);
			}

			if (simultaneous) {
				const fp = jointStateFingerprint(state);
				if (jointCache && jointCache.fingerprint === fp) {
					const seat = seatComponentFromJoint(jointCache.joint, player);
					return seat ? cloneAction(seat) : null;
				}

				const joints = enumerateJointLegalActions(kernel, state);
				if (joints.length === 0) return null;

				for (const joint of joints) {
					const after = kernel.stepSync(state, joint).nextState;
					if (
						after.status === "won" &&
						after.winner === playerOf(player)
					) {
						jointCache = { fingerprint: fp, joint };
						const seat = seatComponentFromJoint(joint, player);
						return seat ? cloneAction(seat) : null;
					}
				}

				let best = joints[0]!;
				let bestScore = Number.NEGATIVE_INFINITY;
				for (const joint of joints) {
					const mean = scoreRootAction(
						kernel,
						state,
						joint,
						player,
						next,
						rolloutsPerAction,
						depthLimit
					);
					if (mean > bestScore) {
						bestScore = mean;
						best = joint;
					}
				}
				jointCache = { fingerprint: fp, joint: best };
				const seat = seatComponentFromJoint(best, player);
				return seat ? cloneAction(seat) : null;
			}

			let best = legal[0]!;
			let bestScore = Number.NEGATIVE_INFINITY;
			for (const action of legal) {
				const mean = scoreRootAction(
					kernel,
					state,
					action,
					player,
					next,
					rolloutsPerAction,
					depthLimit
				);
				if (mean > bestScore) {
					bestScore = mean;
					best = action;
				}
			}
			return cloneAction(best);
		}
	};
}
