/**
 * Kernel-only agent seam (M6). Agents choose among `kernel.legalActions`.
 */
import type { GameState } from "@/engine/types";
import type {
	GameKernel,
	KernelAction,
	PlayerId,
	Seed
} from "@/engine/kernel";

export type AgentKind = "random" | "greedy" | "mcts" | "uct" | "hunt";

export type Agent = {
	readonly kind: AgentKind;
	reset(seed: Seed): void;
	/** Pick a legal action, or null if none. */
	act(
		kernel: GameKernel,
		state: GameState,
		player: PlayerId
	): KernelAction | null;
};
