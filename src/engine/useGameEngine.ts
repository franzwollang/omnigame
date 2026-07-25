// React hook: sandbox play through GameKernel (M1)

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import type { GameState, Position } from "./types";
import type { GameConfig } from "./reducer";
import {
	createGameKernel,
	formatKernelEvent,
	type GameKernel,
	type KernelAction,
	type KernelEvent
} from "@/engine/kernel";
import {
	createInitialTurnContext,
	type TurnContext
} from "@/engine/turnMachine";

export { formatKernelEvent };

const EVENT_LOG_CAP = 40;

function turnContextFor(state: GameState): TurnContext {
	if (state.status !== "playing") return { phase: "ended" };
	return { phase: "awaitInput" };
}

export function useGameEngine(config: GameConfig) {
	const kernel: GameKernel = useMemo(() => createGameKernel(config), [config]);

	const [state, setState] = useState<GameState>(() => kernel.initialState());
	const [lastEvents, setLastEvents] = useState<KernelEvent[]>([]);
	const [eventLog, setEventLog] = useState<KernelEvent[]>([]);
	const [turnContext, setTurnContext] = useState<TurnContext>(() =>
		createInitialTurnContext()
	);
	const stateRef = useRef(state);
	stateRef.current = state;

	// Reinit when kernel/config changes
	useEffect(() => {
		const next = kernel.initialState();
		stateRef.current = next;
		setState(next);
		setLastEvents([]);
		setEventLog([]);
		setTurnContext(turnContextFor(next));
	}, [kernel]);

	const applyAction = useCallback(
		(action: KernelAction) => {
			const result = kernel.stepSync(stateRef.current, action);
			stateRef.current = result.nextState;
			setState(result.nextState);
			setLastEvents(result.events);
			setEventLog((log) =>
				[...log, ...result.events].slice(-EVENT_LOG_CAP)
			);
			setTurnContext(turnContextFor(result.nextState));
		},
		[kernel]
	);

	const placeMove = useCallback(
		(pos: Position) => {
			applyAction({ type: "place", position: pos });
		},
		[applyAction]
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
		const next = kernel.initialState();
		stateRef.current = next;
		setState(next);
		setLastEvents([]);
		setEventLog([]);
		setTurnContext(turnContextFor(next));
	}, [kernel]);

	const legalActions = useCallback(() => {
		return kernel.legalActions(state, kernel.currentPlayer(state));
	}, [kernel, state]);

	return {
		state,
		kernel,
		turnContext,
		lastEvents,
		eventLog,
		legalActions,
		placeMove,
		activateColumn,
		popOutColumn,
		reset
	};
}
