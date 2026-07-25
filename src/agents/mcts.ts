import type { GameState } from "@/engine/types";
import type {
	GameKernel,
	KernelAction,
	PlayerId,
	Seed
} from "@/engine/kernel";
import { playerOf } from "@/engine/kernel";
import { mulberry32 } from "@/engine/rng";
import type { Agent } from "@/agents/types";
import { createHuntAgent } from "@/agents/hunt";

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
		const pid = kernel.currentPlayer(s);
		const legal = kernel.legalActions(s, pid);
		if (legal.length === 0) break;
		const pick = legal[Math.floor(next() * legal.length)]!;
		s = kernel.stepSync(s, pick).nextState;
		depth += 1;
	}
	if (s.status === "won") {
		return s.winner === playerOf(rootPlayer) ? 1 : -1;
	}
	if (s.status === "draw") return 0;
	return 0;
}

/**
 * Tiny flat MCTS-ish: for each legal root action, run N random rollouts via
 * `kernel.stepSync` and pick the best mean score. On hit/miss configs, delegates
 * to the observation hunt agent (no hidden-fleet rollouts).
 */
export function createTinyMctsAgent(
	seed: Seed = 0,
	opts?: { rolloutsPerAction?: number; depthLimit?: number }
): Agent {
	const rolloutsPerAction = opts?.rolloutsPerAction ?? 12;
	const depthLimit = opts?.depthLimit ?? 24;
	let next = mulberry32(seed >>> 0);
	const hunt = createHuntAgent(seed);

	return {
		kind: "mcts",
		reset(s: Seed) {
			next = mulberry32(s >>> 0);
			hunt.reset(s);
		},
		act(kernel: GameKernel, state: GameState, player: PlayerId): KernelAction | null {
			const legal = kernel.legalActions(state, player);
			if (legal.length === 0) return null;

			if ((kernel.config.observationMode ?? "full") === "hit_miss") {
				const pick = hunt.act(kernel, state, player);
				return pick ? cloneAction(pick) : null;
			}

			let best = legal[0]!;
			let bestScore = Number.NEGATIVE_INFINITY;
			for (const action of legal) {
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
				const mean = sum / rolloutsPerAction;
				if (mean > bestScore) {
					bestScore = mean;
					best = action;
				}
			}
			return cloneAction(best);
		}
	};
}
