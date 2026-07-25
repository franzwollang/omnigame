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
import { isLegalLibertyPlace } from "@/engine/liberties";
import { setCell } from "@/engine/types";
import {
	observe,
	type PlayerObservation,
	type ShotResult
} from "@/engine/observation";
import {
	canPlaceFleetCell,
	usesPlacementPhase
} from "@/engine/fleet";
import { canMove, legalDestinations } from "@/engine/movement";
import {
	allActivePositions,
	isActivePosition
} from "@/engine/topology";

/** Numeric player ids per README GameKernel sketch (X=0, O=1). */
export type PlayerId = 0 | 1;

export type Seed = number;

export type KernelAction =
	| { type: "place"; position: Position }
	| { type: "move"; from: Position; to: Position }
	| { type: "fire"; position: Position }
	| { type: "activateColumn"; col: number }
	| { type: "popOutColumn"; col: number }
	| { type: "tick" }
	| { type: "pass" };

/** Structured legality failure codes for debug UI / agents. */
export type IllegalReason =
	| "game_over"
	| "wrong_player"
	| "cell_occupied"
	| "must_flip"
	| "suicide"
	| "own_ship"
	| "column_full"
	| "no_own_piece"
	| "invalid_destination"
	| "mode_mismatch"
	| "not_applicable"
	| "illegal_or_noop"
	| "ship_shape"
	| "wrong_phase";

export type ExplainResult =
	| { legal: true }
	| { legal: false; reason: IllegalReason; detail: string };

export type KernelEvent =
	| { type: "actionApplied"; action: KernelAction; player: Player }
	| {
			type: "shotResult";
			position: Position;
			result: ShotResult;
			player: Player;
	  }
	| { type: "phaseChanged"; phase: "placement" | "combat" }
	| { type: "tickApplied"; generation: number }
	| { type: "ignored"; action: KernelAction; reason: IllegalReason }
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
	/** Why an action is illegal for `player` (reuses legality probes). */
	explainAction(
		state: GameState,
		player: PlayerId,
		action: KernelAction
	): ExplainResult;
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
		case "pass":
			return "pass";
	}
}

/** Human-readable kernel event line for sandbox / debug UI. */
export function formatKernelEvent(event: KernelEvent): string {
	switch (event.type) {
		case "actionApplied":
			return `${event.player}: ${formatAction(event.action)}`;
		case "shotResult":
			return `${event.player}: ${event.result} at (${event.position.row},${event.position.col})`;
		case "phaseChanged":
			return `phase → ${event.phase}`;
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
		(before.phase ?? "combat") === (after.phase ?? "combat") &&
		before.grid.cells === after.grid.cells &&
		before.hidden?.cells === after.hidden?.cells
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
		const explained = explainKernelAction(
			config,
			state,
			playerIdOf(state.currentPlayer),
			action
		);
		const reason: IllegalReason =
			explained.legal === false ? explained.reason : "illegal_or_noop";
		return {
			nextState: state,
			events: [{ type: "ignored", action, reason }],
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

	const prevPhase = state.phase ?? "combat";
	const nextPhase = nextState.phase ?? "combat";
	if (prevPhase !== nextPhase) {
		events.push({ type: "phaseChanged", phase: nextPhase });
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
	const topology = config.topology ?? "rectangle";
	if (!isActivePosition(pos, topology, config.graph)) return false;
	if (getCell(state.grid, pos) !== null) return false;
	if (!config.captureEnabled) return true;
	const wrap = config.gridWrap === true;
	const captureMode = config.captureMode ?? "flip";
	if (captureMode === "liberties") {
		return isLegalLibertyPlace(state.grid, pos, state.currentPlayer, wrap);
	}
	const placedCells = setCell(state.grid, pos, state.currentPlayer);
	const after = applyCaptureIfAny(
		{ ...state.grid, cells: placedCells },
		pos,
		state.currentPlayer,
		config.adjacency,
		wrap
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
		for (const position of allActivePositions(
			state.grid,
			config.topology ?? "rectangle",
			config.graph
		)) {
			if (canPlaceCell(state, position, config)) {
				actions.push({ type: "place", position });
			}
		}
		return actions;
	}

	if (hitMiss) {
		const inPlacement =
			usesPlacementPhase(config.fleet) &&
			(state.phase ?? "combat") === "placement";
		if (inPlacement) {
			const fleet = config.fleet!;
			for (const position of allActivePositions(
				state.grid,
				config.topology ?? "rectangle",
				config.graph
			)) {
				if (canPlaceFleetCell(state, position, state.currentPlayer, fleet)) {
					actions.push({ type: "place", position });
				}
			}
			return actions;
		}
		for (const position of allActivePositions(
			state.grid,
			config.topology ?? "rectangle",
			config.graph
		)) {
			if (canFireCell(state, position, state.currentPlayer)) {
				actions.push({ type: "fire", position });
			}
		}
		return actions;
	}

	if (inputMode === "move") {
		const movement = config.movement;
		if (!movement) return actions;
		const wrap = config.gridWrap === true;
		for (const from of allActivePositions(
			state.grid,
			config.topology ?? "rectangle",
			config.graph
		)) {
			if (getCell(state.grid, from) !== state.currentPlayer) continue;
			for (const to of legalDestinations(state.grid, from, movement, wrap)) {
				if (
					canMove(state.grid, from, to, state.currentPlayer, movement, wrap)
				) {
					actions.push({ type: "move", from, to });
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
		for (const position of allActivePositions(
			state.grid,
			config.topology ?? "rectangle",
			config.graph
		)) {
			if (canPlaceCell(state, position, config)) {
				actions.push({ type: "place", position });
			}
		}
	}

	if ((config.objectiveMode ?? "n_in_a_row") === "area_control") {
		actions.push({ type: "pass" });
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

function placeFailureReason(
	state: GameState,
	pos: Position,
	config: GameConfig
): IllegalReason | null {
	const topology = config.topology ?? "rectangle";
	if (!isActivePosition(pos, topology, config.graph)) return "not_applicable";
	if (getCell(state.grid, pos) !== null) return "cell_occupied";
	if (!config.captureEnabled) return null;
	const wrap = config.gridWrap === true;
	const captureMode = config.captureMode ?? "flip";
	if (captureMode === "liberties") {
		return isLegalLibertyPlace(state.grid, pos, state.currentPlayer, wrap)
			? null
			: "suicide";
	}
	const placedCells = setCell(state.grid, pos, state.currentPlayer);
	const after = applyCaptureIfAny(
		{ ...state.grid, cells: placedCells },
		pos,
		state.currentPlayer,
		config.adjacency,
		wrap
	);
	return after !== placedCells ? null : "must_flip";
}

function detailFor(reason: IllegalReason, action: KernelAction): string {
	switch (reason) {
		case "game_over":
			return "Game is over";
		case "wrong_player":
			return "Not this player's turn";
		case "cell_occupied":
			return "Cell is occupied";
		case "must_flip":
			return "Placement must flip at least one opponent disc";
		case "suicide":
			return "Placement would leave a group with no liberties";
		case "own_ship":
			return "Cannot fire on your own ship";
		case "column_full":
			return "Column has no empty space";
		case "no_own_piece":
			return "No owned piece at source / column bottom";
		case "invalid_destination":
			return "Destination is not a legal move target";
		case "mode_mismatch":
			return `Action ${action.type} is not valid in this config mode`;
		case "not_applicable":
			return "Action is not available for this ruleset";
		case "illegal_or_noop":
			return "Action had no effect";
		case "ship_shape":
			return "Ship cells must form a contiguous orthogonal line";
		case "wrong_phase":
			return "Action is not valid in the current game phase";
	}
}

/** Explain legality for a prospective action (shared by kernel + ignored events). */
export function explainKernelAction(
	config: GameConfig,
	state: GameState,
	player: PlayerId,
	action: KernelAction
): ExplainResult {
	if (state.status !== "playing") {
		return {
			legal: false,
			reason: "game_over",
			detail: detailFor("game_over", action)
		};
	}
	if (playerIdOf(state.currentPlayer) !== player) {
		return {
			legal: false,
			reason: "wrong_player",
			detail: detailFor("wrong_player", action)
		};
	}

	const legal = collectLegalActions(config, state, player);
	const isLegal = legal.some((a) => actionsEqual(a, action));
	if (isLegal) return { legal: true };

	const inputMode = config.inputMode ?? "cell";
	const hitMiss = (config.observationMode ?? "full") === "hit_miss";
	const manualTick = (config.turnSchedule ?? "alternating") === "manual_tick";
	const overflow = config.overflow ?? "reject";

	switch (action.type) {
		case "tick": {
			if (!manualTick) {
				return {
					legal: false,
					reason: "mode_mismatch",
					detail: detailFor("mode_mismatch", action)
				};
			}
			break;
		}
		case "pass": {
			if ((config.objectiveMode ?? "n_in_a_row") !== "area_control") {
				return {
					legal: false,
					reason: "not_applicable",
					detail: detailFor("not_applicable", action)
				};
			}
			break;
		}
		case "fire": {
			if (!hitMiss) {
				return {
					legal: false,
					reason: "mode_mismatch",
					detail: detailFor("mode_mismatch", action)
				};
			}
			if ((state.phase ?? "combat") === "placement") {
				return {
					legal: false,
					reason: "wrong_phase",
					detail: detailFor("wrong_phase", action)
				};
			}
			if (getCell(state.grid, action.position) !== null) {
				return {
					legal: false,
					reason: "cell_occupied",
					detail: detailFor("cell_occupied", action)
				};
			}
			const occupant =
				state.hidden != null ? getCell(state.hidden, action.position) : null;
			if (occupant === state.currentPlayer) {
				return {
					legal: false,
					reason: "own_ship",
					detail: detailFor("own_ship", action)
				};
			}
			break;
		}
		case "place": {
			if (hitMiss) {
				if (!usesPlacementPhase(config.fleet)) {
					return {
						legal: false,
						reason: "mode_mismatch",
						detail: detailFor("mode_mismatch", action)
					};
				}
				if ((state.phase ?? "combat") !== "placement") {
					return {
						legal: false,
						reason: "wrong_phase",
						detail: detailFor("wrong_phase", action)
					};
				}
				if (
					state.hidden != null &&
					getCell(state.hidden, action.position) !== null
				) {
					return {
						legal: false,
						reason: "cell_occupied",
						detail: detailFor("cell_occupied", action)
					};
				}
				if (
					!canPlaceFleetCell(
						state,
						action.position,
						state.currentPlayer,
						config.fleet!
					)
				) {
					return {
						legal: false,
						reason: "ship_shape",
						detail: detailFor("ship_shape", action)
					};
				}
				break;
			}
			if (
				!manualTick &&
				(inputMode === "column" || inputMode === "move")
			) {
				return {
					legal: false,
					reason: "mode_mismatch",
					detail: detailFor("mode_mismatch", action)
				};
			}
			const placeReason = placeFailureReason(state, action.position, config);
			if (placeReason) {
				return {
					legal: false,
					reason: placeReason,
					detail: detailFor(placeReason, action)
				};
			}
			break;
		}
		case "activateColumn": {
			if (inputMode !== "column") {
				return {
					legal: false,
					reason: "mode_mismatch",
					detail: detailFor("mode_mismatch", action)
				};
			}
			if (!columnHasSpace(state, action.col)) {
				return {
					legal: false,
					reason: "column_full",
					detail: detailFor("column_full", action)
				};
			}
			break;
		}
		case "popOutColumn": {
			if (overflow !== "pop_out_bottom") {
				return {
					legal: false,
					reason: "not_applicable",
					detail: detailFor("not_applicable", action)
				};
			}
			const bottom = getCell(state.grid, {
				row: state.grid.height - 1,
				col: action.col
			});
			if (bottom !== state.currentPlayer) {
				return {
					legal: false,
					reason: "no_own_piece",
					detail: detailFor("no_own_piece", action)
				};
			}
			break;
		}
		case "move": {
			if (inputMode !== "move" || !config.movement) {
				return {
					legal: false,
					reason: "mode_mismatch",
					detail: detailFor("mode_mismatch", action)
				};
			}
			if (getCell(state.grid, action.from) !== state.currentPlayer) {
				return {
					legal: false,
					reason: "no_own_piece",
					detail: detailFor("no_own_piece", action)
				};
			}
			if (
				!canMove(
					state.grid,
					action.from,
					action.to,
					state.currentPlayer,
					config.movement,
					config.gridWrap === true
				)
			) {
				return {
					legal: false,
					reason: "invalid_destination",
					detail: detailFor("invalid_destination", action)
				};
			}
			break;
		}
	}

	return {
		legal: false,
		reason: "illegal_or_noop",
		detail: detailFor("illegal_or_noop", action)
	};
}

function actionsEqual(a: KernelAction, b: KernelAction): boolean {
	if (a.type !== b.type) return false;
	switch (a.type) {
		case "place":
		case "fire":
			return (
				b.type === a.type &&
				a.position.row === b.position.row &&
				a.position.col === b.position.col
			);
		case "move":
			return (
				b.type === "move" &&
				a.from.row === b.from.row &&
				a.from.col === b.from.col &&
				a.to.row === b.to.row &&
				a.to.col === b.to.col
			);
		case "activateColumn":
		case "popOutColumn":
			return b.type === a.type && a.col === b.col;
		case "tick":
		case "pass":
			return true;
	}
}

/**
 * Board cells to highlight for a legal-action set (overlay / heatmap).
 * Column actions highlight the landing / bottom cell.
 */
export function highlightCellsForActions(
	state: GameState,
	actions: readonly KernelAction[],
	opts?: { selectedFrom?: Position | null }
): Position[] {
	const selected = opts?.selectedFrom ?? null;
	const out: Position[] = [];
	const seen = new Set<string>();
	const push = (p: Position) => {
		const key = `${p.row},${p.col}`;
		if (seen.has(key)) return;
		seen.add(key);
		out.push(p);
	};

	for (const action of actions) {
		switch (action.type) {
			case "place":
			case "fire":
				push(action.position);
				break;
			case "move":
				if (selected) {
					if (
						action.from.row === selected.row &&
						action.from.col === selected.col
					) {
						push(action.to);
					}
				} else {
					push(action.from);
				}
				break;
			case "activateColumn": {
				// Highlight top-most empty cell in column (drop entry).
				for (let row = 0; row < state.grid.height; row++) {
					if (getCell(state.grid, { row, col: action.col }) === null) {
						push({ row, col: action.col });
						break;
					}
				}
				break;
			}
			case "popOutColumn":
				push({ row: state.grid.height - 1, col: action.col });
				break;
			default:
				break;
		}
	}
	return out;
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
		explainAction(state, player, action) {
			return explainKernelAction(config, state, player, action);
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
