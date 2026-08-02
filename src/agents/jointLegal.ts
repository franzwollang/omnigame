/**
 * Joint legal enumeration for open simultaneous place/move.
 * Budget 1: scalar cartesian. Budget > 1: ordered distinct place tuples.
 * commitReveal stays deferred (multi-step commit tree).
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
	jointPlacesFromActions
} from "@/engine/kernel";

/** Open simultaneous place/move — joint cartesian is searchable (any budget). */
export function canSearchJointActions(kernel: GameKernel): boolean {
	if ((kernel.config.turnSchedule ?? "alternating") !== "simultaneous") {
		return false;
	}
	// Hidden commit-reveal needs a multi-step commit tree — still deferred.
	if (kernel.config.commitReveal === true) return false;
	return true;
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

	// Multi-action simultaneous is place-only (schema forbids move + budget > 1).
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
