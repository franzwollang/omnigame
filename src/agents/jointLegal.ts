/**
 * Joint legal enumeration for open simultaneous place/move (budget 1).
 * Used by UCT/MCTS root search; commitReveal and multi-action stay deferred.
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
	jointPlaceFromActions
} from "@/engine/kernel";

/** Open simultaneous place/move with one action per seat — joint cartesian is searchable. */
export function canSearchJointActions(kernel: GameKernel): boolean {
	if ((kernel.config.turnSchedule ?? "alternating") !== "simultaneous") {
		return false;
	}
	if (kernel.config.commitReveal === true) return false;
	if ((kernel.config.actionsPerTurn ?? 1) > 1) return false;
	return true;
}

/**
 * Cartesian product of per-seat `legalActions`, composed into
 * `simultaneousPlace` / `simultaneousMove`. Empty when joint search is N/A.
 */
export function enumerateJointLegalActions(
	kernel: GameKernel,
	state: GameState
): KernelAction[] {
	if (!canSearchJointActions(kernel)) return [];
	if (state.status !== "playing") return [];
	const a0 = kernel.legalActions(state, 0);
	const a1 = kernel.legalActions(state, 1);
	const out: KernelAction[] = [];
	for (const x of a0) {
		for (const o of a1) {
			const joint =
				jointPlaceFromActions(x, o) ?? jointMoveFromActions(x, o);
			if (joint) out.push(joint);
		}
	}
	return out;
}

/** Extract the per-seat atomic action from a joint place/move for sandbox dual-`act`. */
export function seatComponentFromJoint(
	joint: KernelAction,
	player: PlayerId
): KernelAction | null {
	if (joint.type === "simultaneousPlace") {
		const list = asPlacementList(
			player === 0 ? joint.placements.X : joint.placements.O
		);
		if (list.length !== 1) return null;
		return { type: "place", position: list[0]! };
	}
	if (joint.type === "simultaneousMove") {
		const m = player === 0 ? joint.moves.X : joint.moves.O;
		return { type: "move", from: m.from, to: m.to };
	}
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
