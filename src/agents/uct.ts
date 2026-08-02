/**
 * UCT tree-search agent (post-M7). Stronger than flat per-root-action MCTS:
 * shared tree, UCB1 selection, optional reuse across `act` calls when the
 * live state matches a prior tree node.
 */
import type { GameState } from "@/engine/types";
import { asPlacementList, pendingFingerprint } from "@/engine/types";
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
	activeCommitSeat,
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

const DEFAULT_SIMULATIONS = 80;
const DEFAULT_DEPTH_LIMIT = 32;
const DEFAULT_EXPLORATION = Math.SQRT1_2; // ≈ 0.707 — common UCT constant

type JointDecisionCache = {
	fingerprint: string;
	joint: KernelAction;
	/** Next place-index per seat for multi-action dual-`act` (mod budget). */
	nextIndex: { 0: number; 1: number };
	/** When true, emit `commitPlace` (commitReveal sequential sandbox). */
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

/** Skip exhaustive joint win scan when this seat cannot reach n-in-a-row this round. */
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
		case "simultaneousPlace": {
			const xs = asPlacementList(action.placements.X);
			const os = asPlacementList(action.placements.O);
			return `joint:${xs.map((p) => `${p.row},${p.col}`).join("+")}|${os.map((p) => `${p.row},${p.col}`).join("+")}`;
		}
		case "simultaneousMove": {
			const fmt = (m: { from: { row: number; col: number }; to: { row: number; col: number } }) =>
				`${m.from.row},${m.from.col}->${m.to.row},${m.to.col}`;
			return `jointMove:${fmt(action.moves.X)}|${fmt(action.moves.O)}`;
		}
		case "commitPlace":
			return `commit:${action.player}:${action.position.row},${action.position.col}`;
		case "query":
			return `query:${action.trait}=${action.value}`;
		case "guess":
			return `guess:${action.id}`;
	}
}

function stateFingerprint(state: GameState): string {
	return [
		state.status,
		state.currentPlayer,
		state.moveCount,
		state.winner ?? "",
		state.actionsRemaining ?? "",
		state.turnPhaseIndex ?? "",
		(state.pendingPlaces ?? [])
			.map((p) => pendingFingerprint(p))
			.join(";"),
		state.committedPlacements
			? `cX:${(state.committedPlacements.X ?? []).map((p) => `${p.row},${p.col}`).join("+")}|cO:${(state.committedPlacements.O ?? []).map((p) => `${p.row},${p.col}`).join("+")}`
			: "",
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
		state.hidden?.cells.join(",") ?? "",
		state.deduction
			? `d:${state.deduction.secret.X}/${state.deduction.secret.O}|eX:${state.deduction.eliminated.X.join(",")}|eO:${state.deduction.eliminated.O.join(",")}|lq:${state.deduction.lastQuery ? `${state.deduction.lastQuery.by}:${state.deduction.lastQuery.trait}=${state.deduction.lastQuery.value}:${state.deduction.lastQuery.answer}` : ""}`
			: ""
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
		const result = stepPly(kernel, s, (_player, legal) => {
			if (legal.length === 0) return null;
			return legal[Math.floor(next() * legal.length)]!;
		});
		if (!result) break;
		s = result.nextState;
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
	const side = kernel.currentPlayer(state);
	let untried: KernelAction[] = [];
	if (state.status === "playing") {
		if (side === "simultaneous") {
			if (canSearchJointActions(kernel)) {
				untried = enumerateJointLegalActions(kernel, state);
			} else if (canSearchCommitRevealJoint(kernel, state)) {
				untried = enumerateCommitRevealJoints(kernel, state);
			} else if (kernel.config.commitReveal === true) {
				const budget = kernel.config.actionsPerTurn ?? 1;
				const active = activeCommitSeat(state, budget);
				untried =
					active == null ? [] : [...kernel.legalActions(state, active)];
			} else {
				untried = [];
			}
		} else {
			untried = [...kernel.legalActions(state, side)];
		}
	}
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
	const maximize = toMove === rootPlayer || toMove === "simultaneous";
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
 * Under open simultaneous (any `actionsPerTurn`), searches the joint
 * place/move cartesian and caches the chosen joint so sandbox dual-/multi-`act`
 * stays consistent. Under commitReveal, searches fresh-round reveal joints
 * (as `simultaneousPlace`) and caches `commitPlace` emissions for sequential
 * sandbox clicks. On hit/miss configs, delegates to the observation hunt agent.
 */
export function createUctAgent(seed: Seed = 0, opts?: UctOptions): Agent {
	const simulations = opts?.simulations ?? DEFAULT_SIMULATIONS;
	const depthLimit = opts?.depthLimit ?? DEFAULT_DEPTH_LIMIT;
	const exploration = opts?.exploration ?? DEFAULT_EXPLORATION;
	const reuseTree = opts?.reuseTree ?? true;
	let next = mulberry32(seed >>> 0);
	let priorRoot: UctNode | null = null;
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
					priorRoot = null;
					const seat = seatPickFromCache(jointCache, player);
					return seat ? cloneAction(seat) : null;
				}
			}
		}

		const root =
			(reuseTree ? findReuseRoot(priorRoot, stateFingerprint(state)) : null) ??
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

		const bestJoint = bestRootAction(root) ?? joints[0]!;
		jointCache = freshCache(bestJoint);
		priorRoot = reuseTree ? root : null;
		const seat = seatPickFromCache(jointCache, player);
		return seat ? cloneAction(seat) : null;
	};

	return {
		kind: "uct",
		reset(s: Seed) {
			next = mulberry32(s >>> 0);
			priorRoot = null;
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

				// Mid-round without a cached plan: per-seat UCT over commitPlace.
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
