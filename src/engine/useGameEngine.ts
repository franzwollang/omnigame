// React hook to manage game engine state

import { useState, useCallback, useEffect } from "react";
import type { GameState, GameEvent, Position } from "./types";
import { reduce, createInitialState, type GameConfig } from "./reducer";

export function useGameEngine(config: GameConfig) {
	const [state, setState] = useState<GameState>(() =>
		createInitialState(config)
	);

	// Reinit when config changes
	useEffect(() => {
		setState(createInitialState(config));
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

	return { state, dispatch, placeMove, reset };
}
