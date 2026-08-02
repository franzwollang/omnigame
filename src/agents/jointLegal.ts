/**
 * Joint legal enumeration for open simultaneous place/move/deduction and
 * commitReveal fresh-round plans (evaluated as simultaneousPlace /
 * simultaneousMove / simultaneousQuery / simultaneousGuess /
 * simultaneousEliminate).
 * Budget 1: scalar cartesian. Budget > 1: ordered distinct place tuples or
 * chained move sequences. Deduction: kind-matched query×query + guess×guess +
 * eliminate×eliminate (budget 1; commitReveal maps commit* → open joints
 * including commitEliminate and commitMove).
 */
import type { GameState, Grid, Player } from "@/engine/types";
import {
	asMoveList,
	asPlacementList,
	getCell,
	pendingFingerprint,
	setCell
} from "@/engine/types";
import type {
	GameKernel,
	KernelAction,
	PlayerId
} from "@/engine/kernel";
import {
	jointEliminateFromActions,
	jointGuessFromActions,
	jointMoveFromActions,
	jointMovesFromActions,
	jointPlaceFromActions,
	jointPlacesFromActions,
	jointQueryFromActions,
	playerOf
} from "@/engine/kernel";
import { formatQueryFingerprint } from "@/engine/deduction";
import {
	canMove,
	legalDestinations,
	movementBoardFrom
} from "@/engine/movement";
import { allActivePositions } from "@/engine/topology";

/**
 * Open simultaneous place/move/deduction — joint cartesian is searchable
 * (any budget for place; deduction is always budget 1). CommitReveal uses
 * a separate fresh-round plan search (place + move + deduction).
 */
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
	const placeFresh =
		(state.committedPlacements?.X?.length ?? 0) === 0 &&
		(state.committedPlacements?.O?.length ?? 0) === 0;
	const moveFresh =
		(state.committedMoves?.X?.length ?? 0) === 0 &&
		(state.committedMoves?.O?.length ?? 0) === 0;
	const deductionFresh =
		state.committedDeduction?.X == null &&
		state.committedDeduction?.O == null;
	return placeFresh && moveFresh && deductionFresh;
}

/**
 * Fresh commitReveal round: enumerate joint reveal outcomes as
 * `simultaneousPlace` / `simultaneousMove` / `simultaneousQuery` /
 * `simultaneousGuess` / `simultaneousEliminate` (same combinatorics as open
 * simultaneous for that input mode).
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

/**
 * Ordered length-`budget` move chains for one seat, simulating solo sequential
 * applies (same-piece chaining). Joint resolve still revalidates indexed pairs.
 */
export function orderedMoveChains(
	kernel: GameKernel,
	state: GameState,
	player: PlayerId,
	budget: number
): KernelAction[][] {
	if (budget <= 0) return [];
	const seat: Player = playerOf(player);
	const movement = kernel.config.movement;
	if (!movement) return [];
	const board = movementBoardFrom(kernel.config);
	const out: KernelAction[][] = [];

	const rec = (grid: Grid, picked: KernelAction[]) => {
		if (picked.length === budget) {
			out.push([...picked]);
			return;
		}
		for (const from of allActivePositions(
			grid,
			kernel.config.topology ?? "rectangle",
			kernel.config.graph
		)) {
			if (getCell(grid, from) !== seat) continue;
			for (const to of legalDestinations(grid, from, movement, board)) {
				if (!canMove(grid, from, to, seat, movement, board)) continue;
				const action: KernelAction = { type: "move", from, to };
				// Reject duplicate pairs within the chain.
				if (
					picked.some(
						(p) =>
							p.type === "move" &&
							p.from.row === from.row &&
							p.from.col === from.col &&
							p.to.row === to.row &&
							p.to.col === to.col
					)
				) {
					continue;
				}
				let cells = setCell(grid, from, null);
				cells = setCell({ ...grid, cells }, to, seat);
				picked.push(action);
				rec({ ...grid, cells }, picked);
				picked.pop();
			}
		}
	};
	rec(state.grid, []);
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

/** Map private commitMove legals to open move actions. */
function commitMovesAsMoveActions(
	commits: readonly KernelAction[]
): KernelAction[] {
	const out: KernelAction[] = [];
	for (const a of commits) {
		if (a.type === "commitMove") {
			out.push({ type: "move", from: a.from, to: a.to });
		}
	}
	return out;
}

/** Map private commitQuery/commitGuess/commitEliminate legals to open actions. */
function commitDeductionAsOpenActions(
	commits: readonly KernelAction[]
): KernelAction[] {
	const out: KernelAction[] = [];
	for (const a of commits) {
		if (a.type === "commitQuery") {
			out.push({
				type: "query",
				trait: a.query.trait,
				value: a.query.value,
				clauses: a.query.clauses
			});
		} else if (a.type === "commitGuess") {
			out.push({ type: "guess", id: a.id });
		} else if (a.type === "commitEliminate") {
			out.push({ type: "eliminate", id: a.id });
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

function enumerateMoveJointsFromChains(
	chains0: readonly KernelAction[][],
	chains1: readonly KernelAction[][]
): KernelAction[] {
	const out: KernelAction[] = [];
	for (const xs of chains0) {
		for (const os of chains1) {
			const joint = jointMovesFromActions(xs, os);
			if (joint) out.push(joint);
		}
	}
	return out;
}

/**
 * Kind-matched cartesian for simultaneous deduction:
 * query×query → `simultaneousQuery`, guess×guess → `simultaneousGuess`,
 * eliminate×eliminate → `simultaneousEliminate`.
 */
function enumerateDeductionJointsFromSeatActions(
	a0: readonly KernelAction[],
	a1: readonly KernelAction[]
): KernelAction[] {
	const out: KernelAction[] = [];
	const q0 = a0.filter((a) => a.type === "query");
	const q1 = a1.filter((a) => a.type === "query");
	const g0 = a0.filter((a) => a.type === "guess");
	const g1 = a1.filter((a) => a.type === "guess");
	const e0 = a0.filter((a) => a.type === "eliminate");
	const e1 = a1.filter((a) => a.type === "eliminate");
	for (const x of q0) {
		for (const o of q1) {
			const joint = jointQueryFromActions(x, o);
			if (joint) out.push(joint);
		}
	}
	for (const x of g0) {
		for (const o of g1) {
			const joint = jointGuessFromActions(x, o);
			if (joint) out.push(joint);
		}
	}
	for (const x of e0) {
		for (const o of e1) {
			const joint = jointEliminateFromActions(x, o);
			if (joint) out.push(joint);
		}
	}
	return out;
}

/**
 * Cartesian product of per-seat legals, composed into
 * `simultaneousPlace` / `simultaneousMove` / `simultaneousQuery` /
 * `simultaneousGuess` / `simultaneousEliminate`. Empty when joint search is N/A.
 */
export function enumerateJointLegalActions(
	kernel: GameKernel,
	state: GameState
): KernelAction[] {
	if (!canSearchJointActions(kernel)) return [];
	if (state.status !== "playing") return [];

	const a0 = kernel.legalActions(state, 0);
	const a1 = kernel.legalActions(state, 1);
	if ((kernel.config.inputMode ?? "cell") === "deduction") {
		return enumerateDeductionJointsFromSeatActions(a0, a1);
	}
	const budget = kernel.config.actionsPerTurn ?? 1;
	if ((kernel.config.inputMode ?? "cell") === "move" && budget > 1) {
		return enumerateMoveJointsFromChains(
			orderedMoveChains(kernel, state, 0, budget),
			orderedMoveChains(kernel, state, 1, budget)
		);
	}
	return enumeratePlaceJointsFromSeatPlaces(a0, a1, budget);
}

/**
 * Fresh commitReveal: cartesian of commit legals evaluated as open joints
 * (`simultaneousPlace` / `simultaneousMove` / `simultaneousQuery` /
 * `simultaneousGuess` / `simultaneousEliminate`) for perfect-info plan search /
 * reveal simulation.
 */
export function enumerateCommitRevealJoints(
	kernel: GameKernel,
	state: GameState
): KernelAction[] {
	if (!canSearchCommitRevealJoint(kernel, state)) return [];
	if ((kernel.config.inputMode ?? "cell") === "deduction") {
		const a0 = commitDeductionAsOpenActions(kernel.legalActions(state, 0));
		const a1 = commitDeductionAsOpenActions(kernel.legalActions(state, 1));
		return enumerateDeductionJointsFromSeatActions(a0, a1);
	}
	if ((kernel.config.inputMode ?? "cell") === "move") {
		const budget = kernel.config.actionsPerTurn ?? 1;
		if (budget <= 1) {
			const a0 = commitMovesAsMoveActions(kernel.legalActions(state, 0));
			const a1 = commitMovesAsMoveActions(kernel.legalActions(state, 1));
			return enumeratePlaceJointsFromSeatPlaces(a0, a1, 1);
		}
		return enumerateMoveJointsFromChains(
			orderedMoveChains(kernel, state, 0, budget),
			orderedMoveChains(kernel, state, 1, budget)
		);
	}
	const budget = kernel.config.actionsPerTurn ?? 1;
	const a0 = commitPlacesAsPlaceActions(kernel.legalActions(state, 0));
	const a1 = commitPlacesAsPlaceActions(kernel.legalActions(state, 1));
	return enumeratePlaceJointsFromSeatPlaces(a0, a1, budget);
}

/**
 * Extract the per-seat atomic action from a joint place/move/query/guess/
 * eliminate for sandbox dual-`act`. `index` selects which place/move in a
 * multi-action array (default 0; ignored for query/guess/eliminate).
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
		const list = asMoveList(player === 0 ? joint.moves.X : joint.moves.O);
		if (index < 0 || index >= list.length) return null;
		const m = list[index]!;
		return { type: "move", from: m.from, to: m.to };
	}
	if (joint.type === "simultaneousQuery") {
		if (index !== 0) return null;
		const q = player === 0 ? joint.queries.X : joint.queries.O;
		return {
			type: "query",
			trait: q.trait,
			value: q.value,
			clauses: q.clauses
		};
	}
	if (joint.type === "simultaneousGuess") {
		if (index !== 0) return null;
		const id = player === 0 ? joint.guesses.X : joint.guesses.O;
		return { type: "guess", id };
	}
	if (joint.type === "simultaneousEliminate") {
		if (index !== 0) return null;
		const id = player === 0 ? joint.eliminations.X : joint.eliminations.O;
		return { type: "eliminate", id };
	}
	return null;
}

/**
 * Extract a private commit from a searched reveal joint for sequential sandbox
 * commitReveal clicks (X fills budget, then O). Place → `commitPlace`;
 * move → `commitMove`; query/guess/eliminate → `commitQuery` / `commitGuess` /
 * `commitEliminate`.
 */
export function seatCommitFromJoint(
	joint: KernelAction,
	player: PlayerId,
	index = 0
): KernelAction | null {
	if (joint.type === "simultaneousPlace") {
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
	if (joint.type === "simultaneousMove") {
		const list = asMoveList(player === 0 ? joint.moves.X : joint.moves.O);
		if (index < 0 || index >= list.length) return null;
		const m = list[index]!;
		return {
			type: "commitMove",
			player: playerOf(player),
			from: m.from,
			to: m.to
		};
	}
	if (joint.type === "simultaneousQuery") {
		if (index !== 0) return null;
		const q = player === 0 ? joint.queries.X : joint.queries.O;
		return {
			type: "commitQuery",
			player: playerOf(player),
			query: {
				type: "query",
				trait: q.trait,
				value: q.value,
				clauses: q.clauses
			}
		};
	}
	if (joint.type === "simultaneousGuess") {
		if (index !== 0) return null;
		const id = player === 0 ? joint.guesses.X : joint.guesses.O;
		return {
			type: "commitGuess",
			player: playerOf(player),
			id
		};
	}
	if (joint.type === "simultaneousEliminate") {
		if (index !== 0) return null;
		const id = player === 0 ? joint.eliminations.X : joint.eliminations.O;
		return {
			type: "commitEliminate",
			player: playerOf(player),
			id
		};
	}
	return null;
}

/**
 * How many atomic picks a joint encodes per seat (1 for scalar move / place /
 * query / guess / eliminate; N for multi-action place or move arrays).
 */
export function jointSeatBudget(joint: KernelAction): number {
	if (joint.type === "simultaneousPlace") {
		return Math.max(
			asPlacementList(joint.placements.X).length,
			asPlacementList(joint.placements.O).length
		);
	}
	if (joint.type === "simultaneousMove") {
		return Math.max(
			asMoveList(joint.moves.X).length,
			asMoveList(joint.moves.O).length
		);
	}
	if (
		joint.type === "simultaneousQuery" ||
		joint.type === "simultaneousGuess" ||
		joint.type === "simultaneousEliminate"
	) {
		return 1;
	}
	return 0;
}

/**
 * Active seat under commitReveal (X fills entirely, then O — matches stepPly).
 * Pass `deduction: true` for commitQuery/commitGuess/commitEliminate rounds
 * (one commit/seat). Pass `move: true` for commitMove rounds.
 */
export function activeCommitSeat(
	state: GameState,
	budget: number,
	opts?: { deduction?: boolean; move?: boolean }
): PlayerId | null {
	if (opts?.deduction) {
		if (state.committedDeduction?.X == null) return 0;
		if (state.committedDeduction?.O == null) return 1;
		return null;
	}
	if (opts?.move) {
		const xLen = state.committedMoves?.X?.length ?? 0;
		const oLen = state.committedMoves?.O?.length ?? 0;
		if (xLen < budget) return 0;
		if (oLen < budget) return 1;
		return null;
	}
	const xLen = state.committedPlacements?.X?.length ?? 0;
	const oLen = state.committedPlacements?.O?.length ?? 0;
	if (xLen < budget) return 0;
	if (oLen < budget) return 1;
	return null;
}

function committedMovesFingerprint(state: GameState): string {
	if (!state.committedMoves) return "";
	const fmt = (
		list: { from: { row: number; col: number }; to: { row: number; col: number } }[] | undefined
	) =>
		(list ?? [])
			.map(
				(m) =>
					`${m.from.row},${m.from.col}->${m.to.row},${m.to.col}`
			)
			.join("+");
	return `cmX:${fmt(state.committedMoves.X)}|cmO:${fmt(state.committedMoves.O)}`;
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
		committedMovesFingerprint(state),
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
			? `d:${state.deduction.secret.X}/${state.deduction.secret.O}|eX:${state.deduction.eliminated.X.join(",")}|eO:${state.deduction.eliminated.O.join(",")}|lq:${state.deduction.lastQuery ? `${state.deduction.lastQuery.by}:${formatQueryFingerprint(state.deduction.lastQuery)}` : ""}`
			: ""
	].join("|");
}

/**
 * Round fingerprint for commitReveal plan cache — ignores `committedPlacements`
 * / `committedMoves` so sequential sandbox commits within a round share one
 * searched plan.
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
			? `d:${state.deduction.secret.X}/${state.deduction.secret.O}|eX:${state.deduction.eliminated.X.join(",")}|eO:${state.deduction.eliminated.O.join(",")}|lq:${state.deduction.lastQuery ? `${state.deduction.lastQuery.by}:${formatQueryFingerprint(state.deduction.lastQuery)}` : ""}`
			: ""
	].join("|");
}
