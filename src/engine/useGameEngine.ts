// React hook: sandbox play through GameKernel (M1) + GameIR action log (M2)

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import type { GameState, Player, Position } from "./types";
import { getCell } from "./types";
import type { GameConfig } from "./reducer";
import {
	createGameKernel,
	formatKernelEvent,
	jointMoveFromActions,
	jointMovesFromActions,
	jointPlaceFromActions,
	jointPlacesFromActions,
	type GameKernel,
	type IllegalReason,
	type KernelAction,
	type KernelEvent,
	type PlayerId,
	type Seed
} from "@/engine/kernel";
import { listHasPosition, positionsEqual, setCell, type MovePair } from "@/engine/types";
import {
	canMove,
	movementBoardFrom
} from "@/engine/movement";
import {
	createInitialTurnContext,
	type TurnContext
} from "@/engine/turnMachine";
import {
	actionsFromEventLog,
	createTranscript,
	replayTranscript,
	type GameIRTranscript
} from "@/ir/gameIr";

export { formatKernelEvent };

const EVENT_LOG_CAP = 40;
/** Applied actions kept for GameIR replay (separate from UI event slice). */
const ACTION_LOG_CAP = 256;
const DEFAULT_SEED: Seed = 0;

function turnContextFor(state: GameState): TurnContext {
	if (state.status !== "playing") return { phase: "ended" };
	return { phase: "awaitInput" };
}

export type PendingPlacements = Partial<Record<Player, Position[]>>;
export type PendingMoves = Partial<Record<Player, MovePair[]>>;

function commitLen(
	commits: GameState["committedPlacements"],
	player: Player
): number {
	return commits?.[player]?.length ?? 0;
}

function pendingMoveLen(
	pending: PendingMoves,
	player: Player
): number {
	return pending[player]?.length ?? 0;
}

export function useGameEngine(config: GameConfig, seed: Seed = DEFAULT_SEED) {
	const kernel: GameKernel = useMemo(() => createGameKernel(config), [config]);
	const simultaneous =
		(config.turnSchedule ?? "alternating") === "simultaneous";
	const simultaneousMove =
		simultaneous && (config.inputMode ?? "cell") === "move";
	const commitReveal = simultaneous && config.commitReveal === true;
	const resolveOrder = simultaneous
		? (config.resolveOrder ?? "joint")
		: "joint";
	const actionsPerRound = simultaneous ? (config.actionsPerTurn ?? 1) : 1;

	const [state, setState] = useState<GameState>(() =>
		kernel.initialState(seed)
	);
	const [lastEvents, setLastEvents] = useState<KernelEvent[]>([]);
	const [eventLog, setEventLog] = useState<KernelEvent[]>([]);
	const [actionLog, setActionLog] = useState<KernelAction[]>([]);
	const [selectedFrom, setSelectedFrom] = useState<Position | null>(null);
	const [pendingPlacements, setPendingPlacements] = useState<PendingPlacements>(
		{}
	);
	const [pendingMoves, setPendingMoves] = useState<PendingMoves>({});
	const [lastIllegal, setLastIllegal] = useState<{
		reason: IllegalReason;
		detail: string;
	} | null>(null);
	const [turnContext, setTurnContext] = useState<TurnContext>(() =>
		createInitialTurnContext()
	);
	const stateRef = useRef(state);
	stateRef.current = state;
	const seedRef = useRef(seed);
	seedRef.current = seed;
	const actionLogRef = useRef(actionLog);
	actionLogRef.current = actionLog;
	const selectedFromRef = useRef<Position | null>(null);
	selectedFromRef.current = selectedFrom;
	const pendingRef = useRef<PendingPlacements>({});
	pendingRef.current = pendingPlacements;
	const pendingMovesRef = useRef<PendingMoves>({});
	pendingMovesRef.current = pendingMoves;

	const transcript: GameIRTranscript = useMemo(
		() => createTranscript(actionLog, seed),
		[actionLog, seed]
	);

	// Reinit when kernel/config/seed changes
	useEffect(() => {
		const next = kernel.initialState(seed);
		stateRef.current = next;
		setState(next);
		setLastEvents([]);
		setEventLog([]);
		setActionLog([]);
		selectedFromRef.current = null;
		setSelectedFrom(null);
		pendingRef.current = {};
		setPendingPlacements({});
		pendingMovesRef.current = {};
		setPendingMoves({});
		setLastIllegal(null);
		setTurnContext(turnContextFor(next));
	}, [kernel, seed]);

	const applyAction = useCallback(
		(action: KernelAction) => {
			const side = kernel.currentPlayer(stateRef.current);
			const explainPlayer: PlayerId =
				action.type === "commitPlace" ||
				action.type === "commitMove" ||
				action.type === "commitQuery" ||
				action.type === "commitGuess" ||
				action.type === "commitEliminate"
					? action.player === "X"
						? 0
						: 1
					: side === "simultaneous"
						? 0
						: side;
			const explained = kernel.explainAction(
				stateRef.current,
				explainPlayer,
				action
			);
			if (!explained.legal) {
				setLastIllegal({
					reason: explained.reason,
					detail: explained.detail
				});
			} else {
				setLastIllegal(null);
			}
			const result = kernel.stepSync(
				stateRef.current,
				action,
				seedRef.current
			);
			stateRef.current = result.nextState;
			setState(result.nextState);
			setLastEvents(result.events);
			setEventLog((log) =>
				[...log, ...result.events].slice(-EVENT_LOG_CAP)
			);
			const applied = actionsFromEventLog(result.events);
			if (applied.length > 0) {
				setActionLog((log) =>
					[...log, ...applied].slice(-ACTION_LOG_CAP)
				);
			}
			pendingRef.current = {};
			setPendingPlacements({});
			pendingMovesRef.current = {};
			setPendingMoves({});
			selectedFromRef.current = null;
			setSelectedFrom(null);
			setTurnContext(turnContextFor(result.nextState));
			return result;
		},
		[kernel]
	);

	/** Which seat is choosing next in simultaneous / commit-reveal collection. */
	const simultaneousSeat: Player | null = useMemo(() => {
		if (!simultaneous || state.status !== "playing") return null;
		if (simultaneousMove) {
			if (commitReveal) {
				if (!state.committedMoves?.X) return "X";
				if (!state.committedMoves?.O) return "O";
				return null;
			}
			if (pendingMoveLen(pendingMoves, "X") < actionsPerRound) return "X";
			if (pendingMoveLen(pendingMoves, "O") < actionsPerRound) return "O";
			return null;
		}
		if (commitReveal) {
			if ((config.inputMode ?? "cell") === "deduction") {
				if (!state.committedDeduction?.X) return "X";
				if (!state.committedDeduction?.O) return "O";
				return null;
			}
			if (commitLen(state.committedPlacements, "X") < actionsPerRound)
				return "X";
			if (commitLen(state.committedPlacements, "O") < actionsPerRound)
				return "O";
			return null;
		}
		const xLen = pendingPlacements.X?.length ?? 0;
		const oLen = pendingPlacements.O?.length ?? 0;
		if (xLen < actionsPerRound) return "X";
		if (oLen < actionsPerRound) return "O";
		return null;
	}, [
		simultaneous,
		simultaneousMove,
		commitReveal,
		state.status,
		state.committedPlacements,
		state.committedMoves,
		state.committedDeduction,
		pendingPlacements,
		pendingMoves,
		actionsPerRound,
		config.inputMode
	]);

	const placeMove = useCallback(
		(pos: Position) => {
			if (simultaneous && simultaneousMove) {
				if (commitReveal) {
					const seat: Player | null = !stateRef.current.committedMoves?.X
						? "X"
						: !stateRef.current.committedMoves?.O
							? "O"
							: null;
					if (!seat) return;
					const selected = selectedFromRef.current;
					const occupant = getCell(stateRef.current.grid, pos);
					if (!selected) {
						if (occupant === seat) {
							selectedFromRef.current = pos;
							setSelectedFrom(pos);
						}
						return;
					}
					if (positionsEqual(selected, pos)) {
						selectedFromRef.current = null;
						setSelectedFrom(null);
						return;
					}
					if (occupant === seat) {
						selectedFromRef.current = pos;
						setSelectedFrom(pos);
						return;
					}
					applyAction({
						type: "commitMove",
						player: seat,
						from: selected,
						to: pos
					});
					selectedFromRef.current = null;
					setSelectedFrom(null);
					return;
				}
				const seat: Player | null =
					pendingMoveLen(pendingMovesRef.current, "X") < actionsPerRound
						? "X"
						: pendingMoveLen(pendingMovesRef.current, "O") < actionsPerRound
							? "O"
							: null;
				if (!seat) return;
				const selected = selectedFromRef.current;
				const occupant = getCell(stateRef.current.grid, pos);
				const ownPending = pendingMovesRef.current[seat] ?? [];
				if (!selected) {
					// Continue a chain from the last submitted destination when possible.
					if (ownPending.length > 0) {
						const lastTo = ownPending[ownPending.length - 1]!.to;
						if (positionsEqual(lastTo, pos) || occupant === seat) {
							selectedFromRef.current = positionsEqual(lastTo, pos)
								? lastTo
								: pos;
							setSelectedFrom(selectedFromRef.current);
						}
						return;
					}
					if (occupant === seat) {
						selectedFromRef.current = pos;
						setSelectedFrom(pos);
					}
					return;
				}
				if (positionsEqual(selected, pos)) {
					selectedFromRef.current = null;
					setSelectedFrom(null);
					return;
				}
				if (occupant === seat && ownPending.length === 0) {
					selectedFromRef.current = pos;
					setSelectedFrom(pos);
					return;
				}
				// Validate against a board with this seat's prior pending moves applied solo.
				let probe = stateRef.current.grid;
				for (const prior of ownPending) {
					let cells = setCell(probe, prior.from, null);
					cells = setCell({ ...probe, cells }, prior.to, seat);
					probe = { ...probe, cells };
				}
				const movement = config.movement;
				const moveOk =
					!!movement &&
					canMove(
						probe,
						selected,
						pos,
						seat,
						movement,
						movementBoardFrom(config)
					);
				if (!moveOk) {
					setLastIllegal({
						reason: "invalid_destination",
						detail: "Illegal move for this simultaneous round"
					});
					return;
				}
				setLastIllegal(null);
				const nextOwn = [...ownPending, { from: selected, to: pos }];
				const nextPending: PendingMoves = {
					...pendingMovesRef.current,
					[seat]: nextOwn
				};
				pendingMovesRef.current = nextPending;
				setPendingMoves(nextPending);
				selectedFromRef.current = null;
				setSelectedFrom(null);
				const nx = pendingMoveLen(nextPending, "X");
				const no = pendingMoveLen(nextPending, "O");
				if (nx === actionsPerRound && no === actionsPerRound) {
					const joint =
						actionsPerRound <= 1
							? jointMoveFromActions(
									{
										type: "move",
										from: nextPending.X![0]!.from,
										to: nextPending.X![0]!.to
									},
									{
										type: "move",
										from: nextPending.O![0]!.from,
										to: nextPending.O![0]!.to
									}
								)
							: jointMovesFromActions(
									nextPending.X!.map((m) => ({
										type: "move" as const,
										from: m.from,
										to: m.to
									})),
									nextPending.O!.map((m) => ({
										type: "move" as const,
										from: m.from,
										to: m.to
									}))
								);
					if (joint) applyAction(joint);
				} else if (nextOwn.length < actionsPerRound) {
					// Auto-select landing cell to continue a same-piece chain.
					selectedFromRef.current = pos;
					setSelectedFrom(pos);
				}
				return;
			}
			if (simultaneous) {
				if (commitReveal) {
					const seat =
						commitLen(stateRef.current.committedPlacements, "X") <
						actionsPerRound
							? "X"
							: commitLen(stateRef.current.committedPlacements, "O") <
								  actionsPerRound
								? "O"
								: null;
					if (!seat) return;
					applyAction({
						type: "commitPlace",
						player: seat,
						position: pos
					});
					return;
				}
				const xLen = pendingRef.current.X?.length ?? 0;
				const oLen = pendingRef.current.O?.length ?? 0;
				const seat =
					xLen < actionsPerRound ? "X" : oLen < actionsPerRound ? "O" : null;
				if (!seat) return;
				const own = pendingRef.current[seat] ?? [];
				if (listHasPosition(own, pos)) {
					setLastIllegal({
						reason: "already_committed",
						detail: "Already chosen this cell this round"
					});
					return;
				}
				const explained = kernel.explainAction(
					stateRef.current,
					seat === "X" ? 0 : 1,
					{ type: "place", position: pos }
				);
				if (!explained.legal) {
					setLastIllegal({
						reason: explained.reason,
						detail: explained.detail
					});
					return;
				}
				setLastIllegal(null);
				const nextOwn = [...own, pos];
				const nextPending: PendingPlacements = {
					...pendingRef.current,
					[seat]: nextOwn
				};
				pendingRef.current = nextPending;
				setPendingPlacements(nextPending);
				const nx = nextPending.X?.length ?? 0;
				const no = nextPending.O?.length ?? 0;
				if (nx === actionsPerRound && no === actionsPerRound) {
					const joint =
						actionsPerRound <= 1
							? jointPlaceFromActions(
									{ type: "place", position: nextPending.X![0]! },
									{ type: "place", position: nextPending.O![0]! }
								)
							: jointPlacesFromActions(
									nextPending.X!.map((p) => ({
										type: "place" as const,
										position: p
									})),
									nextPending.O!.map((p) => ({
										type: "place" as const,
										position: p
									}))
								);
					if (joint) applyAction(joint);
				}
				return;
			}
			if ((config.observationMode ?? "full") === "hit_miss") {
				const turnPhases = config.turnPhases;
				if (turnPhases && turnPhases.length > 0) {
					const phase =
						turnPhases[stateRef.current.turnPhaseIndex ?? 0] ?? "place";
					if (phase === "place") {
						applyAction({ type: "place", position: pos });
						selectedFromRef.current = null;
						setSelectedFrom(null);
						return;
					}
					if (phase === "fire") {
						applyAction({ type: "fire", position: pos });
						selectedFromRef.current = null;
						setSelectedFrom(null);
						return;
					}
					if (phase === "move") {
						const selected = selectedFromRef.current;
						const occupant = getCell(stateRef.current.grid, pos);
						if (!selected) {
							if (occupant === stateRef.current.currentPlayer) {
								selectedFromRef.current = pos;
								setSelectedFrom(pos);
							}
							return;
						}
						if (selected.row === pos.row && selected.col === pos.col) {
							selectedFromRef.current = null;
							setSelectedFrom(null);
							return;
						}
						if (occupant === stateRef.current.currentPlayer) {
							selectedFromRef.current = pos;
							setSelectedFrom(pos);
							return;
						}
						applyAction({ type: "move", from: selected, to: pos });
						selectedFromRef.current = null;
						setSelectedFrom(null);
						return;
					}
					return;
				}
				const phase = stateRef.current.phase ?? "combat";
				if (phase === "placement") {
					applyAction({ type: "place", position: pos });
				} else {
					applyAction({ type: "fire", position: pos });
				}
				return;
			}
			const turnPhases = config.turnPhases;
			const inTurnPhase =
				turnPhases && turnPhases.length > 0
					? turnPhases[stateRef.current.turnPhaseIndex ?? 0]
					: null;
			if (inTurnPhase === "move" || (config.inputMode ?? "cell") === "move") {
				const selected = selectedFromRef.current;
				const occupant = getCell(stateRef.current.grid, pos);
				if (!selected) {
					if (occupant === stateRef.current.currentPlayer) {
						selectedFromRef.current = pos;
						setSelectedFrom(pos);
					}
					return;
				}
				// Re-click same cell clears selection
				if (selected.row === pos.row && selected.col === pos.col) {
					selectedFromRef.current = null;
					setSelectedFrom(null);
					return;
				}
				// Click another own piece retargets selection
				if (occupant === stateRef.current.currentPlayer) {
					selectedFromRef.current = pos;
					setSelectedFrom(pos);
					return;
				}
				applyAction({ type: "move", from: selected, to: pos });
				selectedFromRef.current = null;
				setSelectedFrom(null);
				return;
			}
			applyAction({ type: "place", position: pos });
			selectedFromRef.current = null;
			setSelectedFrom(null);
		},
		[
			applyAction,
			config,
			config.observationMode,
			config.inputMode,
			config.turnPhases,
			simultaneous,
			simultaneousMove,
			commitReveal,
			kernel,
			actionsPerRound
		]
	);

	const activateColumn = useCallback(
		(col: number) => {
			applyAction({ type: "activateColumn", col });
		},
		[applyAction]
	);

	const activateRow = useCallback(
		(row: number) => {
			applyAction({ type: "activateRow", row });
		},
		[applyAction]
	);

	const popOutColumn = useCallback(
		(col: number) => {
			applyAction({ type: "popOutColumn", col });
		},
		[applyAction]
	);

	const popOutRow = useCallback(
		(row: number) => {
			applyAction({ type: "popOutRow", row });
		},
		[applyAction]
	);

	const tick = useCallback(() => {
		applyAction({ type: "tick" });
	}, [applyAction]);

	const pass = useCallback(() => {
		applyAction({ type: "pass" });
	}, [applyAction]);

	const reset = useCallback(() => {
		const next = kernel.initialState(seedRef.current);
		stateRef.current = next;
		setState(next);
		setLastEvents([]);
		setEventLog([]);
		setActionLog([]);
		selectedFromRef.current = null;
		setSelectedFrom(null);
		pendingRef.current = {};
		setPendingPlacements({});
		pendingMovesRef.current = {};
		setPendingMoves({});
		setLastIllegal(null);
		setTurnContext(turnContextFor(next));
	}, [kernel]);

	/** Replay a transcript (defaults to the live action log / seed). */
	const replayFromTranscript = useCallback(
		(ir?: GameIRTranscript) => {
			const target =
				ir ?? createTranscript(actionLogRef.current, seedRef.current);
			const result = replayTranscript(kernel, target);
			stateRef.current = result.finalState;
			setState(result.finalState);
			setLastEvents(result.events.slice(-8));
			setEventLog(result.events.slice(-EVENT_LOG_CAP));
			setActionLog(result.appliedActions.slice(-ACTION_LOG_CAP));
			selectedFromRef.current = null;
			setSelectedFrom(null);
			pendingRef.current = {};
			setPendingPlacements({});
			pendingMovesRef.current = {};
			setPendingMoves({});
			setLastIllegal(null);
			setTurnContext(turnContextFor(result.finalState));
			return result;
		},
		[kernel]
	);

	const legalActionsList = useMemo(() => {
		if (simultaneous) {
			const seat = simultaneousSeat ?? "X";
			return kernel.legalActions(state, seat === "X" ? 0 : 1);
		}
		const side = kernel.currentPlayer(state);
		if (side === "simultaneous") return kernel.legalActions(state, 0);
		return kernel.legalActions(state, side);
	}, [kernel, state, simultaneous, simultaneousSeat]);

	const legalActions = useCallback(() => {
		return legalActionsList;
	}, [legalActionsList]);

	/** Current seat's observation (commit-reveal uses choosing seat). */
	const observation = useMemo(() => {
		if (simultaneous) {
			const seat = simultaneousSeat ?? "X";
			return kernel.observe(state, seat === "X" ? 0 : 1);
		}
		const side = kernel.currentPlayer(state);
		const pid: PlayerId = side === "simultaneous" ? 0 : side;
		return kernel.observe(state, pid);
	}, [kernel, state, simultaneous, simultaneousSeat]);

	/** State with grid replaced by the current player's observation cells. */
	const viewState: GameState = useMemo(
		() => ({
			...state,
			grid: { ...state.grid, cells: observation.cells }
		}),
		[state, observation]
	);

	return {
		state,
		viewState,
		observation,
		kernel,
		seed,
		turnContext,
		lastEvents,
		lastIllegal,
		eventLog,
		actionLog,
		transcript,
		selectedFrom,
		pendingPlacements,
		pendingMoves,
		simultaneousSeat,
		commitReveal,
		resolveOrder,
		actionsPerRound,
		legalActions,
		legalActionsList,
		dispatchAction: applyAction,
		placeMove,
		activateColumn,
		activateRow,
		popOutColumn,
		popOutRow,
		tick,
		pass,
		reset,
		replayFromTranscript
	};
}
