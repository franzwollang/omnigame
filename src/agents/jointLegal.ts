/**
 * Joint legal enumeration for open simultaneous place/move and
 * commitReveal fresh-round plans (evaluated as simultaneousPlace).
 * Budget 1: scalar cartesian. Budget > 1: ordered distinct place tuples.
 */
import type { GameState } from "@/engine/types";
import { asPlacementList, pendingFingerprint } from "@/engine/types";
import type {
	GameKernel,
	KernelAction,
	PlayerId
} from "@/engine/kernel";
import {
	jointMoveFromActions,
	jointPlaceFromActions,
	jointPlacesFromActions,
	playerOf
} from "@/engine/kernel";

/** Open simultaneous place/move — joint cartesian is searchable (any budget). */
export function canSearchJointActions(kernel: GameKernel): boolean {
	if ((kernel.config.turnSchedule ?? "alternating") !== "simultaneous") {
		return false;
	}
	// Hidden commit-reveal uses a separate fresh-round plan search.
	if (kernel.config.commitReveal === true) return false;
	return true;
}

/** True when neither seat has committed yet this hidden round. */
export function isFreshCommitRound(state: GameState): boolean {
	const x = state.committedPlacements?.X?.length ?? 0;
	const o = state.committedPlacements?.O?.length ?? 0;
	return x === 0 && o === 0;
}

/**
 * Fresh commitReveal round: enumerate joint reveal outcomes as
 * `simultaneousPlace` (same combinatorics as open simultaneous).
 */
export function canSearchCommitRevealJoint(
	kernel: GameKernel,
	state: GameState
): boolean {
	if ((kernel.config.turnSchedule ?? "alternating") !== "simultaneous") {
		return false;
	}
	if (kernel.config.commitReveal !== true) return false;
	if (state.status !== "playing") return false;
	return isFreshCommitRound(state);
}

/**
 * Ordered length-`budget` tuples of distinct place actions (no within-seat dups).
 * Order matters: simultaneous multi-action applies indexed pairs as sub-steps.
 */
export function orderedDistinctPlaceTuples(
	places: readonly KernelAction[],
	budget: number
): KernelAction[][] {
	const pool = places.filter((a) => a.type === "place");
	if (budget <= 0 || pool.length < budget) return [];
	if (budget === 1) return pool.map((a) => [a]);

	const out: KernelAction[][] = [];
	const picked: KernelAction[] = [];
	const used = new Set<string>();

	const rec = () => {
		if (picked.length === budget) {
			out.push([...picked]);
			return;
		}
		for (const a of pool) {
			if (a.type !== "place") continue;
			const key = `${a.position.row},${a.position.col}`;
			if (used.has(key)) continue;
			used.add(key);
			picked.push(a);
			rec();
			picked.pop();
			used.delete(key);
		}
	};
	rec();
	return out;
}

function commitPlacesAsPlaceActions(
	commits: readonly KernelAction[]
): KernelAction[] {
	const out: KernelAction[] = [];
	for (const a of commits) {
		if (a.type === "commitPlace") {
			out.push({ type: "place", position: a.position });
		}
	}
	return out;
}

function enumeratePlaceJointsFromSeatPlaces(
	a0: readonly KernelAction[],
	a1: readonly KernelAction[],
	budget: number
): KernelAction[] {
	const out: KernelAction[] = [];
	if (budget <= 1) {
		for (const x of a0) {
			for (const o of a1) {
				const joint =
					jointPlaceFromActions(x, o) ?? jointMoveFromActions(x, o);
				if (joint) out.push(joint);
			}
		}
		return out;
	}
	const tuples0 = orderedDistinctPlaceTuples(a0, budget);
	const tuples1 = orderedDistinctPlaceTuples(a1, budget);
	for (const xs of tuples0) {
		for (const os of tuples1) {
			const joint = jointPlacesFromActions(xs, os);
			if (joint) out.push(joint);
		}
	}
	return out;
}

/**
 * Cartesian product of per-seat legals, composed into
 * `simultaneousPlace` / `simultaneousMove`. Empty when joint search is N/A.
 */
export function enumerateJointLegalActions(
	kernel: GameKernel,
	state: GameState
): KernelAction[] {
	if (!canSearchJointActions(kernel)) return [];
	if (state.status !== "playing") return [];

	const budget = kernel.config.actionsPerTurn ?? 1;
	const a0 = kernel.legalActions(state, 0);
	const a1 = kernel.legalActions(state, 1);
	return enumeratePlaceJointsFromSeatPlaces(a0, a1, budget);
}

/**
 * Fresh commitReveal: cartesian of commitPlace legals as `simultaneousPlace`
 * for perfect-info plan search / reveal simulation.
 */
export function enumerateCommitRevealJoints(
	kernel: GameKernel,
	state: GameState
): KernelAction[] {
	if (!canSearchCommitRevealJoint(kernel, state)) return [];
	const budget = kernel.config.actionsPerTurn ?? 1;
	const a0 = commitPlacesAsPlaceActions(kernel.legalActions(state, 0));
	const a1 = commitPlacesAsPlaceActions(kernel.legalActions(state, 1));
	return enumeratePlaceJointsFromSeatPlaces(a0, a1, budget);
}

/**
 * Extract the per-seat atomic action from a joint place/move for sandbox dual-`act`.
 * `index` selects which place in a multi-action array (default 0).
 */
export function seatComponentFromJoint(
	joint: KernelAction,
	player: PlayerId,
	index = 0
): KernelAction | null {
	if (joint.type === "simultaneousPlace") {
		const list = asPlacementList(
			player === 0 ? joint.placements.X : joint.placements.O
		);
		if (index < 0 || index >= list.length) return null;
		return { type: "place", position: list[index]! };
	}
	if (joint.type === "simultaneousMove") {
		if (index !== 0) return null;
		const m = player === 0 ? joint.moves.X : joint.moves.O;
		return { type: "move", from: m.from, to: m.to };
	}
	return null;
}

/**
 * Extract a `commitPlace` from a searched reveal joint for sequential sandbox
 * commitReveal clicks (X fills budget, then O).
 */
export function seatCommitFromJoint(
	joint: KernelAction,
	player: PlayerId,
	index = 0
): KernelAction | null {
	if (joint.type !== "simultaneousPlace") return null;
	const list = asPlacementList(
		player === 0 ? joint.placements.X : joint.placements.O
	);
	if (index < 0 || index >= list.length) return null;
	return {
		type: "commitPlace",
		player: playerOf(player),
		position: list[index]!
	};
}

/** How many atomic picks a joint encodes per seat (1 for moves / scalar place). */
export function jointSeatBudget(joint: KernelAction): number {
	if (joint.type === "simultaneousPlace") {
		return Math.max(
			asPlacementList(joint.placements.X).length,
			asPlacementList(joint.placements.O).length
		);
	}
	if (joint.type === "simultaneousMove") return 1;
	return 0;
}

/** Active seat under commitReveal (X fills entirely, then O — matches stepPly). */
export function activeCommitSeat(
	state: GameState,
	budget: number
): PlayerId | null {
	const xLen = state.committedPlacements?.X?.length ?? 0;
	const oLen = state.committedPlacements?.O?.length ?? 0;
	if (xLen < budget) return 0;
	if (oLen < budget) return 1;
	return null;
}

/** Fingerprint for caching a joint decision across dual `act(0)` / `act(1)` calls. */
export function jointStateFingerprint(state: GameState): string {
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
		state.koPoint ? `${state.koPoint.row},${state.koPoint.col}` : "",
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

/**
 * Round fingerprint for commitReveal plan cache — ignores `committedPlacements`
 * so sequential sandbox commits within a round share one searched plan.
 */
export function commitRevealRoundFingerprint(state: GameState): string {
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
		state.consecutivePasses ?? "",
		state.koPoint ? `${state.koPoint.row},${state.koPoint.col}` : "",
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
