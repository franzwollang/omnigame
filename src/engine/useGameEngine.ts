// React hook: sandbox play through GameKernel (M1) + GameIR action log (M2)

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import type { GameState, Player, Position } from "./types";
import { getCell } from "./types";
import type { GameConfig } from "./reducer";
import {
	createGameKernel,
	formatKernelEvent,
	jointPlaceFromActions,
	type GameKernel,
	type IllegalReason,
	type KernelAction,
	type KernelEvent,
	type PlayerId,
	type Seed
} from "@/engine/kernel";
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

export type PendingPlacements = Partial<Record<Player, Position>>;

export function useGameEngine(config: GameConfig, seed: Seed = DEFAULT_SEED) {
	const kernel: GameKernel = useMemo(() => createGameKernel(config), [config]);
	const simultaneous =
		(config.turnSchedule ?? "alternating") === "simultaneous";
	const commitReveal = simultaneous && config.commitReveal === true;
	const resolveOrder = simultaneous
		? (config.resolveOrder ?? "joint")
		: "joint";

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
		setLastIllegal(null);
		setTurnContext(turnContextFor(next));
	}, [kernel, seed]);

	const applyAction = useCallback(
		(action: KernelAction) => {
			const side = kernel.currentPlayer(stateRef.current);
			const explainPlayer: PlayerId =
				action.type === "commitPlace"
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
			setTurnContext(turnContextFor(result.nextState));
			return result;
		},
		[kernel]
	);

	/** Which seat is choosing next in simultaneous / commit-reveal collection. */
	const simultaneousSeat: Player | null = useMemo(() => {
		if (!simultaneous || state.status !== "playing") return null;
		if (commitReveal) {
			if (!state.committedPlacements?.X) return "X";
			if (!state.committedPlacements?.O) return "O";
			return null;
		}
		if (!pendingPlacements.X) return "X";
		if (!pendingPlacements.O) return "O";
		return null;
	}, [
		simultaneous,
		commitReveal,
		state.status,
		state.committedPlacements,
		pendingPlacements
	]);

	const placeMove = useCallback(
		(pos: Position) => {
			if (simultaneous) {
				if (commitReveal) {
					const seat = !stateRef.current.committedPlacements?.X
						? "X"
						: !stateRef.current.committedPlacements?.O
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
				const seat = !pendingRef.current.X
					? "X"
					: !pendingRef.current.O
						? "O"
						: null;
				if (!seat) return;
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
				const nextPending: PendingPlacements = {
					...pendingRef.current,
					[seat]: pos
				};
				pendingRef.current = nextPending;
				setPendingPlacements(nextPending);
				if (nextPending.X && nextPending.O) {
					const joint = jointPlaceFromActions(
						{ type: "place", position: nextPending.X },
						{ type: "place", position: nextPending.O }
					);
					if (joint) applyAction(joint);
				}
				return;
			}
			if ((config.observationMode ?? "full") === "hit_miss") {
				const phase = stateRef.current.phase ?? "combat";
				if (phase === "placement") {
					applyAction({ type: "place", position: pos });
				} else {
					applyAction({ type: "fire", position: pos });
				}
				return;
			}
			if ((config.inputMode ?? "cell") === "move") {
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
		},
		[applyAction, config.observationMode, config.inputMode, simultaneous, commitReveal, kernel]
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
		simultaneousSeat,
		commitReveal,
		resolveOrder,
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
