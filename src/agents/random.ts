import { mulberry32 } from "@/engine/rng";
import type { GameState } from "@/engine/types";
import type {
	GameKernel,
	KernelAction,
	PlayerId,
	Seed
} from "@/engine/kernel";
import type { Agent } from "@/agents/types";

/** Uniform random among `kernel.legalActions` (seeded). */
export function createRandomAgent(seed: Seed = 0): Agent {
	let next = mulberry32(seed >>> 0);

	return {
		kind: "random",
		reset(s: Seed) {
			next = mulberry32(s >>> 0);
		},
		act(kernel: GameKernel, state: GameState, player: PlayerId): KernelAction | null {
			const legal = kernel.legalActions(state, player);
			if (legal.length === 0) return null;
			const idx = Math.floor(next() * legal.length);
			return legal[Math.min(idx, legal.length - 1)] ?? null;
		}
	};
}
