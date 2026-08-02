export type { Agent, AgentKind } from "@/agents/types";
export { createRandomAgent } from "@/agents/random";
export { createGreedyAgent } from "@/agents/greedy";
export { createTinyMctsAgent } from "@/agents/mcts";
export { createUctAgent, actionKey } from "@/agents/uct";
export { createHuntAgent, pickHuntFireAction } from "@/agents/hunt";
export {
	activeCommitSeat,
	canSearchCommitRevealJoint,
	canSearchJointActions,
	commitRevealRoundFingerprint,
	enumerateCommitRevealJoints,
	enumerateJointLegalActions,
	isFreshCommitRound,
	jointSeatBudget,
	orderedDistinctPlaceTuples,
	seatCommitFromJoint,
	seatComponentFromJoint
} from "@/agents/jointLegal";

import type { Seed } from "@/engine/kernel";
import type { Agent, AgentKind } from "@/agents/types";
import { createRandomAgent } from "@/agents/random";
import { createGreedyAgent } from "@/agents/greedy";
import { createTinyMctsAgent } from "@/agents/mcts";
import { createUctAgent } from "@/agents/uct";
import { createHuntAgent } from "@/agents/hunt";

export function createAgent(kind: AgentKind, seed: Seed = 0): Agent {
	switch (kind) {
		case "random":
			return createRandomAgent(seed);
		case "greedy":
			return createGreedyAgent(seed);
		case "mcts":
			return createTinyMctsAgent(seed);
		case "uct":
			return createUctAgent(seed);
		case "hunt":
			return createHuntAgent(seed);
	}
}
