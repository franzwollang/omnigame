/**
 * GameKernel ABI (M1+) with observation projection (M4).
 *
 * Wraps the pure reducer behind a stable boundary. Stepping is Effect-backed;
 * legality probes the reducer / observation rules.
 */
import { Effect } from "effect";
import type { GameState, Player, Position } from "@/engine/types";
import {
	asPlacementList,
	getCell,
	isCellPending,
	listHasPosition,
	positionsEqual
} from "@/engine/types";
import {
	createInitialState,
	reduce,
	type GameConfig
} from "@/engine/reducer";
import { applyCaptureIfAny } from "@/engine/capture";
import { isLegalLibertyPlace, usesSuperkoHistory, type KoRule } from "@/engine/liberties";
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
import {
	canJointSimultaneousMoves,
	canOrderedSimultaneousMoves,
	canMove,
	legalDestinations,
	movementBoardFrom
} from "@/engine/movement";
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
	| { type: "activateRow"; row: number }
	| { type: "popOutColumn"; col: number }
	| { type: "popOutRow"; row: number }
	| { type: "tick" }
	| { type: "pass" }
	| {
			type: "simultaneousPlace";
			placements: {
				X: Position | Position[];
				O: Position | Position[];
			};
	  }
	| {
			type: "simultaneousMove";
			moves: {
				X: { from: Position; to: Position };
				O: { from: Position; to: Position };
			};
	  }
	| {
			type: "commitPlace";
			player: Player;
			position: Position;
	  }
	| { type: "query"; trait: string; value: boolean }
	| { type: "guess"; id: string };

/** Structured legality failure codes for debug UI / agents. */
export type IllegalReason =
	| "game_over"
	| "wrong_player"
	| "cell_occupied"
	| "must_flip"
	| "suicide"
	| "ko"
	| "superko"
	| "own_ship"
	| "column_full"
	| "row_full"
	| "no_own_piece"
	| "invalid_destination"
	| "mode_mismatch"
	| "not_applicable"
	| "illegal_or_noop"
	| "ship_shape"
	| "wrong_phase"
	| "already_committed";

export type ExplainResult =
	| { legal: true }
	| { legal: false; reason: IllegalReason; detail: string };

export type KernelEvent =
	| {
			type: "actionApplied";
			action: KernelAction;
			player: Player | "simultaneous";
	  }
	| {
			type: "shotResult";
			position: Position;
			result: ShotResult;
			player: Player;
	  }
	| {
			type: "pieceCaptured";
			position: Position;
			captured: Player;
			by: Player;
	  }
	| {
			type: "queryAnswered";
			player: Player;
			trait: string;
			value: boolean;
			answer: boolean;
	  }
	| {
			type: "guessResult";
			player: Player;
			targetId: string;
			correct: boolean;
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
	/** Side to move, or `"simultaneous"` when both players act each round. */
	currentPlayer(state: GameState): PlayerId | "simultaneous";
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
	/**
	 * Simultaneous schedule: build a joint place from per-player place actions
	 * and step once (README jointAction foothold).
	 */
	stepJoint(
		state: GameState,
		joint: { 0: KernelAction; 1: KernelAction },
		seed?: Seed
	): Effect.Effect<StepResult>;
	stepJointSync(
		state: GameState,
		joint: { 0: KernelAction; 1: KernelAction },
		seed?: Seed
	): StepResult;
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
		case "activateRow":
			return `row ${action.row}`;
		case "popOutColumn":
			return `pop-out col ${action.col}`;
		case "popOutRow":
			return `pop-out row ${action.row}`;
		case "tick":
			return "tick";
		case "pass":
			return "pass";
		case "simultaneousPlace": {
			const xs = asPlacementList(action.placements.X);
			const os = asPlacementList(action.placements.O);
			const xPart = xs.map((p) => `(${p.row},${p.col})`).join("+");
			const oPart = os.map((p) => `(${p.row},${p.col})`).join("+");
			return `joint place X${xPart} O${oPart}`;
		}
		case "simultaneousMove": {
			const fmt = (m: { from: Position; to: Position }) =>
				`(${m.from.row},${m.from.col})→(${m.to.row},${m.to.col})`;
			return `joint move X${fmt(action.moves.X)} O${fmt(action.moves.O)}`;
		}
		case "commitPlace":
			return `commit ${action.player} (${action.position.row},${action.position.col})`;
		case "query":
			return `query ${action.trait}=${action.value}`;
		case "guess":
			return `guess ${action.id}`;
	}
}

/** Human-readable kernel event line for sandbox / debug UI. */
export function formatKernelEvent(event: KernelEvent): string {
	switch (event.type) {
		case "actionApplied":
			return `${event.player}: ${formatAction(event.action)}`;
		case "shotResult":
			return `${event.player}: ${event.result} at (${event.position.row},${event.position.col})`;
		case "pieceCaptured":
			return `${event.by} captured ${event.captured} at (${event.position.row},${event.position.col})`;
		case "queryAnswered":
			return `${event.player}: query ${event.trait}=${event.value} → ${event.answer}`;
		case "guessResult":
			return `${event.player}: guess ${event.targetId} → ${event.correct ? "correct" : "wrong"}`;
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
		(before.turnPhaseIndex ?? 0) === (after.turnPhaseIndex ?? 0) &&
		(before.actionsRemaining ?? null) === (after.actionsRemaining ?? null) &&
		(before.koPoint?.row ?? null) === (after.koPoint?.row ?? null) &&
		(before.koPoint?.col ?? null) === (after.koPoint?.col ?? null) &&
		before.grid.cells === after.grid.cells &&
		before.hidden?.cells === after.hidden?.cells &&
		before.pendingPlaces === after.pendingPlaces &&
		before.committedPlacements === after.committedPlacements &&
		before.positionHistory === after.positionHistory &&
		before.deduction === after.deduction
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
		const probePlayer =
			action.type === "commitPlace"
				? playerIdOf(action.player)
				: (config.turnSchedule ?? "alternating") === "simultaneous"
					? 0
					: playerIdOf(state.currentPlayer);
		const explained = explainKernelAction(
			config,
			state,
			probePlayer,
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

	const actor: Player | "simultaneous" =
		action.type === "simultaneousPlace" || action.type === "simultaneousMove"
			? "simultaneous"
			: action.type === "commitPlace"
				? action.player
				: state.currentPlayer;
	const events: KernelEvent[] = [
		{ type: "actionApplied", action, player: actor }
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

	if (
		action.type === "move" &&
		config.movement?.capture === "replace" &&
		actor !== "simultaneous"
	) {
		const prior = getCell(state.grid, action.to);
		if (
			(prior === "X" || prior === "O") &&
			prior !== actor &&
			getCell(nextState.grid, action.to) === actor
		) {
			events.push({
				type: "pieceCaptured",
				position: action.to,
				captured: prior,
				by: actor
			});
		}
	}

	if (
		action.type === "simultaneousMove" &&
		config.movement?.capture === "replace"
	) {
		const resolveOrder = config.resolveOrder ?? "joint";
		if (resolveOrder === "joint") {
			for (const seat of ["X", "O"] as const) {
				const m = action.moves[seat];
				const prior = getCell(state.grid, m.to);
				if (prior !== "X" && prior !== "O") continue;
				if (prior === seat) continue;
				// Fleeing piece: opponent left this cell in the same round — not a capture.
				const opp = prior;
				const oppMove = action.moves[opp];
				const oppFled =
					oppMove.from.row === m.to.row && oppMove.from.col === m.to.col;
				if (oppFled) continue;
				if (getCell(nextState.grid, m.to) !== seat) continue;
				events.push({
					type: "pieceCaptured",
					position: m.to,
					captured: prior,
					by: seat
				});
			}
		} else {
			// Ordered: emit captures in apply order when a seat overwrites an enemy.
			const first: "X" | "O" = resolveOrder === "x_first" ? "X" : "O";
			const second: "X" | "O" = first === "X" ? "O" : "X";
			let sim = state.grid;
			for (const seat of [first, second] as const) {
				const m = action.moves[seat];
				if (getCell(sim, m.from) !== seat) continue;
				const dest = getCell(sim, m.to);
				const isEnemy = (dest === "X" || dest === "O") && dest !== seat;
				const sameDest =
					action.moves.X.to.row === action.moves.O.to.row &&
					action.moves.X.to.col === action.moves.O.to.col;
				if (dest !== null) {
					if (!isEnemy) continue;
					if (sameDest && seat === second) continue;
				}
				if (isEnemy) {
					events.push({
						type: "pieceCaptured",
						position: m.to,
						captured: dest,
						by: seat
					});
				}
				let cells = setCell(sim, m.from, null);
				cells = setCell({ ...sim, cells }, m.to, seat);
				sim = { ...sim, cells };
			}
		}
	}

	if (action.type === "query") {
		const lq = nextState.deduction?.lastQuery;
		if (lq) {
			events.push({
				type: "queryAnswered",
				player: lq.by,
				trait: lq.trait,
				value: lq.value,
				answer: lq.answer
			});
		}
	}

	if (action.type === "guess" && actor !== "simultaneous") {
		const opponent: Player = actor === "X" ? "O" : "X";
		const secretId = state.deduction?.secret[opponent];
		const correct = secretId !== undefined && secretId === action.id;
		events.push({
			type: "guessResult",
			player: actor,
			targetId: action.id,
			correct
		});
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

function resolveKoRule(config: GameConfig): KoRule {
	if (config.koRule) return config.koRule;
	return config.koEnabled ? "point" : "none";
}

function columnHasSpace(
	state: GameState,
	col: number,
	direction: "down" | "up" = "down",
	config?: GameConfig
): boolean {
	const delayTurns = config?.delayTurns ?? 0;
	if (delayTurns > 0) {
		// Slot reservation: empty cells in column must exceed pending column intents
		let empty = 0;
		for (let row = 0; row < state.grid.height; row++) {
			if (getCell(state.grid, { row, col }) === null) empty += 1;
		}
		const reserved = (state.pendingPlaces ?? []).filter(
			(p) => p.kind === "column" && p.col === col
		).length;
		return empty > reserved;
	}
	// Entry side must be clear: top for down gravity, bottom for up.
	const entryRow =
		direction === "down" ? 0 : state.grid.height - 1;
	return getCell(state.grid, { row: entryRow, col }) === null;
}

function rowHasSpace(
	state: GameState,
	row: number,
	direction: "left" | "right" = "right",
	config?: GameConfig
): boolean {
	const delayTurns = config?.delayTurns ?? 0;
	if (delayTurns > 0) {
		let empty = 0;
		for (let col = 0; col < state.grid.width; col++) {
			if (getCell(state.grid, { row, col }) === null) empty += 1;
		}
		const reserved = (state.pendingPlaces ?? []).filter(
			(p) => p.kind === "row" && p.row === row
		).length;
		return empty > reserved;
	}
	// Entry side must be clear: left for right gravity, right for left.
	const entryCol =
		direction === "right" ? 0 : state.grid.width - 1;
	return getCell(state.grid, { row, col: entryCol }) === null;
}

function canPlaceCell(
	state: GameState,
	pos: Position,
	config: GameConfig,
	player: Player = state.currentPlayer
): boolean {
	const topology = config.topology ?? "rectangle";
	if (!isActivePosition(pos, topology, config.graph)) return false;
	if (getCell(state.grid, pos) !== null) return false;
	if (
		(state.pendingPlaces ?? []).some(
			(p) =>
				isCellPending(p) &&
				p.position.row === pos.row &&
				p.position.col === pos.col
		)
	) {
		return false;
	}
	// Place→fire: public spotters cannot cover hidden fleet cells
	if (
		(config.observationMode ?? "full") === "hit_miss" &&
		(config.turnPhases?.length ?? 0) > 0 &&
		state.hidden != null
	) {
		const under = getCell(state.hidden, pos);
		if (under === "X" || under === "O") return false;
	}
	if (!config.captureEnabled) return true;
	const wrap = config.gridWrap === true;
	const captureMode = config.captureMode ?? "flip";
	if (captureMode === "liberties") {
		return isLegalLibertyPlace(state.grid, pos, player, wrap, {
			koRule: resolveKoRule(config),
			koPoint: state.koPoint,
			positionHistory: state.positionHistory
		});
	}
	const placedCells = setCell(state.grid, pos, player);
	const after = applyCaptureIfAny(
		{ ...state.grid, cells: placedCells },
		pos,
		player,
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

	const simultaneous =
		(config.turnSchedule ?? "alternating") === "simultaneous";
	if (!simultaneous && playerIdOf(state.currentPlayer) !== player) return [];

	const actions: KernelAction[] = [];
	const inputMode = config.inputMode ?? "cell";
	const overflow = config.overflow ?? "reject";
	const hitMiss = (config.observationMode ?? "full") === "hit_miss";
	const manualTick = (config.turnSchedule ?? "alternating") === "manual_tick";
	const actingPlayer = simultaneous ? playerOf(player) : state.currentPlayer;

	if (simultaneous) {
		const commitReveal = config.commitReveal === true;
		const acting = playerOf(player);
		const budget = config.actionsPerTurn ?? 1;

		// Simultaneous move: per-seat {from,to}; compose via stepJoint.
		if (inputMode === "move") {
			const movement = config.movement;
			if (!movement) return [];
			const board = movementBoardFrom(config);
			for (const from of allActivePositions(
				state.grid,
				config.topology ?? "rectangle",
				config.graph
			)) {
				if (getCell(state.grid, from) !== acting) continue;
				for (const to of legalDestinations(state.grid, from, movement, board)) {
					if (canMove(state.grid, from, to, acting, movement, board)) {
						actions.push({ type: "move", from, to });
					}
				}
			}
			return actions;
		}

		if (commitReveal) {
			const own = state.committedPlacements?.[acting] ?? [];
			// Budget full this round → no further actions until reveal.
			if (own.length >= budget) return [];
			for (const position of allActivePositions(
				state.grid,
				config.topology ?? "rectangle",
				config.graph
			)) {
				if (listHasPosition(own, position)) continue;
				if (canPlaceCell(state, position, config, acting)) {
					actions.push({
						type: "commitPlace",
						player: acting,
						position
					});
				}
			}
			return actions;
		}
		// Open simultaneous place: per-player place choices; compose via stepJoint.
		for (const position of allActivePositions(
			state.grid,
			config.topology ?? "rectangle",
			config.graph
		)) {
			if (canPlaceCell(state, position, config, actingPlayer)) {
				actions.push({ type: "place", position });
			}
		}
		return actions;
	}

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

	if (inputMode === "deduction" && config.deduction) {
		for (const trait of config.deduction.traits) {
			actions.push({ type: "query", trait, value: true });
			actions.push({ type: "query", trait, value: false });
		}
		const eliminated = new Set(
			state.deduction?.eliminated[state.currentPlayer] ?? []
		);
		for (const character of config.deduction.roster) {
			if (!eliminated.has(character.id)) {
				actions.push({ type: "guess", id: character.id });
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
		// In-turn place→fire / place→move→fire: legal actions follow turnPhases
		const turnPhases = config.turnPhases;
		if (turnPhases && turnPhases.length > 0) {
			const phase = turnPhases[state.turnPhaseIndex ?? 0] ?? "place";
			if (phase === "place") {
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
			if (phase === "move") {
				const movement = config.movement;
				if (!movement) return actions;
				const board = movementBoardFrom(config);
				for (const from of allActivePositions(
					state.grid,
					config.topology ?? "rectangle",
					config.graph
				)) {
					if (getCell(state.grid, from) !== state.currentPlayer) continue;
					for (const to of legalDestinations(state.grid, from, movement, board)) {
						if (
							canMove(state.grid, from, to, state.currentPlayer, movement, board)
						) {
							actions.push({ type: "move", from, to });
						}
					}
				}
				return actions;
			}
			if (phase === "fire") {
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

	// In-turn phase sequence: legal actions follow phases[turnPhaseIndex]
	const turnPhases = config.turnPhases;
	if (turnPhases && turnPhases.length > 0) {
		const phase = turnPhases[state.turnPhaseIndex ?? 0] ?? "place";
		if (phase === "place") {
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
		if (phase === "move") {
			const movement = config.movement;
			if (!movement) return actions;
			const board = movementBoardFrom(config);
			for (const from of allActivePositions(
				state.grid,
				config.topology ?? "rectangle",
				config.graph
			)) {
				if (getCell(state.grid, from) !== state.currentPlayer) continue;
				for (const to of legalDestinations(state.grid, from, movement, board)) {
					if (
						canMove(state.grid, from, to, state.currentPlayer, movement, board)
					) {
						actions.push({ type: "move", from, to });
					}
				}
			}
			return actions;
		}
		return actions;
	}

	if (inputMode === "move") {
		const movement = config.movement;
		if (!movement) return actions;
		const board = movementBoardFrom(config);
		for (const from of allActivePositions(
			state.grid,
			config.topology ?? "rectangle",
			config.graph
		)) {
			if (getCell(state.grid, from) !== state.currentPlayer) continue;
			for (const to of legalDestinations(state.grid, from, movement, board)) {
				if (
					canMove(state.grid, from, to, state.currentPlayer, movement, board)
				) {
					actions.push({ type: "move", from, to });
				}
			}
		}
		return actions;
	}

	if (inputMode === "column") {
		const direction = config.gravityDirection ?? "down";
		const vertical =
			direction === "down" || direction === "up" ? direction : "down";
		for (let col = 0; col < state.grid.width; col++) {
			if (columnHasSpace(state, col, vertical, config)) {
				actions.push({ type: "activateColumn", col });
			}
		}
	} else if (inputMode === "row") {
		const direction = config.gravityDirection ?? "right";
		const horizontal =
			direction === "left" || direction === "right" ? direction : "right";
		for (let row = 0; row < state.grid.height; row++) {
			if (rowHasSpace(state, row, horizontal, config)) {
				actions.push({ type: "activateRow", row });
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

	if (overflow === "pop_out_bottom" || overflow === "pop_out_top") {
		const direction = config.gravityDirection ?? "down";
		const fromBottom = overflow === "pop_out_bottom" && direction === "down";
		const fromTop = overflow === "pop_out_top" && direction === "up";
		if (fromBottom || fromTop) {
			const height = state.grid.height;
			const exitRow = fromBottom ? height - 1 : 0;
			for (let col = 0; col < state.grid.width; col++) {
				const exit = getCell(state.grid, { row: exitRow, col });
				if (exit === state.currentPlayer) {
					actions.push({ type: "popOutColumn", col });
				}
			}
		}
	}

	if (overflow === "pop_out_right" || overflow === "pop_out_left") {
		const direction = config.gravityDirection ?? "down";
		const fromRight = overflow === "pop_out_right" && direction === "right";
		const fromLeft = overflow === "pop_out_left" && direction === "left";
		if (fromRight || fromLeft) {
			const width = state.grid.width;
			const exitCol = fromRight ? width - 1 : 0;
			for (let row = 0; row < state.grid.height; row++) {
				const exit = getCell(state.grid, { row, col: exitCol });
				if (exit === state.currentPlayer) {
					actions.push({ type: "popOutRow", row });
				}
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
	if (
		(state.pendingPlaces ?? []).some(
			(p) =>
				isCellPending(p) &&
				p.position.row === pos.row &&
				p.position.col === pos.col
		)
	) {
		return "cell_occupied";
	}
	if (!config.captureEnabled) return null;
	const wrap = config.gridWrap === true;
	const captureMode = config.captureMode ?? "flip";
	if (captureMode === "liberties") {
		const koRule = resolveKoRule(config);
		if (
			koRule === "point" &&
			state.koPoint != null &&
			state.koPoint.row === pos.row &&
			state.koPoint.col === pos.col
		) {
			return "ko";
		}
		if (
			isLegalLibertyPlace(state.grid, pos, state.currentPlayer, wrap, {
				koRule,
				koPoint: state.koPoint,
				positionHistory: state.positionHistory
			})
		) {
			return null;
		}
		// Distinguish superko from suicide when the cell is empty
		if (
			usesSuperkoHistory(koRule) &&
			getCell(state.grid, pos) === null
		) {
			const withoutHistory = isLegalLibertyPlace(
				state.grid,
				pos,
				state.currentPlayer,
				wrap,
				{ koRule: "none" }
			);
			if (withoutHistory) return "superko";
		}
		return "suicide";
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
		case "ko":
			return "Immediate recapture of the last captured stone is forbidden";
		case "superko":
			return "Move would repeat a previous board situation (superko)";
		case "own_ship":
			return "Cannot fire on your own ship";
		case "column_full":
			return "Column has no empty space";
		case "row_full":
			return "Row has no empty space";
		case "no_own_piece":
			return "No owned piece at source / pop-out exit cell";
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
		case "already_committed":
			return "This seat already committed for the current round";
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
	const simultaneous =
		(config.turnSchedule ?? "alternating") === "simultaneous";
	if (!simultaneous && playerIdOf(state.currentPlayer) !== player) {
		return {
			legal: false,
			reason: "wrong_player",
			detail: detailFor("wrong_player", action)
		};
	}

	// Joint place: all constituent places must be individually legal on the
	// pre-round board, lengths must match actionsPerTurn, no within-seat dups.
	if (action.type === "simultaneousPlace") {
		if (!simultaneous) {
			return {
				legal: false,
				reason: "mode_mismatch",
				detail: detailFor("mode_mismatch", action)
			};
		}
		if ((config.inputMode ?? "cell") === "move") {
			return {
				legal: false,
				reason: "mode_mismatch",
				detail: detailFor("mode_mismatch", action)
			};
		}
		const budget = config.actionsPerTurn ?? 1;
		const xs = asPlacementList(action.placements.X);
		const os = asPlacementList(action.placements.O);
		if (xs.length !== budget || os.length !== budget) {
			return {
				legal: false,
				reason: "illegal_or_noop",
				detail: detailFor("illegal_or_noop", action)
			};
		}
		const hasDup = (list: Position[]) => {
			for (let i = 0; i < list.length; i++) {
				for (let j = i + 1; j < list.length; j++) {
					if (positionsEqual(list[i]!, list[j]!)) return true;
				}
			}
			return false;
		};
		if (hasDup(xs) || hasDup(os)) {
			return {
				legal: false,
				reason: "illegal_or_noop",
				detail: detailFor("illegal_or_noop", action)
			};
		}
		const xOk = xs.every((p) => canPlaceCell(state, p, config, "X"));
		const oOk = os.every((p) => canPlaceCell(state, p, config, "O"));
		if (xOk && oOk) return { legal: true };
		return {
			legal: false,
			reason: "cell_occupied",
			detail: detailFor("cell_occupied", action)
		};
	}

	// Joint move: joint resolve uses vacated-origin path checks (replace
	// hybrid restores fleeing capture targets at destination); ordered uses
	// sequential path / capture revalidation.
	if (action.type === "simultaneousMove") {
		if (!simultaneous || (config.inputMode ?? "cell") !== "move") {
			return {
				legal: false,
				reason: "mode_mismatch",
				detail: detailFor("mode_mismatch", action)
			};
		}
		const movement = config.movement;
		if (!movement) {
			return {
				legal: false,
				reason: "mode_mismatch",
				detail: detailFor("mode_mismatch", action)
			};
		}
		const board = movementBoardFrom(config);
		const resolveOrder = config.resolveOrder ?? "joint";
		const ok =
			resolveOrder === "joint"
				? canJointSimultaneousMoves(
						state.grid,
						action.moves,
						movement,
						board
					)
				: canOrderedSimultaneousMoves(
						state.grid,
						action.moves,
						movement,
						resolveOrder,
						board
					);
		if (ok) return { legal: true };
		return {
			legal: false,
			reason: "invalid_destination",
			detail: detailFor("invalid_destination", action)
		};
	}

	if (action.type === "commitPlace") {
		if (!simultaneous || !config.commitReveal) {
			return {
				legal: false,
				reason: "mode_mismatch",
				detail: detailFor("mode_mismatch", action)
			};
		}
		if (playerIdOf(action.player) !== player) {
			return {
				legal: false,
				reason: "wrong_player",
				detail: detailFor("wrong_player", action)
			};
		}
		const budget = config.actionsPerTurn ?? 1;
		const own = state.committedPlacements?.[action.player] ?? [];
		if (own.length >= budget) {
			return {
				legal: false,
				reason: "already_committed",
				detail: detailFor("already_committed", action)
			};
		}
		if (listHasPosition(own, action.position)) {
			return {
				legal: false,
				reason: "already_committed",
				detail: detailFor("already_committed", action)
			};
		}
		if (!canPlaceCell(state, action.position, config, action.player)) {
			return {
				legal: false,
				reason: "cell_occupied",
				detail: detailFor("cell_occupied", action)
			};
		}
		return { legal: true };
	}

	// In-turn phases: place/move/fire must match the active phase
	const turnPhases = config.turnPhases;
	if (turnPhases && turnPhases.length > 0) {
		const phase = turnPhases[state.turnPhaseIndex ?? 0] ?? "place";
		if (action.type === "place" && phase !== "place") {
			return {
				legal: false,
				reason: "wrong_phase",
				detail: detailFor("wrong_phase", action)
			};
		}
		if (action.type === "move" && phase !== "move") {
			return {
				legal: false,
				reason: "wrong_phase",
				detail: detailFor("wrong_phase", action)
			};
		}
		if (action.type === "fire" && phase !== "fire") {
			return {
				legal: false,
				reason: "wrong_phase",
				detail: detailFor("wrong_phase", action)
			};
		}
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
		case "query": {
			if (inputMode !== "deduction" || !config.deduction) {
				return {
					legal: false,
					reason: "mode_mismatch",
					detail: detailFor("mode_mismatch", action)
				};
			}
			if (!config.deduction.traits.includes(action.trait)) {
				return {
					legal: false,
					reason: "illegal_or_noop",
					detail: detailFor("illegal_or_noop", action)
				};
			}
			break;
		}
		case "guess": {
			if (inputMode !== "deduction" || !config.deduction) {
				return {
					legal: false,
					reason: "mode_mismatch",
					detail: detailFor("mode_mismatch", action)
				};
			}
			const rosterIds = new Set(
				config.deduction.roster.map((c) => c.id)
			);
			if (!rosterIds.has(action.id)) {
				return {
					legal: false,
					reason: "illegal_or_noop",
					detail: detailFor("illegal_or_noop", action)
				};
			}
			const eliminated = new Set(
				state.deduction?.eliminated[state.currentPlayer] ?? []
			);
			if (eliminated.has(action.id)) {
				return {
					legal: false,
					reason: "illegal_or_noop",
					detail: detailFor("illegal_or_noop", action)
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
				(inputMode === "column" ||
					inputMode === "row" ||
					inputMode === "move")
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
			{
				const direction = config.gravityDirection ?? "down";
				const vertical =
					direction === "down" || direction === "up" ? direction : "down";
				if (!columnHasSpace(state, action.col, vertical, config)) {
					return {
						legal: false,
						reason: "column_full",
						detail: detailFor("column_full", action)
					};
				}
			}
			break;
		}
		case "activateRow": {
			if (inputMode !== "row") {
				return {
					legal: false,
					reason: "mode_mismatch",
					detail: detailFor("mode_mismatch", action)
				};
			}
			{
				const direction = config.gravityDirection ?? "right";
				const horizontal =
					direction === "left" || direction === "right"
						? direction
						: "right";
				if (!rowHasSpace(state, action.row, horizontal, config)) {
					return {
						legal: false,
						reason: "row_full",
						detail: detailFor("row_full", action)
					};
				}
			}
			break;
		}
		case "popOutColumn": {
			const direction = config.gravityDirection ?? "down";
			const fromBottom =
				overflow === "pop_out_bottom" && direction === "down";
			const fromTop = overflow === "pop_out_top" && direction === "up";
			if (!fromBottom && !fromTop) {
				return {
					legal: false,
					reason: "not_applicable",
					detail: detailFor("not_applicable", action)
				};
			}
			const exitRow = fromBottom ? state.grid.height - 1 : 0;
			const exit = getCell(state.grid, {
				row: exitRow,
				col: action.col
			});
			if (exit !== state.currentPlayer) {
				return {
					legal: false,
					reason: "no_own_piece",
					detail: detailFor("no_own_piece", action)
				};
			}
			break;
		}
		case "popOutRow": {
			const direction = config.gravityDirection ?? "down";
			const fromRight =
				overflow === "pop_out_right" && direction === "right";
			const fromLeft = overflow === "pop_out_left" && direction === "left";
			if (!fromRight && !fromLeft) {
				return {
					legal: false,
					reason: "not_applicable",
					detail: detailFor("not_applicable", action)
				};
			}
			const exitCol = fromRight ? state.grid.width - 1 : 0;
			const exit = getCell(state.grid, {
				row: action.row,
				col: exitCol
			});
			if (exit !== state.currentPlayer) {
				return {
					legal: false,
					reason: "no_own_piece",
					detail: detailFor("no_own_piece", action)
				};
			}
			break;
		}
		case "move": {
			const turnPhases = config.turnPhases;
			const inTurnMove =
				turnPhases &&
				turnPhases[state.turnPhaseIndex ?? 0] === "move";
			if ((inputMode !== "move" && !inTurnMove) || !config.movement) {
				return {
					legal: false,
					reason: "mode_mismatch",
					detail: detailFor("mode_mismatch", action)
				};
			}
			const acting = simultaneous
				? playerOf(player)
				: state.currentPlayer;
			if (getCell(state.grid, action.from) !== acting) {
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
					acting,
					config.movement,
					movementBoardFrom(config)
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
		case "activateRow":
		case "popOutRow":
			return b.type === a.type && a.row === b.row;
		case "tick":
		case "pass":
			return true;
		case "simultaneousPlace": {
			if (b.type !== "simultaneousPlace") return false;
			const aX = asPlacementList(a.placements.X);
			const aO = asPlacementList(a.placements.O);
			const bX = asPlacementList(b.placements.X);
			const bO = asPlacementList(b.placements.O);
			if (aX.length !== bX.length || aO.length !== bO.length) return false;
			return (
				aX.every((p, i) => positionsEqual(p, bX[i]!)) &&
				aO.every((p, i) => positionsEqual(p, bO[i]!))
			);
		}
		case "simultaneousMove": {
			if (b.type !== "simultaneousMove") return false;
			const moveEq = (
				m: { from: Position; to: Position },
				n: { from: Position; to: Position }
			) =>
				positionsEqual(m.from, n.from) && positionsEqual(m.to, n.to);
			return (
				moveEq(a.moves.X, b.moves.X) && moveEq(a.moves.O, b.moves.O)
			);
		}
		case "commitPlace":
			return (
				b.type === "commitPlace" &&
				a.player === b.player &&
				a.position.row === b.position.row &&
				a.position.col === b.position.col
			);
		case "query":
			return (
				b.type === "query" &&
				a.trait === b.trait &&
				a.value === b.value
			);
		case "guess":
			return b.type === "guess" && a.id === b.id;
	}
}

/** Build a joint place action from two per-player place actions (1-per-seat). */
export function jointPlaceFromActions(
	action0: KernelAction,
	action1: KernelAction
): KernelAction | null {
	if (action0.type !== "place" || action1.type !== "place") return null;
	return {
		type: "simultaneousPlace",
		placements: { X: action0.position, O: action1.position }
	};
}

/** Build a joint move action from two per-player move actions. */
export function jointMoveFromActions(
	action0: KernelAction,
	action1: KernelAction
): KernelAction | null {
	if (action0.type !== "move" || action1.type !== "move") return null;
	return {
		type: "simultaneousMove",
		moves: {
			X: { from: action0.from, to: action0.to },
			O: { from: action1.from, to: action1.to }
		}
	};
}

/**
 * Build a multi-action simultaneous place from N place actions per seat.
 * Lengths must match; returns null on mismatch or non-place actions.
 */
export function jointPlacesFromActions(
	actions0: readonly KernelAction[],
	actions1: readonly KernelAction[]
): KernelAction | null {
	if (actions0.length === 0 || actions0.length !== actions1.length) return null;
	const xs: Position[] = [];
	const os: Position[] = [];
	for (let i = 0; i < actions0.length; i++) {
		const a = actions0[i]!;
		const b = actions1[i]!;
		if (a.type !== "place" || b.type !== "place") return null;
		xs.push(a.position);
		os.push(b.position);
	}
	return {
		type: "simultaneousPlace",
		placements: { X: xs, O: os }
	};
}

/**
 * Board cells to highlight for a legal-action set (overlay / heatmap).
 * Column/row gravity actions highlight the entry-side empty cell.
 */
export function highlightCellsForActions(
	state: GameState,
	actions: readonly KernelAction[],
	opts?: {
		selectedFrom?: Position | null;
		gravityDirection?: "down" | "up" | "left" | "right";
	}
): Position[] {
	const selected = opts?.selectedFrom ?? null;
	const direction = opts?.gravityDirection ?? "down";
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
			case "commitPlace":
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
				// Highlight entry-side empty cell (where the disc enters).
				if (direction === "down") {
					for (let row = 0; row < state.grid.height; row++) {
						if (getCell(state.grid, { row, col: action.col }) === null) {
							push({ row, col: action.col });
							break;
						}
					}
				} else {
					for (let row = state.grid.height - 1; row >= 0; row--) {
						if (getCell(state.grid, { row, col: action.col }) === null) {
							push({ row, col: action.col });
							break;
						}
					}
				}
				break;
			}
			case "activateRow": {
				if (direction === "right") {
					for (let col = 0; col < state.grid.width; col++) {
						if (getCell(state.grid, { row: action.row, col }) === null) {
							push({ row: action.row, col });
							break;
						}
					}
				} else {
					for (let col = state.grid.width - 1; col >= 0; col--) {
						if (getCell(state.grid, { row: action.row, col }) === null) {
							push({ row: action.row, col });
							break;
						}
					}
				}
				break;
			}
			case "popOutColumn":
				push({
					row: direction === "up" ? 0 : state.grid.height - 1,
					col: action.col
				});
				break;
			case "popOutRow":
				push({
					row: action.row,
					col: direction === "left" ? 0 : state.grid.width - 1
				});
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

	const stepJoint = (
		state: GameState,
		joint: { 0: KernelAction; 1: KernelAction },
		seed?: Seed
	): Effect.Effect<StepResult> => {
		const built =
			jointPlaceFromActions(joint[0], joint[1]) ??
			jointMoveFromActions(joint[0], joint[1]);
		if (!built) {
			return Effect.sync(() => ({
				nextState: state,
				events: [
					{
						type: "ignored" as const,
						action: joint[0],
						reason: "mode_mismatch" as const
					}
				],
				terminal: state.status !== "playing",
				outcome: outcomeOf(state),
				observations: observationsFor(config, state)
			}));
		}
		return step(state, built, seed);
	};

	return {
		config,
		initialState(seed?: Seed) {
			return createInitialState({
				...config,
				seed: seed ?? config.seed
			});
		},
		currentPlayer(state) {
			if ((config.turnSchedule ?? "alternating") === "simultaneous") {
				return "simultaneous";
			}
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
		},
		stepJoint,
		stepJointSync(state, joint, seed) {
			return Effect.runSync(stepJoint(state, joint, seed));
		}
	};
}

/**
 * Advance one decision ply: alternating single action, or simultaneous joint
 * place when `currentPlayer` is `"simultaneous"`. `pickFor` selects among
 * `legalActions` for the given player (called once, or twice when joint).
 * Under commitReveal, picks commits until each seat fills its per-round budget
 * (final commit auto-reveals). Under open multi-action simultaneous, picks
 * `actionsPerTurn` places per seat then joint-resolves.
 */
export function stepPly(
	kernel: GameKernel,
	state: GameState,
	pickFor: (player: PlayerId, legal: KernelAction[]) => KernelAction | null,
	seed?: Seed
): StepResult | null {
	const side = kernel.currentPlayer(state);
	if (side === "simultaneous") {
		const budget = kernel.config.actionsPerTurn ?? 1;
		if (kernel.config.commitReveal) {
			let s = state;
			let last: StepResult | null = null;
			// Fill each seat's commit budget; reveal fires when both are full.
			let guard = budget * 2 + 2;
			while (guard-- > 0 && s.status === "playing") {
				const xLen = s.committedPlacements?.X?.length ?? 0;
				const oLen = s.committedPlacements?.O?.length ?? 0;
				if (xLen >= budget && oLen >= budget) break;
				const pid: PlayerId = xLen < budget ? 0 : 1;
				const legal = kernel.legalActions(s, pid);
				const action = pickFor(pid, legal);
				if (!action) return last;
				last = kernel.stepSync(s, action, seed);
				s = last.nextState;
				if (s.status !== "playing") return last;
				// After reveal, committedPlacements clears — stop.
				if (
					(s.committedPlacements?.X?.length ?? 0) === 0 &&
					(s.committedPlacements?.O?.length ?? 0) === 0 &&
					s.moveCount > state.moveCount
				) {
					return last;
				}
			}
			return last;
		}
		if (budget <= 1) {
			const a0 = pickFor(0, kernel.legalActions(state, 0));
			const a1 = pickFor(1, kernel.legalActions(state, 1));
			if (!a0 || !a1) return null;
			return kernel.stepJointSync(state, { 0: a0, 1: a1 }, seed);
		}
		// Multi-action open simultaneous: collect N distinct places per seat.
		const pickN = (pid: PlayerId): KernelAction[] | null => {
			const picked: KernelAction[] = [];
			const used = new Set<string>();
			for (let i = 0; i < budget; i++) {
				const legal = kernel
					.legalActions(state, pid)
					.filter((a) => {
						if (a.type !== "place") return false;
						const key = `${a.position.row},${a.position.col}`;
						return !used.has(key);
					});
				const action = pickFor(pid, legal);
				if (!action || action.type !== "place") return null;
				used.add(`${action.position.row},${action.position.col}`);
				picked.push(action);
			}
			return picked;
		};
		const xs = pickN(0);
		const os = pickN(1);
		if (!xs || !os) return null;
		const joint = jointPlacesFromActions(xs, os);
		if (!joint) return null;
		return kernel.stepSync(state, joint, seed);
	}
	const action = pickFor(side, kernel.legalActions(state, side));
	if (!action) return null;
	return kernel.stepSync(state, action, seed);
}
