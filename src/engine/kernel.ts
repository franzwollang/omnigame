/**
 * GameKernel ABI scaffold (M1).
 *
 * Wraps the existing pure reducer behind a stable boundary so sandbox, replay,
 * and agents can share one stepping surface. Stepping is Effect-backed at the
 * edge; legality still probes the reducer until a dedicated rules API lands.
 */
import { Effect } from "effect";
import type { GameState, Player, Position } from "@/engine/types";
import { getCell } from "@/engine/types";
import {
	createInitialState,
	reduce,
	type GameConfig
} from "@/engine/reducer";
import { applyCaptureIfAny } from "@/engine/capture";
import { setCell } from "@/engine/types";

/** Numeric player ids per README GameKernel sketch (X=0, O=1). */
export type PlayerId = 0 | 1;

export type Seed = number;

export type KernelAction =
	| { type: "place"; position: Position }
	| { type: "activateColumn"; col: number }
	| { type: "popOutColumn"; col: number };

export type KernelEvent =
	| { type: "actionApplied"; action: KernelAction; player: Player }
	| { type: "ignored"; action: KernelAction; reason: "illegal_or_noop" }
	| { type: "terminal"; status: GameState["status"]; winner: Player | null };

export type GameOutcome = {
	status: Exclude<GameState["status"], "playing">;
	winner: Player | null;
};

export type StepResult = {
	nextState: GameState;
	events: KernelEvent[];
	terminal: boolean;
	outcome?: GameOutcome;
};

export type GameKernel = {
	readonly config: GameConfig;
	initialState(seed?: Seed): GameState;
	currentPlayer(state: GameState): PlayerId;
	legalActions(state: GameState, player: PlayerId): KernelAction[];
	/** Effect-backed step; sync helper available as `stepSync`. */
	step(
		state: GameState,
		action: KernelAction,
		seed?: Seed
	): Effect.Effect<StepResult>;
	stepSync(state: GameState, action: KernelAction, seed?: Seed): StepResult;
};

export function playerIdOf(player: Player): PlayerId {
	return player === "X" ? 0 : 1;
}

export function playerOf(id: PlayerId): Player {
	return id === 0 ? "X" : "O";
}

function isNoop(before: GameState, after: GameState): boolean {
	return (
		before.moveCount === after.moveCount &&
		before.currentPlayer === after.currentPlayer &&
		before.status === after.status &&
		before.grid.cells === after.grid.cells
	);
}

function outcomeOf(state: GameState): GameOutcome | undefined {
	if (state.status === "playing") return undefined;
	return { status: state.status, winner: state.winner };
}

function applyStep(
	config: GameConfig,
	state: GameState,
	action: KernelAction
): StepResult {
	const nextState = reduce(state, action, config);
	if (isNoop(state, nextState)) {
		return {
			nextState: state,
			events: [{ type: "ignored", action, reason: "illegal_or_noop" }],
			terminal: state.status !== "playing",
			outcome: outcomeOf(state)
		};
	}
	const events: KernelEvent[] = [
		{ type: "actionApplied", action, player: state.currentPlayer }
	];
	const terminal = nextState.status !== "playing";
	if (terminal) {
		events.push({
			type: "terminal",
			status: nextState.status,
			winner: nextState.winner
		});
	}
	return {
		nextState,
		events,
		terminal,
		outcome: outcomeOf(nextState)
	};
}

function columnHasSpace(state: GameState, col: number): boolean {
	return getCell(state.grid, { row: 0, col }) === null;
}

function canPlaceCell(
	state: GameState,
	pos: Position,
	config: GameConfig
): boolean {
	if (getCell(state.grid, pos) !== null) return false;
	if (!config.captureEnabled) return true;
	const placedCells = setCell(state.grid, pos, state.currentPlayer);
	const after = applyCaptureIfAny(
		{ ...state.grid, cells: placedCells },
		pos,
		state.currentPlayer,
		config.adjacency
	);
	return after !== placedCells;
}

function collectLegalActions(
	config: GameConfig,
	state: GameState,
	player: PlayerId
): KernelAction[] {
	if (state.status !== "playing") return [];
	if (playerIdOf(state.currentPlayer) !== player) return [];

	const actions: KernelAction[] = [];
	const inputMode = config.inputMode ?? "cell";
	const overflow = config.overflow ?? "reject";

	if (inputMode === "column") {
		for (let col = 0; col < state.grid.width; col++) {
			if (columnHasSpace(state, col)) {
				actions.push({ type: "activateColumn", col });
			}
		}
	} else {
		for (let row = 0; row < state.grid.height; row++) {
			for (let col = 0; col < state.grid.width; col++) {
				const position = { row, col };
				if (canPlaceCell(state, position, config)) {
					actions.push({ type: "place", position });
				}
			}
		}
	}

	if (overflow === "pop_out_bottom") {
		const height = state.grid.height;
		for (let col = 0; col < state.grid.width; col++) {
			const bottom = getCell(state.grid, { row: height - 1, col });
			if (bottom === state.currentPlayer) {
				actions.push({ type: "popOutColumn", col });
			}
		}
	}

	return actions;
}

/** Build a GameKernel over a flat engine config. */
export function createGameKernel(config: GameConfig): GameKernel {
	const step = (
		state: GameState,
		action: KernelAction,
		_seed?: Seed
	): Effect.Effect<StepResult> =>
		Effect.sync(() => applyStep(config, state, action));

	return {
		config,
		initialState(_seed?: Seed) {
			// Seeded RNG not yet threaded into placement; reserved for M2 replay.
			return createInitialState(config);
		},
		currentPlayer(state) {
			return playerIdOf(state.currentPlayer);
		},
		legalActions(state, player) {
			return collectLegalActions(config, state, player);
		},
		step,
		stepSync(state, action, seed) {
			return Effect.runSync(step(state, action, seed));
		}
	};
}
