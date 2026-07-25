// React hook: sandbox play through GameKernel (M1) + GameIR action log (M2)

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import type { GameState, Position } from "./types";
import type { GameConfig } from "./reducer";
import {
	createGameKernel,
	formatKernelEvent,
	type GameKernel,
	type KernelAction,
	type KernelEvent,
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

export function useGameEngine(config: GameConfig, seed: Seed = DEFAULT_SEED) {
	const kernel: GameKernel = useMemo(() => createGameKernel(config), [config]);

	const [state, setState] = useState<GameState>(() =>
		kernel.initialState(seed)
	);
	const [lastEvents, setLastEvents] = useState<KernelEvent[]>([]);
	const [eventLog, setEventLog] = useState<KernelEvent[]>([]);
	const [actionLog, setActionLog] = useState<KernelAction[]>([]);
	const [turnContext, setTurnContext] = useState<TurnContext>(() =>
		createInitialTurnContext()
	);
	const stateRef = useRef(state);
	stateRef.current = state;
	const seedRef = useRef(seed);
	seedRef.current = seed;
	const actionLogRef = useRef(actionLog);
	actionLogRef.current = actionLog;

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
		setTurnContext(turnContextFor(next));
	}, [kernel, seed]);

	const applyAction = useCallback(
		(action: KernelAction) => {
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
			setTurnContext(turnContextFor(result.nextState));
		},
		[kernel]
	);

	const placeMove = useCallback(
		(pos: Position) => {
			if ((config.observationMode ?? "full") === "hit_miss") {
				applyAction({ type: "fire", position: pos });
			} else {
				applyAction({ type: "place", position: pos });
			}
		},
		[applyAction, config.observationMode]
	);

	const activateColumn = useCallback(
		(col: number) => {
			applyAction({ type: "activateColumn", col });
		},
		[applyAction]
	);

	const popOutColumn = useCallback(
		(col: number) => {
			applyAction({ type: "popOutColumn", col });
		},
		[applyAction]
	);

	const reset = useCallback(() => {
		const next = kernel.initialState(seedRef.current);
		stateRef.current = next;
		setState(next);
		setLastEvents([]);
		setEventLog([]);
		setActionLog([]);
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
			setTurnContext(turnContextFor(result.finalState));
			return result;
		},
		[kernel]
	);

	const legalActions = useCallback(() => {
		return kernel.legalActions(state, kernel.currentPlayer(state));
	}, [kernel, state]);

	/** Current player's observation (full grid or projected hit/miss view). */
	const observation = useMemo(
		() => kernel.observe(state, kernel.currentPlayer(state)),
		[kernel, state]
	);

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
		eventLog,
		actionLog,
		transcript,
		legalActions,
		placeMove,
		activateColumn,
		popOutColumn,
		reset,
		replayFromTranscript
	};
}
