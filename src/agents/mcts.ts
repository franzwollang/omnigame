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
	canSearchCommitRevealJoint,
	canSearchJointActions,
	commitRevealRoundFingerprint,
	enumerateCommitRevealJoints,
	enumerateJointLegalActions,
	jointSeatBudget,
	jointStateFingerprint,
	seatCommitFromJoint,
	seatComponentFromJoint
} from "@/agents/jointLegal";

/** Cap flat root scoring when multi-action cartesian explodes (e.g. 5184). */
const MAX_FLAT_JOINT_EVALS = 96;

function cloneAction(action: KernelAction): KernelAction {
	return structuredClone(action);
}

function mayWinThisJointRound(
	kernel: GameKernel,
	state: GameState,
	player: PlayerId
): boolean {
	const winLen = kernel.config.winLength;
	if (winLen == null || winLen <= 0) return true;
	const token = playerOf(player);
	let count = 0;
	for (const c of state.grid.cells) {
		if (c === token) count += 1;
	}
	const budget = kernel.config.actionsPerTurn ?? 1;
	return count + budget >= winLen;
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

/** Partial Fisher–Yates sample when the joint cartesian is too large for flat eval. */
function sampleJoints(
	joints: readonly KernelAction[],
	next: () => number,
	cap: number
): KernelAction[] {
	if (joints.length <= cap) return [...joints];
	const copy = [...joints];
	const out: KernelAction[] = [];
	for (let i = 0; i < cap; i++) {
		const j = i + Math.floor(next() * (copy.length - i));
		const tmp = copy[i]!;
		copy[i] = copy[j]!;
		copy[j] = tmp;
		out.push(copy[i]!);
	}
	return out;
}

type JointDecisionCache = {
	fingerprint: string;
	joint: KernelAction;
	nextIndex: { 0: number; 1: number };
	asCommit?: boolean;
};

function seatPickFromCache(
	cache: JointDecisionCache,
	player: PlayerId
): KernelAction | null {
	const budget = jointSeatBudget(cache.joint);
	if (budget <= 0) return null;
	const idx = cache.nextIndex[player] % budget;
	cache.nextIndex[player] = idx + 1;
	if (cache.asCommit) {
		return seatCommitFromJoint(cache.joint, player, idx);
	}
	return seatComponentFromJoint(cache.joint, player, idx);
}

/**
 * Tiny flat MCTS-ish: for each legal root action, run N random rollouts via
 * `kernel.stepSync` and pick the best mean score. Under open simultaneous
 * (any budget), evaluates joint place/move/query/guess actions and caches the
 * decision for dual-/multi-`act` consistency. Under commitReveal, evaluates
 * fresh-round reveal joints and caches sequential `commitPlace` picks
 * (deduction commitReveal joint search deferred). Large multi-action
 * cartesians are sampled to keep flat eval bounded. On hit/miss configs,
 * delegates to the observation hunt agent (no hidden-fleet rollouts).
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

	const searchJointRoot = (
		kernel: GameKernel,
		state: GameState,
		player: PlayerId,
		joints: KernelAction[],
		fp: string,
		asCommit: boolean
	): KernelAction | null => {
		const freshCache = (joint: KernelAction): JointDecisionCache => ({
			fingerprint: fp,
			joint,
			nextIndex: { 0: 0, 1: 0 },
			asCommit
		});

		if (mayWinThisJointRound(kernel, state, player)) {
			for (const joint of joints) {
				const after = kernel.stepSync(state, joint).nextState;
				if (
					after.status === "won" &&
					after.winner === playerOf(player)
				) {
					jointCache = freshCache(joint);
					const seat = seatPickFromCache(jointCache, player);
					return seat ? cloneAction(seat) : null;
				}
			}
		}

		const scored = sampleJoints(joints, next, MAX_FLAT_JOINT_EVALS);
		let best = scored[0]!;
		let bestScore = Number.NEGATIVE_INFINITY;
		for (const joint of scored) {
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
		jointCache = freshCache(best);
		const seat = seatPickFromCache(jointCache, player);
		return seat ? cloneAction(seat) : null;
	};

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
			const commitReveal = kernel.config.commitReveal === true;

			if (simultaneous && commitReveal) {
				const roundFp = commitRevealRoundFingerprint(state);
				if (
					jointCache &&
					jointCache.asCommit &&
					jointCache.fingerprint === roundFp
				) {
					const seat = seatPickFromCache(jointCache, player);
					return seat ? cloneAction(seat) : null;
				}

				if (canSearchCommitRevealJoint(kernel, state)) {
					const joints = enumerateCommitRevealJoints(kernel, state);
					if (joints.length === 0) return null;
					return searchJointRoot(
						kernel,
						state,
						player,
						joints,
						roundFp,
						true
					);
				}
				// Mid-round without cache: flat score over seat commitPlace.
			} else if (simultaneous && canSearchJointActions(kernel)) {
				const fp = jointStateFingerprint(state);
				if (
					jointCache &&
					!jointCache.asCommit &&
					jointCache.fingerprint === fp
				) {
					const seat = seatPickFromCache(jointCache, player);
					return seat ? cloneAction(seat) : null;
				}

				const joints = enumerateJointLegalActions(kernel, state);
				if (joints.length === 0) return null;
				return searchJointRoot(kernel, state, player, joints, fp, false);
			} else if (simultaneous) {
				return cloneAction(legal[Math.floor(next() * legal.length)]!);
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
