export type { Agent, AgentKind } from "@/agents/types";
export { createRandomAgent } from "@/agents/random";
export { createGreedyAgent } from "@/agents/greedy";
export { createTinyMctsAgent } from "@/agents/mcts";

import type { Seed } from "@/engine/kernel";
import type { Agent, AgentKind } from "@/agents/types";
import { createRandomAgent } from "@/agents/random";
import { createGreedyAgent } from "@/agents/greedy";
import { createTinyMctsAgent } from "@/agents/mcts";

export function createAgent(kind: AgentKind, seed: Seed = 0): Agent {
	switch (kind) {
		case "random":
			return createRandomAgent(seed);
		case "greedy":
			return createGreedyAgent(seed);
		case "mcts":
			return createTinyMctsAgent(seed);
	}
}
