/**
 * UCT tree-search agent (post-M7). Stronger than flat per-root-action MCTS:
 * shared tree, UCB1 selection, optional reuse across `act` calls when the
 * live state matches a prior tree node.
 */
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

const DEFAULT_SIMULATIONS = 80;
const DEFAULT_DEPTH_LIMIT = 32;
const DEFAULT_EXPLORATION = Math.SQRT1_2; // ≈ 0.707 — common UCT constant

export function actionKey(action: KernelAction): string {
	switch (action.type) {
		case "place":
			return `place:${action.position.row},${action.position.col}`;
		case "move":
			return `move:${action.from.row},${action.from.col}->${action.to.row},${action.to.col}`;
		case "fire":
			return `fire:${action.position.row},${action.position.col}`;
		case "activateColumn":
			return `col:${action.col}`;
		case "activateRow":
			return `row:${action.row}`;
		case "popOutColumn":
			return `pop:${action.col}`;
		case "popOutRow":
			return `popRow:${action.row}`;
		case "tick":
			return "tick";
		case "pass":
			return "pass";
	}
}

function stateFingerprint(state: GameState): string {
	return [
		state.status,
		state.currentPlayer,
		state.moveCount,
		state.winner ?? "",
		state.consecutivePasses ?? "",
		state.koPoint
			? `${state.koPoint.row},${state.koPoint.col}`
			: "",
		(state.positionHistory ?? []).join(";"),
		state.phase ?? "combat",
		state.fleetProgress
			? `X:${state.fleetProgress.X.shipIndex}:${state.fleetProgress.X.done}:${state.fleetProgress.X.cells.map((c) => `${c.row},${c.col}`).join(";")}|O:${state.fleetProgress.O.shipIndex}:${state.fleetProgress.O.done}:${state.fleetProgress.O.cells.map((c) => `${c.row},${c.col}`).join(";")}`
			: "",
		state.grid.cells.join(","),
		state.hidden?.cells.join(",") ?? ""
	].join("|");
}

function cloneAction(action: KernelAction): KernelAction {
	return structuredClone(action);
}

function terminalValue(state: GameState, rootPlayer: PlayerId): number {
	if (state.status === "won") {
		return state.winner === playerOf(rootPlayer) ? 1 : -1;
	}
	if (state.status === "draw") return 0;
	return 0;
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
	return terminalValue(s, rootPlayer);
}

type UctNode = {
	state: GameState;
	/** Action from parent that produced this node; null for root. */
	actionFromParent: KernelAction | null;
	parent: UctNode | null;
	children: Map<string, UctNode>;
	untried: KernelAction[];
	visits: number;
	/** Cumulative value from the root player's perspective. */
	totalValue: number;
	fingerprint: string;
};

function makeNode(
	state: GameState,
	kernel: GameKernel,
	actionFromParent: KernelAction | null,
	parent: UctNode | null
): UctNode {
	const pid = kernel.currentPlayer(state);
	const untried =
		state.status === "playing" ? [...kernel.legalActions(state, pid)] : [];
	return {
		state,
		actionFromParent,
		parent,
		children: new Map(),
		untried,
		visits: 0,
		totalValue: 0,
		fingerprint: stateFingerprint(state)
	};
}

/**
 * UCB1 over children. Values are stored from `rootPlayer`'s perspective, so
 * the side to move maximizes mean and the opponent minimizes (maximize -mean).
 */
function selectChild(
	node: UctNode,
	kernel: GameKernel,
	rootPlayer: PlayerId,
	exploration: number
): UctNode {
	const toMove = kernel.currentPlayer(node.state);
	const maximize = toMove === rootPlayer;
	let best: UctNode | null = null;
	let bestScore = Number.NEGATIVE_INFINITY;
	for (const child of Array.from(node.children.values())) {
		if (child.visits === 0) {
			return child;
		}
		const mean = child.totalValue / child.visits;
		const exploit = maximize ? mean : -mean;
		const explore =
			exploration * Math.sqrt(Math.log(node.visits) / child.visits);
		const score = exploit + explore;
		if (score > bestScore) {
			bestScore = score;
			best = child;
		}
	}
	return best!;
}

/** Walk to a leaf via UCB1, expanding one untried action when present. */
function selectAndExpand(
	kernel: GameKernel,
	root: UctNode,
	rootPlayer: PlayerId,
	exploration: number,
	next: () => number
): UctNode {
	let node = root;
	while (node.state.status === "playing") {
		if (node.untried.length > 0) {
			const uidx = Math.floor(next() * node.untried.length);
			const action = node.untried[uidx]!;
			node.untried.splice(uidx, 1);
			const nextState = kernel.stepSync(node.state, action).nextState;
			const child = makeNode(nextState, kernel, action, node);
			node.children.set(actionKey(action), child);
			return child;
		}
		if (node.children.size === 0) return node;
		node = selectChild(node, kernel, rootPlayer, exploration);
	}
	return node;
}

function backpropagate(node: UctNode, value: number): void {
	let cur: UctNode | null = node;
	while (cur) {
		cur.visits += 1;
		cur.totalValue += value;
		cur = cur.parent;
	}
}

function findReuseRoot(start: UctNode | null, fingerprint: string): UctNode | null {
	if (!start) return null;
	const queue: UctNode[] = [start];
	const seen = new Set<UctNode>();
	while (queue.length > 0) {
		const n = queue.shift()!;
		if (seen.has(n)) continue;
		seen.add(n);
		if (n.fingerprint === fingerprint) {
			n.parent = null;
			n.actionFromParent = null;
			return n;
		}
		for (const child of Array.from(n.children.values())) queue.push(child);
	}
	return null;
}

function bestRootAction(root: UctNode): KernelAction | null {
	let best: UctNode | null = null;
	for (const child of Array.from(root.children.values())) {
		if (!best || child.visits > best.visits) best = child;
	}
	return best?.actionFromParent ?? null;
}

export type UctOptions = {
	simulations?: number;
	depthLimit?: number;
	exploration?: number;
	/** Keep the search tree across `act` calls when state matches a node. */
	reuseTree?: boolean;
};

/**
 * UCT (UCB1) Monte Carlo tree search over `kernel.legalActions` / `stepSync`.
 * On hit/miss configs, delegates to the observation hunt agent (no hidden
 * fleet rollouts under partial information).
 */
export function createUctAgent(seed: Seed = 0, opts?: UctOptions): Agent {
	const simulations = opts?.simulations ?? DEFAULT_SIMULATIONS;
	const depthLimit = opts?.depthLimit ?? DEFAULT_DEPTH_LIMIT;
	const exploration = opts?.exploration ?? DEFAULT_EXPLORATION;
	const reuseTree = opts?.reuseTree ?? true;
	let next = mulberry32(seed >>> 0);
	let priorRoot: UctNode | null = null;
	const hunt = createHuntAgent(seed);

	return {
		kind: "uct",
		reset(s: Seed) {
			next = mulberry32(s >>> 0);
			priorRoot = null;
			hunt.reset(s);
		},
		act(kernel: GameKernel, state: GameState, player: PlayerId): KernelAction | null {
			const legal = kernel.legalActions(state, player);
			if (legal.length === 0) return null;

			if ((kernel.config.observationMode ?? "full") === "hit_miss") {
				const pick = hunt.act(kernel, state, player);
				return pick ? cloneAction(pick) : null;
			}

			// One-move win: take immediately (same as greedy / flat MCTS).
			for (const action of legal) {
				const after = kernel.stepSync(state, action).nextState;
				if (after.status === "won" && after.winner === playerOf(player)) {
					priorRoot = null;
					return cloneAction(action);
				}
			}

			const fp = stateFingerprint(state);
			const root =
				(reuseTree ? findReuseRoot(priorRoot, fp) : null) ??
				makeNode(state, kernel, null, null);

			for (let i = 0; i < simulations; i++) {
				const leaf = selectAndExpand(
					kernel,
					root,
					player,
					exploration,
					next
				);
				const value =
					leaf.state.status === "playing"
						? rolloutValue(kernel, leaf.state, player, next, depthLimit)
						: terminalValue(leaf.state, player);
				backpropagate(leaf, value);
			}

			const pick = bestRootAction(root) ?? legal[0]!;
			priorRoot = reuseTree ? root : null;
			return cloneAction(pick);
		}
	};
}
