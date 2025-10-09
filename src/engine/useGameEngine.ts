// React hook to manage game engine state

import { useState, useCallback, useEffect } from "react";
import type { GameState, GameEvent, Position } from "./types";
import { reduce, createInitialState, type GameConfig } from "./reducer";
import {
	createInitialTurnContext,
	nextPhase,
	type TurnContext
} from "@/engine/turnMachine";

export function useGameEngine(config: GameConfig) {
	const [state, setState] = useState<GameState>(() =>
		createInitialState(config)
	);
	const [turnContext, setTurnContext] = useState<TurnContext>(() =>
		createInitialTurnContext()
	);

	// Reinit when config changes
	useEffect(() => {
		setState(createInitialState(config));
		setTurnContext(createInitialTurnContext());
	}, [
		config.gridWidth,
		config.gridHeight,
		config.winLength,
		config.adjacency.mode,
		config.adjacency.horizontal,
		config.adjacency.vertical,
		config.adjacency.backDiagonal,
		config.adjacency.forwardDiagonal
	]);

	const dispatch = useCallback(
		(event: GameEvent) => {
			// Advance turn machine first (non-blocking for now)
			setTurnContext((prevCtx) => nextPhase(prevCtx, { type: event.type }));
			setState((prev) => reduce(prev, event, config));
		},
		[config]
	);

	const placeMove = useCallback(
		(pos: Position) => {
			dispatch({ type: "place", position: pos });
		},
		[dispatch]
	);

	const reset = useCallback(() => {
		dispatch({ type: "reset" });
	}, [dispatch]);

	const activateColumn = useCallback(
		(col: number) => {
			dispatch({ type: "activateColumn", col });
		},
		[dispatch]
	);

	const popOutColumn = useCallback(
		(col: number) => {
			dispatch({ type: "popOutColumn", col } as any);
		},
		[dispatch]
	);

	return {
		state,
		turnContext,
		dispatch,
		placeMove,
		activateColumn,
		popOutColumn,
		reset
	};
}
