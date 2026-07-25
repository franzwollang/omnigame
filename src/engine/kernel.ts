/**
 * GameKernel ABI (M1+) with observation projection (M4).
 *
 * Wraps the pure reducer behind a stable boundary. Stepping is Effect-backed;
 * legality probes the reducer / observation rules.
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
import {
	observe,
	type PlayerObservation,
	type ShotResult
} from "@/engine/observation";
import { canMove, legalDestinations } from "@/engine/movement";

/** Numeric player ids per README GameKernel sketch (X=0, O=1). */
export type PlayerId = 0 | 1;

export type Seed = number;

export type KernelAction =
	| { type: "place"; position: Position }
	| { type: "move"; from: Position; to: Position }
	| { type: "fire"; position: Position }
	| { type: "activateColumn"; col: number }
	| { type: "popOutColumn"; col: number }
	| { type: "tick" };

export type KernelEvent =
	| { type: "actionApplied"; action: KernelAction; player: Player }
	| {
			type: "shotResult";
			position: Position;
			result: ShotResult;
			player: Player;
	  }
	| { type: "tickApplied"; generation: number }
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
	/** Per-player views after the step (full or projected). */
	observations: Record<PlayerId, PlayerObservation>;
};

export type GameKernel = {
	readonly config: GameConfig;
	initialState(seed?: Seed): GameState;
	currentPlayer(state: GameState): PlayerId;
	legalActions(state: GameState, player: PlayerId): KernelAction[];
	observe(state: GameState, player: PlayerId): PlayerObservation;
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

function formatAction(action: KernelAction): string {
	switch (action.type) {
		case "place":
			return `place (${action.position.row},${action.position.col})`;
		case "move":
			return `move (${action.from.row},${action.from.col})→(${action.to.row},${action.to.col})`;
		case "fire":
			return `fire (${action.position.row},${action.position.col})`;
		case "activateColumn":
			return `column ${action.col}`;
		case "popOutColumn":
			return `pop-out ${action.col}`;
		case "tick":
			return "tick";
	}
}

/** Human-readable kernel event line for sandbox / debug UI. */
export function formatKernelEvent(event: KernelEvent): string {
	switch (event.type) {
		case "actionApplied":
			return `${event.player}: ${formatAction(event.action)}`;
		case "shotResult":
			return `${event.player}: ${event.result} at (${event.position.row},${event.position.col})`;
		case "tickApplied":
			return `tick → generation ${event.generation}`;
		case "ignored":
			return `ignored: ${formatAction(event.action)} (${event.reason})`;
		case "terminal":
			return event.status === "won"
				? `terminal: ${event.winner} wins`
				: `terminal: draw`;
	}
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

function observationsFor(
	config: GameConfig,
	state: GameState,
	lastShot?: { position: Position; result: ShotResult }
): Record<PlayerId, PlayerObservation> {
	return {
		0: observe(config, state, "X", lastShot),
		1: observe(config, state, "O", lastShot)
	};
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
			outcome: outcomeOf(state),
			observations: observationsFor(config, state)
		};
	}

	const events: KernelEvent[] = [
		{ type: "actionApplied", action, player: state.currentPlayer }
	];

	let lastShot: { position: Position; result: ShotResult } | undefined;
	if (action.type === "fire") {
		const marked = getCell(nextState.grid, action.position);
		if (marked === "hit" || marked === "miss") {
			lastShot = { position: action.position, result: marked };
			events.push({
				type: "shotResult",
				position: action.position,
				result: marked,
				player: state.currentPlayer
			});
		}
	}

	if (action.type === "tick") {
		events.push({ type: "tickApplied", generation: nextState.moveCount });
	}

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
		outcome: outcomeOf(nextState),
		observations: observationsFor(config, nextState, lastShot)
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

function canFireCell(
	state: GameState,
	pos: Position,
	player: Player
): boolean {
	if (getCell(state.grid, pos) !== null) return false;
	const occupant =
		state.hidden != null ? getCell(state.hidden, pos) : null;
	if (occupant === player) return false;
	return true;
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
	const hitMiss = (config.observationMode ?? "full") === "hit_miss";
	const manualTick = (config.turnSchedule ?? "alternating") === "manual_tick";

	if (manualTick) {
		actions.push({ type: "tick" });
		for (let row = 0; row < state.grid.height; row++) {
			for (let col = 0; col < state.grid.width; col++) {
				const position = { row, col };
				if (canPlaceCell(state, position, config)) {
					actions.push({ type: "place", position });
				}
			}
		}
		return actions;
	}

	if (hitMiss) {
		for (let row = 0; row < state.grid.height; row++) {
			for (let col = 0; col < state.grid.width; col++) {
				const position = { row, col };
				if (canFireCell(state, position, state.currentPlayer)) {
					actions.push({ type: "fire", position });
				}
			}
		}
		return actions;
	}

	if (inputMode === "move") {
		const movement = config.movement;
		if (!movement) return actions;
		for (let row = 0; row < state.grid.height; row++) {
			for (let col = 0; col < state.grid.width; col++) {
				const from = { row, col };
				if (getCell(state.grid, from) !== state.currentPlayer) continue;
				for (const to of legalDestinations(state.grid, from, movement)) {
					if (canMove(state.grid, from, to, state.currentPlayer, movement)) {
						actions.push({ type: "move", from, to });
					}
				}
			}
		}
		return actions;
	}

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
			return createInitialState(config);
		},
		currentPlayer(state) {
			return playerIdOf(state.currentPlayer);
		},
		legalActions(state, player) {
			return collectLegalActions(config, state, player);
		},
		observe(state, player) {
			return observe(config, state, playerOf(player));
		},
		step,
		stepSync(state, action, seed) {
			return Effect.runSync(step(state, action, seed));
		}
	};
}
