// Pure reducer: State -> Event -> State

import type {
	GameState,
	GameEvent,
	Position,
	Player,
	CellValue,
	Grid,
	PendingPlace,
	DeductionCharacter,
	QueryEvent
} from "./types";
import {
	asMoveList,
	asPlacementList,
	getCell,
	isCellPending,
	listHasMove,
	listHasPosition,
	movesEqual,
	positionsEqual,
	setCell,
	toIndex,
	applySoloMoves,
	type MovePair
} from "./types";
import { checkWinner, type AdjacencyConfig } from "@/engine/rules";
import { applyCaptureIfAny } from "@/engine/capture";
import {
	applyLibertyCapture,
	areaOutcome,
	boardPositionHash,
	isLegalLibertyPlace,
	koPointFromCapture,
	situationHash,
	usesSuperkoHistory,
	type KoRule
} from "@/engine/liberties";
import { fleetDestroyed } from "@/engine/observation";
import {
	advanceFleetProgress,
	bothFleetsPlaced,
	canPlaceFleetCell,
	initialFleetProgressMap,
	usesPlacementPhase,
	type FleetConfig
} from "@/engine/fleet";
import {
	canJointSimultaneousMoves,
	canOrderedSimultaneousMoves,
	canMove,
	isJumpCapture,
	jumpDestinations,
	jumpMid,
	movementBoardFrom,
	type MovementConfig
} from "@/engine/movement";
import {
	applyLifeStep,
	type SchedulerConfig
} from "@/engine/scheduler";
import {
	isActivePosition,
	type GraphTopologyData,
	type GridTopology
} from "@/engine/topology";
import { getCell as readCell } from "@/engine/types";
import {
	answerQuery,
	answerQueryConjunction,
	answerQueryDisjunction,
	assignSecrets,
	canEliminate,
	eliminateAfterQuery,
	eliminateAfterQueryConjunction,
	eliminateAfterQueryDisjunction,
	isGuessCorrect,
	validCompoundClauses
} from "@/engine/deduction";

export type InitialSeed = {
	row: number;
	col: number;
	player: Player;
	visibility?: "public" | "owner";
};

export type GameConfig = {
	gridWidth: number;
	gridHeight: number;
	/** Board topology; default rectangle. */
	topology?: GridTopology;
	/** Compiled adjacency when topology = graph. */
	graph?: GraphTopologyData;
	/** Toroidal adjacency for rectangle boards. */
	gridWrap?: boolean;
	winLength: number;
	adjacency: AdjacencyConfig;
	inputMode?: "cell" | "column" | "row" | "move" | "deduction";
	placementMode?: "direct" | "gravity";
	/** Gravity settle axis. Vertical ↔ column input; horizontal ↔ row input. */
	gravityDirection?: "down" | "up" | "left" | "right";
	/**
	 * Pop-out overflow: bottom↔down, top↔up, right↔right, left↔left.
	 * Vertical uses popOutColumn; horizontal uses popOutRow.
	 */
	overflow?:
		| "reject"
		| "pop_out_bottom"
		| "pop_out_top"
		| "pop_out_left"
		| "pop_out_right";
	captureEnabled?: boolean;
	/** flip = Reversi; liberties = Go-lite group removal. */
	captureMode?: "flip" | "liberties";
	/** none | point (simple ko) | positional | situational (superko). */
	koRule?: KoRule;
	/** Legacy alias: true when koRule is point or any superko. */
	koEnabled?: boolean;
	observationMode?: "full" | "hit_miss" | "fog" | "deduction";
	/** Fog-of-war radius (Chebyshev/Manhattan/hex/graph hops). Used when mode=fog. */
	fogRadius?: number;
	fogMetric?: "chebyshev" | "manhattan";
	objectiveMode?:
		| "n_in_a_row"
		| "destroy_hidden"
		| "connect_or_destroy"
		| "reach_row"
		| "area_control"
		| "identify_secret"
		| "none";
	/** Classic alternating turns, discrete global tick (Life), or simultaneous joint place. */
	turnSchedule?: "alternating" | "manual_tick" | "simultaneous";
	/**
	 * Successful actions before handoff (alternating) or places per seat per
	 * simultaneous round. Default 1. When > 1 under alternating,
	 * GameState.actionsRemaining tracks the remaining budget.
	 */
	actionsPerTurn?: number;
	/**
	 * Delayed place: intervening successful places before a queued intent
	 * materializes. 0 / omitted = immediate place.
	 */
	delayTurns?: number;
	/**
	 * Hidden simultaneous: commit privately then reveal jointly.
	 * Requires turnSchedule = simultaneous.
	 */
	commitReveal?: boolean;
	/**
	 * Simultaneous same-cell resolution: joint (both-or-neither) or ordered
	 * seat priority (`x_first` / `o_first`). Default joint.
	 */
	resolveOrder?: "joint" | "x_first" | "o_first";
	/**
	 * Ordered in-turn action types (place→move / place→fire /
	 * place→move→fire / move→fire, or deduction query→eliminate /
	 * query→guess / query→eliminate→guess) before handoff. When set,
	 * GameState.turnPhaseIndex tracks the active phase.
	 */
	turnPhases?: Array<
		"place" | "move" | "fire" | "query" | "eliminate" | "guess"
	>;
	scheduler?: SchedulerConfig;
	movement?: MovementConfig;
	/** Home rows for reach_row objective (player → target row index). */
	targetRows?: { X: number; O: number };
	/**
	 * Multi-ship placement phase for hit_miss. When set, game starts in
	 * placement (place onto hidden) then transitions to combat (fire).
	 */
	fleet?: FleetConfig;
	/** Seed for deduction secrets (from config.rng.seed). */
	seed?: number;
	/** Deduction / Guess Who-lite roster + traits. */
	deduction?: {
		roster: DeductionCharacter[];
		traits: string[];
		wrongGuess: "lose" | "end_turn";
		/** When false, query answers without pruning; use eliminate actions. */
		autoEliminate: boolean;
		/** single (default), compound AND, or compound OR queries. */
		queryShape: "single" | "and" | "or";
		/** Exact clause count for and|or (default 2). */
		compoundArity: number;
	};
	initial?: InitialSeed[];
};

function emptyGrid(width: number, height: number): Grid {
	return {
		width,
		height,
		cells: Array(width * height).fill(null) as CellValue[]
	};
}

function resolveKoRule(config: GameConfig): KoRule {
	if (config.koRule) return config.koRule;
	return config.koEnabled ? "point" : "none";
}

function resolveActionsPerTurn(config: GameConfig): number {
	const n = config.actionsPerTurn ?? 1;
	return n < 1 ? 1 : n;
}

function resolveDelayTurns(config: GameConfig): number {
	const n = config.delayTurns ?? 0;
	return n < 0 ? 0 : n;
}

/** Place/move connect wins for n_in_a_row and dual connect_or_destroy. */
function checksConnectWin(config: GameConfig): boolean {
	const mode = config.objectiveMode ?? "n_in_a_row";
	return mode === "n_in_a_row" || mode === "connect_or_destroy";
}

/** Fire sink wins for destroy_hidden and dual connect_or_destroy. */
function checksDestroyWin(config: GameConfig): boolean {
	const mode = config.objectiveMode ?? "n_in_a_row";
	return mode === "destroy_hidden" || mode === "connect_or_destroy";
}

function isPendingReserved(
	pending: PendingPlace[] | undefined,
	pos: Position
): boolean {
	return (pending ?? []).some(
		(p) =>
			isCellPending(p) &&
			p.position.row === pos.row &&
			p.position.col === pos.col
	);
}

function pendingColumnCount(
	pending: PendingPlace[] | undefined,
	col: number
): number {
	return (pending ?? []).filter((p) => p.kind === "column" && p.col === col)
		.length;
}

function pendingRowCount(
	pending: PendingPlace[] | undefined,
	row: number
): number {
	return (pending ?? []).filter((p) => p.kind === "row" && p.row === row)
		.length;
}

function emptyCellsInColumn(cells: CellValue[], width: number, height: number, col: number): number {
	let n = 0;
	for (let row = 0; row < height; row++) {
		if (cells[toIndex({ row, col }, width)] === null) n += 1;
	}
	return n;
}

function emptyCellsInRow(cells: CellValue[], width: number, row: number): number {
	let n = 0;
	for (let col = 0; col < width; col++) {
		if (cells[toIndex({ row, col }, width)] === null) n += 1;
	}
	return n;
}

/** First empty settle row for vertical gravity, or null if column full. */
function settleColumnRow(
	cells: CellValue[],
	width: number,
	height: number,
	col: number,
	direction: "down" | "up"
): number | null {
	if (direction === "down") {
		for (let row = height - 1; row >= 0; row--) {
			if (cells[toIndex({ row, col }, width)] === null) return row;
		}
	} else {
		for (let row = 0; row < height; row++) {
			if (cells[toIndex({ row, col }, width)] === null) return row;
		}
	}
	return null;
}

/** First empty settle col for horizontal gravity, or null if row full. */
function settleRowCol(
	cells: CellValue[],
	width: number,
	row: number,
	direction: "left" | "right"
): number | null {
	if (direction === "right") {
		for (let col = width - 1; col >= 0; col--) {
			if (cells[toIndex({ row, col }, width)] === null) return col;
		}
	} else {
		for (let col = 0; col < width; col++) {
			if (cells[toIndex({ row, col }, width)] === null) return col;
		}
	}
	return null;
}

function columnHasPendingSpace(
	cells: CellValue[],
	width: number,
	height: number,
	pending: PendingPlace[] | undefined,
	col: number
): boolean {
	return (
		emptyCellsInColumn(cells, width, height, col) >
		pendingColumnCount(pending, col)
	);
}

function rowHasPendingSpace(
	cells: CellValue[],
	width: number,
	pending: PendingPlace[] | undefined,
	row: number
): boolean {
	return emptyCellsInRow(cells, width, row) > pendingRowCount(pending, row);
}

function countFreeCells(
	cells: CellValue[],
	pending: PendingPlace[],
	grid: Grid,
	config: GameConfig
): number {
	const topology = config.topology ?? "rectangle";
	let free = 0;
	if (topology === "graph" && config.graph) {
		for (const pos of config.graph.active) {
			const idx = toIndex(pos, grid.width);
			if (cells[idx] === null && !isPendingReserved(pending, pos)) free += 1;
		}
	} else {
		for (let row = 0; row < grid.height; row++) {
			for (let col = 0; col < grid.width; col++) {
				const pos = { row, col };
				const idx = toIndex(pos, grid.width);
				if (cells[idx] === null && !isPendingReserved(pending, pos)) free += 1;
			}
		}
	}
	const gravityPending = pending.filter(
		(p) => p.kind === "column" || p.kind === "row"
	).length;
	return Math.max(0, free - gravityPending);
}

/**
 * After a successful non-terminal action: spend one action from the turn
 * budget, or hand off to the opponent and reset the budget.
 */
function withTurnAdvanced(
	state: GameState,
	config: GameConfig
): Pick<GameState, "currentPlayer" | "actionsRemaining"> {
	const budget = resolveActionsPerTurn(config);
	if (budget <= 1) {
		return {
			currentPlayer: state.currentPlayer === "X" ? "O" : "X",
			actionsRemaining: undefined
		};
	}
	const remaining = state.actionsRemaining ?? budget;
	if (remaining > 1) {
		return {
			currentPlayer: state.currentPlayer,
			actionsRemaining: remaining - 1
		};
	}
	return {
		currentPlayer: state.currentPlayer === "X" ? "O" : "X",
		actionsRemaining: budget
	};
}

/**
 * In-turn phases advance the phase index; after the last phase, hand off and
 * reset. Without turnPhases, delegates to multi-step / alternating handoff.
 */
function withPhaseOrTurnAdvanced(
	state: GameState,
	config: GameConfig
): Pick<GameState, "currentPlayer" | "actionsRemaining" | "turnPhaseIndex"> {
	const phases = config.turnPhases;
	if (phases && phases.length > 1) {
		const idx = state.turnPhaseIndex ?? 0;
		if (idx + 1 < phases.length) {
			return {
				currentPlayer: state.currentPlayer,
				actionsRemaining: undefined,
				turnPhaseIndex: idx + 1
			};
		}
		return {
			currentPlayer: state.currentPlayer === "X" ? "O" : "X",
			actionsRemaining: undefined,
			turnPhaseIndex: 0
		};
	}
	const turn = withTurnAdvanced(state, config);
	return { ...turn, turnPhaseIndex: undefined };
}

function isBoardFull(grid: Grid, config: GameConfig): boolean {
	const topology = config.topology ?? "rectangle";
	if (topology === "graph" && config.graph) {
		return config.graph.active.every((pos) => readCell(grid, pos) !== null);
	}
	return grid.cells.every((c) => c !== null);
}

// Create initial game state from config
export function createInitialState(config: GameConfig): GameState {
	const placement = usesPlacementPhase(config.fleet);
	const actionsPerTurn = resolveActionsPerTurn(config);
	const alternatingMultiStep =
		actionsPerTurn > 1 &&
		(config.turnSchedule ?? "alternating") === "alternating";
	const inTurnPhases = (config.turnPhases?.length ?? 0) > 0;
	const base: GameState = {
		grid: emptyGrid(config.gridWidth, config.gridHeight),
		currentPlayer: "X",
		status: "playing",
		winner: null,
		moveCount: 0,
		consecutivePasses: 0,
		koPoint: null,
		phase: placement ? "placement" : "combat",
		fleetProgress: placement ? initialFleetProgressMap() : undefined,
		actionsRemaining: alternatingMultiStep ? actionsPerTurn : undefined,
		turnPhaseIndex: inTurnPhases ? 0 : undefined
	};

	const seeds = config.initial ?? [];
	const hasOwner = seeds.some((p) => (p.visibility ?? "public") === "owner");
	if (hasOwner || config.observationMode === "hit_miss" || placement) {
		base.hidden = emptyGrid(config.gridWidth, config.gridHeight);
	}

	const deductionMode =
		config.observationMode === "deduction" ||
		config.inputMode === "deduction";
	if (deductionMode && config.deduction) {
		const rosterIds = config.deduction.roster.map((c) => c.id);
		base.deduction = {
			secret: assignSecrets(rosterIds, config.seed ?? 0),
			eliminated: { X: [], O: [] }
		};
	}

	if (seeds.length === 0) {
		const koRule = resolveKoRule(config);
		if (usesSuperkoHistory(koRule)) {
			base.positionHistory = [
				koRule === "situational"
					? situationHash(base.grid, base.currentPlayer)
					: boardPositionHash(base.grid)
			];
		}
		return base;
	}

	let publicCells = base.grid.cells;
	let hiddenCells = base.hidden?.cells;

	for (const p of seeds) {
		if (
			p.row < 0 ||
			p.row >= base.grid.height ||
			p.col < 0 ||
			p.col >= base.grid.width
		) {
			continue;
		}
		const visibility = p.visibility ?? "public";
		if (visibility === "owner") {
			if (!hiddenCells) {
				base.hidden = emptyGrid(config.gridWidth, config.gridHeight);
				hiddenCells = base.hidden.cells;
			}
			hiddenCells = setCell(
				{ ...base.grid, cells: hiddenCells },
				{ row: p.row, col: p.col },
				p.player
			);
		} else {
			publicCells = setCell(
				{ ...base.grid, cells: publicCells },
				{ row: p.row, col: p.col },
				p.player
			);
		}
	}

	base.grid = { ...base.grid, cells: publicCells };
	if (base.hidden && hiddenCells) {
		base.hidden = { ...base.hidden, cells: hiddenCells };
	}
	{
		const koRule = resolveKoRule(config);
		if (usesSuperkoHistory(koRule)) {
			base.positionHistory = [
				koRule === "situational"
					? situationHash(base.grid, base.currentPlayer)
					: boardPositionHash(base.grid)
			];
		}
	}
	return base;
}

// Pure reducer
export function reduce(
	state: GameState,
	event: GameEvent,
	config: GameConfig
): GameState {
	switch (event.type) {
		case "place":
			return handlePlace(state, event.position, config);
		case "move":
			return handleMove(state, event.from, event.to, config);
		case "fire":
			return handleFire(state, event.position, config);
		case "activateColumn":
			return handleActivateColumn(state, event.col, config);
		case "activateRow":
			return handleActivateRow(state, event.row, config);
		case "popOutColumn":
			return handlePopOutColumn(state, event.col, config);
		case "popOutRow":
			return handlePopOutRow(state, event.row, config);
		case "tick":
			return handleTick(state, config);
		case "pass":
			return handlePass(state, config);
		case "simultaneousPlace":
			return handleSimultaneousPlace(state, event.placements, config);
		case "simultaneousMove":
			return handleSimultaneousMove(state, event.moves, config);
		case "simultaneousQuery":
			return handleSimultaneousQuery(state, event.queries, config);
		case "simultaneousGuess":
			return handleSimultaneousGuess(state, event.guesses, config);
		case "simultaneousEliminate":
			return handleSimultaneousEliminate(state, event.eliminations, config);
		case "commitPlace":
			return handleCommitPlace(state, event.player, event.position, config);
		case "commitMove":
			return handleCommitMove(
				state,
				event.player,
				event.from,
				event.to,
				config
			);
		case "commitQuery":
			return handleCommitQuery(state, event.player, event.query, config);
		case "commitGuess":
			return handleCommitGuess(state, event.player, event.id, config);
		case "commitEliminate":
			return handleCommitEliminate(state, event.player, event.id, config);
		case "query":
			return handleQuery(state, event, config);
		case "guess":
			return handleGuess(state, event.id, config);
		case "eliminate":
			return handleEliminate(state, event.id, config);
		case "reset":
			return createInitialState(config);
		default:
			return state;
	}
}

function isDeductionMode(config: GameConfig): boolean {
	return (
		(config.inputMode === "deduction" ||
			config.observationMode === "deduction") &&
		config.deduction != null
	);
}

function handleQuery(
	state: GameState,
	event: QueryEvent,
	config: GameConfig
): GameState {
	if (!isDeductionMode(config) || !config.deduction || !state.deduction) {
		return state;
	}
	if (state.status !== "playing") return state;
	// Simultaneous games must use simultaneousQuery (joint resolve)
	if ((config.turnSchedule ?? "alternating") === "simultaneous") return state;

	const shape = config.deduction.queryShape ?? "single";
	const player = state.currentPlayer;
	const opponent: Player = player === "X" ? "O" : "X";
	const secretId = state.deduction.secret[opponent];
	const autoEliminate = config.deduction.autoEliminate !== false;

	let answer: boolean;
	let lastQuery: NonNullable<GameState["deduction"]>["lastQuery"];
	let eliminated: string[];

	if (shape === "and" || shape === "or") {
		const clauses = event.clauses;
		const arity = config.deduction.compoundArity ?? 2;
		if (
			!clauses ||
			!validCompoundClauses(clauses, config.deduction.traits, arity)
		) {
			return state;
		}
		// Reject single-atom fields on compound configs
		if (event.trait !== undefined || event.value !== undefined) return state;

		const op = shape;
		answer =
			op === "and"
				? answerQueryConjunction(
						secretId,
						config.deduction.roster,
						clauses
					)
				: answerQueryDisjunction(
						secretId,
						config.deduction.roster,
						clauses
					);
		eliminated = autoEliminate
			? op === "and"
				? eliminateAfterQueryConjunction(
						config.deduction.roster,
						state.deduction.eliminated[player],
						clauses,
						answer
					)
				: eliminateAfterQueryDisjunction(
						config.deduction.roster,
						state.deduction.eliminated[player],
						clauses,
						answer
					)
			: state.deduction.eliminated[player];
		lastQuery = {
			by: player,
			op,
			clauses: clauses.map((c) => ({ trait: c.trait, value: c.value })),
			answer
		};
	} else {
		// single
		if (event.clauses && event.clauses.length > 0) return state;
		const trait = event.trait;
		const value = event.value;
		if (trait === undefined || value === undefined) return state;
		if (!config.deduction.traits.includes(trait)) return state;

		answer = answerQuery(
			secretId,
			config.deduction.roster,
			trait,
			value
		);
		eliminated = autoEliminate
			? eliminateAfterQuery(
					config.deduction.roster,
					state.deduction.eliminated[player],
					trait,
					value,
					answer
				)
			: state.deduction.eliminated[player];
		lastQuery = { by: player, trait, value, answer };
	}

	const newMoveCount = state.moveCount + 1;
	const turn = withPhaseOrTurnAdvanced(state, config);
	return {
		...state,
		moveCount: newMoveCount,
		deduction: {
			...state.deduction,
			eliminated: {
				...state.deduction.eliminated,
				[player]: eliminated
			},
			lastQuery
		},
		currentPlayer: turn.currentPlayer,
		actionsRemaining: turn.actionsRemaining,
		turnPhaseIndex: turn.turnPhaseIndex
	};
}

/**
 * Resolve one seat's query (single-atom or compound) against the opponent secret.
 * Does not advance turn / moveCount (caller owns joint bookkeeping).
 */
function resolveQueryForPlayer(
	state: GameState,
	player: Player,
	event: QueryEvent,
	config: GameConfig
): {
	ok: boolean;
	eliminated: string[];
	lastQuery: NonNullable<GameState["deduction"]>["lastQuery"];
} | null {
	if (!config.deduction || !state.deduction) return null;
	const shape = config.deduction.queryShape ?? "single";
	const opponent: Player = player === "X" ? "O" : "X";
	const secretId = state.deduction.secret[opponent];
	const autoEliminate = config.deduction.autoEliminate !== false;

	if (shape === "and" || shape === "or") {
		const clauses = event.clauses;
		const arity = config.deduction.compoundArity ?? 2;
		if (
			!clauses ||
			!validCompoundClauses(clauses, config.deduction.traits, arity)
		) {
			return null;
		}
		if (event.trait !== undefined || event.value !== undefined) return null;

		const answer =
			shape === "and"
				? answerQueryConjunction(
						secretId,
						config.deduction.roster,
						clauses
					)
				: answerQueryDisjunction(
						secretId,
						config.deduction.roster,
						clauses
					);
		const eliminated = autoEliminate
			? shape === "and"
				? eliminateAfterQueryConjunction(
						config.deduction.roster,
						state.deduction.eliminated[player],
						clauses,
						answer
					)
				: eliminateAfterQueryDisjunction(
						config.deduction.roster,
						state.deduction.eliminated[player],
						clauses,
						answer
					)
			: state.deduction.eliminated[player];
		return {
			ok: true,
			eliminated,
			lastQuery: {
				by: player,
				op: shape,
				clauses: clauses.map((c) => ({ trait: c.trait, value: c.value })),
				answer
			}
		};
	}

	if (event.clauses && event.clauses.length > 0) return null;
	const trait = event.trait;
	const value = event.value;
	if (trait === undefined || value === undefined) return null;
	if (!config.deduction.traits.includes(trait)) return null;

	const answer = answerQuery(
		secretId,
		config.deduction.roster,
		trait,
		value
	);
	const eliminated = autoEliminate
		? eliminateAfterQuery(
				config.deduction.roster,
				state.deduction.eliminated[player],
				trait,
				value,
				answer
			)
		: state.deduction.eliminated[player];
	return {
		ok: true,
		eliminated,
		lastQuery: { by: player, trait, value, answer }
	};
}

/** Joint simultaneous query: both seats ask; independent auto-prune. */
function handleSimultaneousQuery(
	state: GameState,
	queries: { X: QueryEvent; O: QueryEvent },
	config: GameConfig
): GameState {
	if ((config.turnSchedule ?? "alternating") !== "simultaneous") return state;
	if (!isDeductionMode(config) || !config.deduction || !state.deduction) {
		return state;
	}
	if (state.status !== "playing") return state;
	const shape = config.deduction.queryShape ?? "single";
	if (shape !== "single" && shape !== "and" && shape !== "or") return state;

	const x = resolveQueryForPlayer(state, "X", queries.X, config);
	const o = resolveQueryForPlayer(state, "O", queries.O, config);
	if (!x || !o) return state;

	return {
		...state,
		moveCount: state.moveCount + 1,
		deduction: {
			...state.deduction,
			eliminated: {
				X: x.eliminated,
				O: o.eliminated
			},
			lastQuery: undefined,
			lastQueries: {
				X: x.lastQuery,
				O: o.lastQuery
			}
		}
	};
}

/** Joint simultaneous guess: both identify; one correct → win; both → draw. */
function handleSimultaneousGuess(
	state: GameState,
	guesses: { X: string; O: string },
	config: GameConfig
): GameState {
	if ((config.turnSchedule ?? "alternating") !== "simultaneous") return state;
	if (!isDeductionMode(config) || !config.deduction || !state.deduction) {
		return state;
	}
	if (state.status !== "playing") return state;

	const rosterIds = new Set(config.deduction.roster.map((c) => c.id));
	if (!rosterIds.has(guesses.X) || !rosterIds.has(guesses.O)) return state;

	const xCorrect = isGuessCorrect(state.deduction.secret.O, guesses.X);
	const oCorrect = isGuessCorrect(state.deduction.secret.X, guesses.O);
	const newMoveCount = state.moveCount + 1;

	if (xCorrect && oCorrect) {
		return {
			...state,
			moveCount: newMoveCount,
			status: "draw",
			winner: null
		};
	}
	if (xCorrect) {
		return {
			...state,
			moveCount: newMoveCount,
			status: "won",
			winner: "X"
		};
	}
	if (oCorrect) {
		return {
			...state,
			moveCount: newMoveCount,
			status: "won",
			winner: "O"
		};
	}

	// Both wrong: continue (wrongGuess lose would mutual-eliminate both seats).
	return {
		...state,
		moveCount: newMoveCount
	};
}

/** Joint simultaneous eliminate: both seats prune one candidate (manual mode). */
function handleSimultaneousEliminate(
	state: GameState,
	eliminations: { X: string; O: string },
	config: GameConfig
): GameState {
	if ((config.turnSchedule ?? "alternating") !== "simultaneous") return state;
	if (!isDeductionMode(config) || !config.deduction || !state.deduction) {
		return state;
	}
	if (state.status !== "playing") return state;
	if (config.deduction.autoEliminate !== false) return state;

	const xAlready = state.deduction.eliminated.X;
	const oAlready = state.deduction.eliminated.O;
	if (!canEliminate(config.deduction.roster, xAlready, eliminations.X)) {
		return state;
	}
	if (!canEliminate(config.deduction.roster, oAlready, eliminations.O)) {
		return state;
	}

	return {
		...state,
		moveCount: state.moveCount + 1,
		deduction: {
			...state.deduction,
			eliminated: {
				X: [...xAlready, eliminations.X],
				O: [...oAlready, eliminations.O]
			}
		}
	};
}

function handleGuess(
	state: GameState,
	id: string,
	config: GameConfig
): GameState {
	if (!isDeductionMode(config) || !config.deduction || !state.deduction) {
		return state;
	}
	if (state.status !== "playing") return state;
	// Simultaneous games must use simultaneousGuess (joint resolve)
	if ((config.turnSchedule ?? "alternating") === "simultaneous") return state;
	const rosterIds = new Set(config.deduction.roster.map((c) => c.id));
	if (!rosterIds.has(id)) return state;

	const player = state.currentPlayer;
	const opponent: Player = player === "X" ? "O" : "X";
	const secretId = state.deduction.secret[opponent];
	const correct = isGuessCorrect(secretId, id);
	const newMoveCount = state.moveCount + 1;

	if (correct) {
		return {
			...state,
			moveCount: newMoveCount,
			status: "won",
			winner: player
		};
	}

	if (config.deduction.wrongGuess === "lose") {
		return {
			...state,
			moveCount: newMoveCount,
			status: "won",
			winner: opponent
		};
	}

	// end_turn: handoff without win
	const turn = withPhaseOrTurnAdvanced(state, config);
	return {
		...state,
		moveCount: newMoveCount,
		currentPlayer: turn.currentPlayer,
		actionsRemaining: turn.actionsRemaining,
		turnPhaseIndex: turn.turnPhaseIndex
	};
}

function handleEliminate(
	state: GameState,
	id: string,
	config: GameConfig
): GameState {
	if (!isDeductionMode(config) || !config.deduction || !state.deduction) {
		return state;
	}
	if (state.status !== "playing") return state;
	// Manual eliminate only when auto-prune is off (Commit(hypothesis) seam).
	if (config.deduction.autoEliminate !== false) return state;
	if ((config.turnSchedule ?? "alternating") === "simultaneous") return state;

	const player = state.currentPlayer;
	const already = state.deduction.eliminated[player];
	if (!canEliminate(config.deduction.roster, already, id)) return state;

	const newMoveCount = state.moveCount + 1;
	const turn = withPhaseOrTurnAdvanced(state, config);
	return {
		...state,
		moveCount: newMoveCount,
		deduction: {
			...state.deduction,
			eliminated: {
				...state.deduction.eliminated,
				[player]: [...already, id]
			}
		},
		currentPlayer: turn.currentPlayer,
		actionsRemaining: turn.actionsRemaining,
		turnPhaseIndex: turn.turnPhaseIndex
	};
}

function handlePass(state: GameState, config: GameConfig): GameState {
	if ((config.objectiveMode ?? "n_in_a_row") !== "area_control") return state;
	if (state.status !== "playing") return state;

	const passes = (state.consecutivePasses ?? 0) + 1;
	const newMoveCount = state.moveCount + 1;

	if (passes >= 2) {
		const { status, winner } = areaOutcome(
			state.grid,
			config.gridWrap === true
		);
		return {
			...state,
			status,
			winner,
			moveCount: newMoveCount,
			consecutivePasses: passes
		};
	}

	const nextPlayer: Player = state.currentPlayer === "X" ? "O" : "X";
	return {
		...state,
		currentPlayer: nextPlayer,
		moveCount: newMoveCount,
		consecutivePasses: passes
	};
}

function handleTick(state: GameState, config: GameConfig): GameState {
	if ((config.turnSchedule ?? "alternating") !== "manual_tick") return state;
	if (state.status !== "playing") return state;
	const scheduler = config.scheduler;
	if (!scheduler) return state;

	const newGrid = applyLifeStep(
		state.grid,
		scheduler.rules,
		config.gridWrap === true
	);
	return {
		...state,
		grid: newGrid,
		moveCount: state.moveCount + 1
		// Tick is a neutral global step — do not flip currentPlayer
	};
}

/**
 * Apply one simultaneous sub-step pair onto `grid` (joint or ordered).
 * Returns the updated grid and whether a same-cell joint conflict occurred
 * (board unchanged for that pair under joint).
 */
function applySimultaneousPair(
	grid: Grid,
	pair: { X: Position; O: Position },
	resolveOrder: "joint" | "x_first" | "o_first"
): { grid: Grid; conflict: boolean } {
	const conflict = positionsEqual(pair.X, pair.O);

	if (resolveOrder === "joint") {
		if (conflict) return { grid, conflict: true };
		const xFree = getCell(grid, pair.X) === null;
		const oFree = getCell(grid, pair.O) === null;
		// Cross-index: a later pair may find a seat's cell already filled.
		// Place only seats whose target is still empty (natural sequential apply).
		let cells = grid.cells;
		let next: Grid = grid;
		if (xFree) {
			cells = setCell(next, pair.X, "X");
			next = { ...grid, cells };
		}
		if (oFree && getCell(next, pair.O) === null) {
			cells = setCell(next, pair.O, "O");
			next = { ...grid, cells };
		}
		return { grid: next, conflict: false };
	}

	const first: Player = resolveOrder === "x_first" ? "X" : "O";
	const second: Player = first === "X" ? "O" : "X";
	let next = grid;
	if (getCell(next, pair[first]) === null) {
		const cells = setCell(next, pair[first], first);
		next = { ...grid, cells };
	}
	if (getCell(next, pair[second]) === null) {
		const cells = setCell(next, pair[second], second);
		next = { ...grid, cells };
	}
	return { grid: next, conflict };
}

/**
 * Simultaneous schedule: both players submit place(s); resolve in one step.
 * Scalar placements = classic 1-per-seat round. Arrays = multi-action rounds
 * (`actionsPerTurn` > 1): apply indexed pairs as sequential sub-steps with
 * win checks after each. Joint same-cell → neither; ordered → earlier seat wins.
 * If both complete a winning line in the same sub-step → draw.
 */
function handleSimultaneousPlace(
	state: GameState,
	placements: {
		X: Position | Position[];
		O: Position | Position[];
	},
	config: GameConfig
): GameState {
	if ((config.turnSchedule ?? "alternating") !== "simultaneous") return state;
	if (state.status !== "playing") return state;
	if ((config.inputMode ?? "cell") === "move") return state;
	if ((config.observationMode ?? "full") === "hit_miss") return state;

	const topology = config.topology ?? "rectangle";
	const wrap = config.gridWrap === true;
	const resolveOrder = config.resolveOrder ?? "joint";
	const budget = resolveActionsPerTurn(config);
	const xs = asPlacementList(placements.X);
	const os = asPlacementList(placements.O);

	if (xs.length !== budget || os.length !== budget) return state;

	const validPos = (pos: Position): boolean => {
		if (
			pos.row < 0 ||
			pos.row >= state.grid.height ||
			pos.col < 0 ||
			pos.col >= state.grid.width
		) {
			return false;
		}
		if (!isActivePosition(pos, topology, config.graph)) return false;
		if (getCell(state.grid, pos) !== null) return false;
		return true;
	};

	// Within-seat duplicates are illegal for the whole joint action.
	for (let i = 0; i < xs.length; i++) {
		for (let j = i + 1; j < xs.length; j++) {
			if (positionsEqual(xs[i]!, xs[j]!)) return state;
		}
	}
	for (let i = 0; i < os.length; i++) {
		for (let j = i + 1; j < os.length; j++) {
			if (positionsEqual(os[i]!, os[j]!)) return state;
		}
	}

	// All choices validated against the pre-round board (simultaneous intent).
	for (const pos of xs) {
		if (!validPos(pos)) return state;
	}
	for (const pos of os) {
		if (!validPos(pos)) return state;
	}

	let workingGrid = state.grid;
	const clearedCommits = { committedPlacements: undefined as undefined };

	for (let i = 0; i < budget; i++) {
		const pair = { X: xs[i]!, O: os[i]! };
		const applied = applySimultaneousPair(workingGrid, pair, resolveOrder);
		workingGrid = applied.grid;

		const shouldCheckWin = resolveOrder !== "joint" || !applied.conflict;
		if (shouldCheckWin) {
			const xWins = Boolean(
				checkWinner(
					workingGrid,
					"X",
					config.winLength,
					config.adjacency,
					topology,
					config.graph,
					wrap
				)
			);
			const oWins = Boolean(
				checkWinner(
					workingGrid,
					"O",
					config.winLength,
					config.adjacency,
					topology,
					config.graph,
					wrap
				)
			);
			if (xWins && oWins) {
				return {
					...state,
					...clearedCommits,
					grid: workingGrid,
					status: "draw",
					winner: null,
					moveCount: state.moveCount + 1
				};
			}
			if (xWins) {
				return {
					...state,
					...clearedCommits,
					grid: workingGrid,
					status: "won",
					winner: "X",
					moveCount: state.moveCount + 1
				};
			}
			if (oWins) {
				return {
					...state,
					...clearedCommits,
					grid: workingGrid,
					status: "won",
					winner: "O",
					moveCount: state.moveCount + 1
				};
			}
		}

		if (isBoardFull(workingGrid, config)) {
			return {
				...state,
				...clearedCommits,
				grid: workingGrid,
				status: "draw",
				winner: null,
				moveCount: state.moveCount + 1
			};
		}
	}

	return {
		...state,
		...clearedCommits,
		grid: workingGrid,
		moveCount: state.moveCount + 1
		// Simultaneous rounds do not flip currentPlayer
	};
}

export type SimultaneousMovePair = MovePair;

/**
 * Apply one simultaneous move pair onto `grid` (joint or ordered).
 * Same destination under joint → neither moves. Ordered applies first seat
 * then second against the updated board (second may become illegal).
 * Joint replace: after vacating both chosen origins, landing overwrites any
 * remaining occupant (stationary enemy capture); a fleeing opponent whose
 * origin is the landing cell leaves an empty square.
 * Ordered replace: enemy destinations may be overwritten; same-dest still
 * gives the cell to the first seat (second does not capture the fresh lander).
 * Priority capture of a fleeing piece leaves second unable to apply.
 */
function applySimultaneousMovePair(
	grid: Grid,
	moves: { X: SimultaneousMovePair; O: SimultaneousMovePair },
	resolveOrder: "joint" | "x_first" | "o_first",
	capture: "none" | "replace" | "jump" = "none"
): { grid: Grid; conflict: boolean; applied: { X: boolean; O: boolean } } {
	const sameDest = positionsEqual(moves.X.to, moves.O.to);

	if (resolveOrder === "joint") {
		if (sameDest) {
			return { grid, conflict: true, applied: { X: false, O: false } };
		}
		// Atomic: clear both origins, then land both destinations (overwrite OK).
		let cells = setCell(grid, moves.X.from, null);
		cells = setCell({ ...grid, cells }, moves.O.from, null);
		cells = setCell({ ...grid, cells }, moves.X.to, "X");
		cells = setCell({ ...grid, cells }, moves.O.to, "O");
		return {
			grid: { ...grid, cells },
			conflict: false,
			applied: { X: true, O: true }
		};
	}

	const first: Player = resolveOrder === "x_first" ? "X" : "O";
	const second: Player = first === "X" ? "O" : "X";
	let next = grid;
	const applied = { X: false, O: false };

	const tryApply = (seat: Player) => {
		const m = moves[seat];
		if (getCell(next, m.from) !== seat) return;
		const dest = getCell(next, m.to);
		if (dest !== null) {
			if (capture !== "replace") return;
			if (dest === seat) return;
			// Same-dest: first already claimed the cell — second does not capture.
			if (sameDest && applied[first]) return;
		}
		let cells = setCell(next, m.from, null);
		cells = setCell({ ...next, cells }, m.to, seat);
		next = { ...next, cells };
		applied[seat] = true;
	};

	tryApply(first);
	tryApply(second);
	return { grid: next, conflict: sameDest, applied };
}

/**
 * Simultaneous schedule + move input: both seats submit one {from,to} (scalar)
 * or N moves each (`actionsPerTurn` > 1). Arrays apply indexed pairs as
 * sequential sub-steps with win checks after each — unlike place, each index
 * is revalidated on the post-prior-step board so same-piece chains work.
 * Joint resolve validates on a vacated-origin board (sliding path integrity,
 * including joint + replace: fleeing blockers clear the ray; stationary
 * capture targets remain). Ordered resolve validates first seat pre-round,
 * then second after simulating the first (sequential path / capture
 * revalidation). Same destination under joint → neither; ordered → first seat
 * wins the cell when both claim it. Ordered replace may overwrite enemies;
 * priority can capture before prey flees.
 * After each sub-step, reach_row (or n_in_a_row) win checks; mutual → draw.
 */
function handleSimultaneousMove(
	state: GameState,
	moves: {
		X: SimultaneousMovePair | SimultaneousMovePair[];
		O: SimultaneousMovePair | SimultaneousMovePair[];
	},
	config: GameConfig
): GameState {
	if ((config.turnSchedule ?? "alternating") !== "simultaneous") return state;
	if (state.status !== "playing") return state;
	if ((config.inputMode ?? "cell") !== "move") return state;
	const movement = config.movement;
	if (!movement) return state;

	const board = movementBoardFrom(config);
	const wrap = board.wrap === true;
	const resolveOrder = config.resolveOrder ?? "joint";
	const budget = resolveActionsPerTurn(config);
	const xs = asMoveList(moves.X);
	const os = asMoveList(moves.O);

	if (xs.length !== budget || os.length !== budget) return state;

	// Within-seat duplicate {from,to} pairs are illegal for the whole joint.
	for (let i = 0; i < xs.length; i++) {
		for (let j = i + 1; j < xs.length; j++) {
			if (movesEqual(xs[i]!, xs[j]!)) return state;
		}
	}
	for (let i = 0; i < os.length; i++) {
		for (let j = i + 1; j < os.length; j++) {
			if (movesEqual(os[i]!, os[j]!)) return state;
		}
	}

	let workingGrid = state.grid;
	const clearedCommits = { committedMoves: undefined as undefined };

	for (let i = 0; i < budget; i++) {
		const pair = { X: xs[i]!, O: os[i]! };
		const legal =
			resolveOrder === "joint"
				? canJointSimultaneousMoves(workingGrid, pair, movement, board)
				: canOrderedSimultaneousMoves(
						workingGrid,
						pair,
						movement,
						resolveOrder,
						board
					);
		if (!legal) {
			return state;
		}

		const applied = applySimultaneousMovePair(
			workingGrid,
			pair,
			resolveOrder,
			movement.capture ?? "none"
		);
		workingGrid = applied.grid;

		const nextBase: GameState = {
			...state,
			...clearedCommits,
			grid: workingGrid,
			moveCount: state.moveCount + 1
		};

		const shouldCheckWin = resolveOrder !== "joint" || !applied.conflict;
		if (!shouldCheckWin) {
			if (i === budget - 1) return nextBase;
			continue;
		}

		if ((config.objectiveMode ?? "n_in_a_row") === "reach_row") {
			const xTarget = config.targetRows?.X;
			const oTarget = config.targetRows?.O;
			const xWins =
				applied.applied.X &&
				xTarget != null &&
				pair.X.to.row === xTarget &&
				getCell(workingGrid, pair.X.to) === "X";
			const oWins =
				applied.applied.O &&
				oTarget != null &&
				pair.O.to.row === oTarget &&
				getCell(workingGrid, pair.O.to) === "O";
			if (xWins && oWins) {
				return { ...nextBase, status: "draw", winner: null };
			}
			if (xWins) {
				return { ...nextBase, status: "won", winner: "X" };
			}
			if (oWins) {
				return { ...nextBase, status: "won", winner: "O" };
			}
			if (i === budget - 1) return nextBase;
			continue;
		}

		if ((config.objectiveMode ?? "n_in_a_row") === "n_in_a_row") {
			const topology = config.topology ?? "rectangle";
			const xWins = Boolean(
				checkWinner(
					workingGrid,
					"X",
					config.winLength,
					config.adjacency,
					topology,
					config.graph,
					wrap
				)
			);
			const oWins = Boolean(
				checkWinner(
					workingGrid,
					"O",
					config.winLength,
					config.adjacency,
					topology,
					config.graph,
					wrap
				)
			);
			if (xWins && oWins) {
				return { ...nextBase, status: "draw", winner: null };
			}
			if (xWins) {
				return { ...nextBase, status: "won", winner: "X" };
			}
			if (oWins) {
				return { ...nextBase, status: "won", winner: "O" };
			}
		}

		if (i === budget - 1) return nextBase;
	}

	return {
		...state,
		...clearedCommits,
		grid: workingGrid,
		moveCount: state.moveCount + 1
	};
}

/**
 * Hidden simultaneous: record a private commit. When both seats have committed
 * their full per-round budget (`actionsPerTurn`), resolve via
 * handleSimultaneousPlace (joint or ordered resolveOrder).
 */
function handleCommitPlace(
	state: GameState,
	player: Player,
	position: Position,
	config: GameConfig
): GameState {
	if ((config.turnSchedule ?? "alternating") !== "simultaneous") return state;
	if (!config.commitReveal) return state;
	if (state.status !== "playing") return state;
	if ((config.inputMode ?? "cell") === "move") return state;

	const topology = config.topology ?? "rectangle";
	const budget = resolveActionsPerTurn(config);
	if (
		position.row < 0 ||
		position.row >= state.grid.height ||
		position.col < 0 ||
		position.col >= state.grid.width
	) {
		return state;
	}
	if (!isActivePosition(position, topology, config.graph)) return state;
	if (getCell(state.grid, position) !== null) return state;

	const prior = state.committedPlacements ?? {};
	const own = prior[player] ?? [];
	if (own.length >= budget) return state; // budget already full
	if (listHasPosition(own, position)) return state; // duplicate within seat

	const nextOwn = [...own, position];
	const nextCommits: Partial<Record<Player, Position[]>> = {
		...prior,
		[player]: nextOwn
	};

	const xList = nextCommits.X ?? [];
	const oList = nextCommits.O ?? [];
	if (xList.length === budget && oList.length === budget) {
		return handleSimultaneousPlace(
			{ ...state, committedPlacements: nextCommits },
			{ X: xList, O: oList },
			config
		);
	}

	return {
		...state,
		committedPlacements: nextCommits
		// moveCount unchanged until reveal
	};
}

/**
 * Hidden simultaneous move: record a private {from,to} commit. When both seats
 * have committed their full per-round budget (`actionsPerTurn`), reveal via
 * handleSimultaneousMove (arrays for budget > 1; same-piece chains validated
 * on a solo probe of prior commits).
 */
function handleCommitMove(
	state: GameState,
	player: Player,
	from: Position,
	to: Position,
	config: GameConfig
): GameState {
	if ((config.turnSchedule ?? "alternating") !== "simultaneous") return state;
	if (!config.commitReveal) return state;
	if (state.status !== "playing") return state;
	if ((config.inputMode ?? "cell") !== "move") return state;
	const movement = config.movement;
	if (!movement) return state;

	const board = movementBoardFrom(config);
	const budget = resolveActionsPerTurn(config);
	const prior = state.committedMoves ?? {};
	const own = prior[player] ?? [];
	if (own.length >= budget) return state;
	const nextPair: MovePair = { from, to };
	if (listHasMove(own, nextPair)) return state;

	const probe = applySoloMoves(state.grid, player, own);
	if (!canMove(probe, from, to, player, movement, board)) return state;

	const nextOwn = [...own, nextPair];
	const nextCommits: Partial<Record<Player, MovePair[]>> = {
		...prior,
		[player]: nextOwn
	};

	const xList = nextCommits.X ?? [];
	const oList = nextCommits.O ?? [];
	if (xList.length === budget && oList.length === budget) {
		return handleSimultaneousMove(
			{ ...state, committedMoves: nextCommits },
			{ X: xList, O: oList },
			config
		);
	}

	return {
		...state,
		committedMoves: nextCommits
	};
}

/**
 * Hidden simultaneous deduction: record a private query commit. When both
 * seats have committed matching kinds, reveal via handleSimultaneousQuery.
 */
function handleCommitQuery(
	state: GameState,
	player: Player,
	query: QueryEvent,
	config: GameConfig
): GameState {
	if ((config.turnSchedule ?? "alternating") !== "simultaneous") return state;
	if (!config.commitReveal) return state;
	if (!isDeductionMode(config) || !config.deduction || !state.deduction) {
		return state;
	}
	if (state.status !== "playing") return state;

	const prior = state.committedDeduction ?? {};
	if (prior[player]) return state; // already committed this round

	const opponent: Player = player === "X" ? "O" : "X";
	const oppCommit = prior[opponent];
	if (oppCommit && oppCommit.kind !== "query") return state; // kind mismatch

	const nextCommits: Partial<Record<Player, NonNullable<GameState["committedDeduction"]>[Player]>> = {
		...prior,
		[player]: { kind: "query", query }
	};

	const x = nextCommits.X;
	const o = nextCommits.O;
	if (x?.kind === "query" && o?.kind === "query") {
		const revealed = handleSimultaneousQuery(
			{ ...state, committedDeduction: nextCommits },
			{ X: x.query, O: o.query },
			config
		);
		return { ...revealed, committedDeduction: undefined };
	}

	return {
		...state,
		committedDeduction: nextCommits
	};
}

/**
 * Hidden simultaneous deduction: record a private guess commit. When both
 * seats have committed matching kinds, reveal via handleSimultaneousGuess.
 */
function handleCommitGuess(
	state: GameState,
	player: Player,
	id: string,
	config: GameConfig
): GameState {
	if ((config.turnSchedule ?? "alternating") !== "simultaneous") return state;
	if (!config.commitReveal) return state;
	if (!isDeductionMode(config) || !config.deduction || !state.deduction) {
		return state;
	}
	if (state.status !== "playing") return state;

	const rosterIds = new Set(config.deduction.roster.map((c) => c.id));
	if (!rosterIds.has(id)) return state;

	const prior = state.committedDeduction ?? {};
	if (prior[player]) return state;

	const opponent: Player = player === "X" ? "O" : "X";
	const oppCommit = prior[opponent];
	if (oppCommit && oppCommit.kind !== "guess") return state;

	const eliminated = new Set(state.deduction.eliminated[player] ?? []);
	if (eliminated.has(id)) return state;

	const nextCommits: Partial<Record<Player, NonNullable<GameState["committedDeduction"]>[Player]>> = {
		...prior,
		[player]: { kind: "guess", id }
	};

	const x = nextCommits.X;
	const o = nextCommits.O;
	if (x?.kind === "guess" && o?.kind === "guess") {
		const revealed = handleSimultaneousGuess(
			{ ...state, committedDeduction: nextCommits },
			{ X: x.id, O: o.id },
			config
		);
		return { ...revealed, committedDeduction: undefined };
	}

	return {
		...state,
		committedDeduction: nextCommits
	};
}

/**
 * Hidden simultaneous deduction: record a private eliminate commit. When both
 * seats have committed matching kinds, reveal via handleSimultaneousEliminate.
 */
function handleCommitEliminate(
	state: GameState,
	player: Player,
	id: string,
	config: GameConfig
): GameState {
	if ((config.turnSchedule ?? "alternating") !== "simultaneous") return state;
	if (!config.commitReveal) return state;
	if (!isDeductionMode(config) || !config.deduction || !state.deduction) {
		return state;
	}
	if (state.status !== "playing") return state;
	if (config.deduction.autoEliminate !== false) return state;

	const rosterIds = new Set(config.deduction.roster.map((c) => c.id));
	if (!rosterIds.has(id)) return state;

	const prior = state.committedDeduction ?? {};
	if (prior[player]) return state;

	const opponent: Player = player === "X" ? "O" : "X";
	const oppCommit = prior[opponent];
	if (oppCommit && oppCommit.kind !== "eliminate") return state;

	const eliminated = new Set(state.deduction.eliminated[player] ?? []);
	if (eliminated.has(id)) return state;

	const nextCommits: Partial<
		Record<Player, NonNullable<GameState["committedDeduction"]>[Player]>
	> = {
		...prior,
		[player]: { kind: "eliminate", id }
	};

	const x = nextCommits.X;
	const o = nextCommits.O;
	if (x?.kind === "eliminate" && o?.kind === "eliminate") {
		const revealed = handleSimultaneousEliminate(
			{ ...state, committedDeduction: nextCommits },
			{ X: x.id, O: o.id },
			config
		);
		return { ...revealed, committedDeduction: undefined };
	}

	return {
		...state,
		committedDeduction: nextCommits
	};
}

function handleMove(
	state: GameState,
	from: Position,
	to: Position,
	config: GameConfig
): GameState {
	// Simultaneous games must use simultaneousMove (joint resolve)
	if ((config.turnSchedule ?? "alternating") === "simultaneous") return state;
	const phases = config.turnPhases;
	const phaseIdx = state.turnPhaseIndex ?? 0;
	const inTurnMovePhase = Boolean(phases && phases[phaseIdx] === "move");
	if ((config.inputMode ?? "cell") !== "move" && !inTurnMovePhase) return state;
	if (state.status !== "playing") return state;
	const movement = config.movement;
	if (!movement) return state;
	if (
		!canMove(
			state.grid,
			from,
			to,
			state.currentPlayer,
			movement,
			movementBoardFrom(config)
		)
	) {
		return state;
	}

	// Mid-chain: only jumps from mustContinueFrom are legal.
	const chainFrom = state.mustContinueFrom;
	if (chainFrom) {
		if (from.row !== chainFrom.row || from.col !== chainFrom.col) {
			return state;
		}
		if (
			!isJumpCapture(
				state.grid,
				from,
				to,
				state.currentPlayer,
				movement,
				movementBoardFrom(config)
			)
		) {
			return state;
		}
	}

	const board = movementBoardFrom(config);
	const jumping = isJumpCapture(
		state.grid,
		from,
		to,
		state.currentPlayer,
		movement,
		board
	);
	const mid = jumping ? jumpMid(from, to, movement) : null;

	let cells = setCell(state.grid, from, null);
	if (mid) {
		cells = setCell({ ...state.grid, cells }, mid, null);
	}
	cells = setCell({ ...state.grid, cells }, to, state.currentPlayer);
	const newGrid = { ...state.grid, cells };
	const newMoveCount = state.moveCount + 1;
	const next: GameState = {
		...state,
		grid: newGrid,
		moveCount: newMoveCount,
		mustContinueFrom: undefined
	};

	if ((config.objectiveMode ?? "n_in_a_row") === "reach_row") {
		const target = config.targetRows?.[state.currentPlayer];
		if (target != null && to.row === target) {
			return {
				...next,
				status: "won",
				winner: state.currentPlayer
			};
		}
	}

	if (checksConnectWin(config)) {
		const wrap = config.gridWrap === true;
		const winner = checkWinner(
			newGrid,
			state.currentPlayer,
			config.winLength,
			config.adjacency,
			config.topology ?? "rectangle",
			config.graph,
			wrap
		);
		if (winner) {
			return {
				...next,
				status: "won",
				winner: state.currentPlayer
			};
		}
		if (isBoardFull(newGrid, config)) {
			return {
				...next,
				status: "draw"
			};
		}
	}

	// Capture chain: further jumps from landing keep the same seat.
	if (
		jumping &&
		movement.capture === "jump" &&
		jumpDestinations(newGrid, to, movement, board, state.currentPlayer)
			.length > 0
	) {
		return {
			...next,
			mustContinueFrom: to,
			currentPlayer: state.currentPlayer,
			actionsRemaining: state.actionsRemaining,
			turnPhaseIndex: state.turnPhaseIndex
		};
	}

	const turn = withPhaseOrTurnAdvanced(state, config);
	return {
		...next,
		mustContinueFrom: undefined,
		currentPlayer: turn.currentPlayer,
		actionsRemaining: turn.actionsRemaining,
		turnPhaseIndex: turn.turnPhaseIndex
	};
}

function handleFire(
	state: GameState,
	pos: Position,
	config: GameConfig
): GameState {
	if ((config.observationMode ?? "full") !== "hit_miss") return state;
	if (state.status !== "playing") return state;
	// Placement phase: only place actions are legal
	if ((state.phase ?? "combat") === "placement") return state;
	// In-turn phases: only fire during the fire phase
	const phases = config.turnPhases;
	if (phases && phases.length > 0) {
		const phase = phases[state.turnPhaseIndex ?? 0];
		if (phase !== "fire") return state;
	}
	if (
		pos.row < 0 ||
		pos.row >= state.grid.height ||
		pos.col < 0 ||
		pos.col >= state.grid.width
	) {
		return state;
	}
	// Already shot / public spotter occupying cell
	if (getCell(state.grid, pos) !== null) return state;

	const occupant =
		state.hidden != null ? getCell(state.hidden, pos) : null;
	// Cannot fire on own fleet cell
	if (occupant === state.currentPlayer) return state;

	const result: CellValue =
		occupant === "X" || occupant === "O" ? "hit" : "miss";
	const newCells = setCell(state.grid, pos, result);
	const newGrid = { ...state.grid, cells: newCells };
	const newMoveCount = state.moveCount + 1;
	const next: GameState = {
		...state,
		grid: newGrid,
		moveCount: newMoveCount
	};

	if (checksDestroyWin(config)) {
		const opponent: Player = state.currentPlayer === "X" ? "O" : "X";
		if (fleetDestroyed(next, opponent)) {
			return {
				...next,
				status: "won",
				winner: state.currentPlayer
			};
		}
	}

	const turn = withPhaseOrTurnAdvanced(state, config);
	return {
		...next,
		currentPlayer: turn.currentPlayer,
		actionsRemaining: turn.actionsRemaining,
		turnPhaseIndex: turn.turnPhaseIndex
	};
}

function handleFleetPlace(
	state: GameState,
	pos: Position,
	config: GameConfig
): GameState {
	const fleet = config.fleet;
	if (!fleet || !usesPlacementPhase(fleet)) return state;
	if (!canPlaceFleetCell(state, pos, state.currentPlayer, fleet)) {
		return state;
	}
	if (!state.hidden || !state.fleetProgress) return state;

	const hiddenCells = setCell(state.hidden, pos, state.currentPlayer);
	const playerProgress = advanceFleetProgress(
		state.fleetProgress[state.currentPlayer],
		pos,
		fleet
	);
	const fleetProgress = {
		...state.fleetProgress,
		[state.currentPlayer]: playerProgress
	};
	const newMoveCount = state.moveCount + 1;

	if (bothFleetsPlaced(fleetProgress)) {
		return {
			...state,
			hidden: { ...state.hidden, cells: hiddenCells },
			fleetProgress,
			phase: "combat",
			currentPlayer: "X",
			moveCount: newMoveCount
		};
	}

	// Current player keeps placing until their fleet is done; then hand off.
	if (playerProgress.done) {
		const nextPlayer: Player = state.currentPlayer === "X" ? "O" : "X";
		return {
			...state,
			hidden: { ...state.hidden, cells: hiddenCells },
			fleetProgress,
			currentPlayer: nextPlayer,
			moveCount: newMoveCount
		};
	}

	return {
		...state,
		hidden: { ...state.hidden, cells: hiddenCells },
		fleetProgress,
		moveCount: newMoveCount
	};
}

function handlePlace(
	state: GameState,
	pos: Position,
	config: GameConfig
): GameState {
	// Simultaneous games must use simultaneousPlace (joint resolve)
	if ((config.turnSchedule ?? "alternating") === "simultaneous") return state;
	// Hit/miss with fleet: place onto hidden during placement phase.
	// Hit/miss with in-turn phases (place→fire): public spotters — fall through.
	if (
		(config.observationMode ?? "full") === "hit_miss" &&
		!(config.turnPhases && config.turnPhases.length > 0)
	) {
		return handleFleetPlace(state, pos, config);
	}
	// Move games relocate existing pieces
	if ((config.inputMode ?? "cell") === "move") return state;

	// In-turn phases: only place during the place phase
	const phases = config.turnPhases;
	if (phases && phases.length > 0) {
		const phase = phases[state.turnPhaseIndex ?? 0];
		if (phase !== "place") return state;
	}

	// Guard: can only place if game is playing
	if (state.status !== "playing") return state;

	// Guard: position must be in bounds
	if (
		pos.row < 0 ||
		pos.row >= state.grid.height ||
		pos.col < 0 ||
		pos.col >= state.grid.width
	) {
		return state;
	}

	// Guard: graph boards only place on declared nodes
	const topology = config.topology ?? "rectangle";
	if (!isActivePosition(pos, topology, config.graph)) {
		return state;
	}

	// Guard: cell must be empty
	if (getCell(state.grid, pos) !== null) return state;

	// Place→fire: do not stack public spotters on hidden fleet cells
	if (
		(config.observationMode ?? "full") === "hit_miss" &&
		state.hidden != null
	) {
		const under = getCell(state.hidden, pos);
		if (under === "X" || under === "O") return state;
	}

	const delayTurns = resolveDelayTurns(config);
	if (delayTurns > 0) {
		return handleDelayedPlace(state, pos, config, delayTurns);
	}

	const captureMode = config.captureMode ?? "flip";
	const libertyMode =
		Boolean(config.captureEnabled) && captureMode === "liberties";

	const wrap = config.gridWrap === true;
	const koRule = resolveKoRule(config);

	// Go-lite: empty + no suicide after opponent group capture (+ optional ko/superko)
	if (libertyMode) {
		if (
			!isLegalLibertyPlace(state.grid, pos, state.currentPlayer, wrap, {
				koRule,
				koPoint: state.koPoint,
				positionHistory: state.positionHistory
			})
		) {
			return state;
		}
	} else if (config.captureEnabled) {
		// Reversi: must flip at least one line
		const placedCells = setCell(state.grid, pos, state.currentPlayer);
		const after = applyCaptureIfAny(
			{ ...state.grid, cells: placedCells },
			pos,
			state.currentPlayer,
			config.adjacency,
			wrap
		);
		if (after === placedCells) {
			return state;
		}
	}

	// Effect: place current player's mark
	let newCells = setCell(state.grid, pos, state.currentPlayer);
	let nextKoPoint: Position | null = null;
	let nextHistory = state.positionHistory;
	if (libertyMode) {
		const capture = applyLibertyCapture(
			{ ...state.grid, cells: newCells },
			pos,
			state.currentPlayer,
			wrap
		);
		newCells = capture.cells;
		nextKoPoint =
			koRule === "point" ? koPointFromCapture(capture.removed) : null;
	} else if (config.captureEnabled) {
		newCells = applyCaptureIfAny(
			{ ...state.grid, cells: newCells },
			pos,
			state.currentPlayer,
			config.adjacency,
			wrap
		);
	}
	const newMoveCount = state.moveCount + 1;
	const newGrid = { ...state.grid, cells: newCells };
	if (libertyMode && usesSuperkoHistory(koRule)) {
		const nextPlayer: Player = state.currentPlayer === "X" ? "O" : "X";
		nextHistory = [
			...(state.positionHistory ?? []),
			koRule === "situational"
				? situationHash(newGrid, nextPlayer)
				: boardPositionHash(newGrid)
		];
	}

	// Open-ended demos (Life Lite): place seeds without win/turn flip
	if ((config.objectiveMode ?? "n_in_a_row") === "none") {
		return {
			...state,
			grid: newGrid,
			moveCount: newMoveCount,
			koPoint: nextKoPoint,
			positionHistory: nextHistory
		};
	}

	// Area control (Go-lite): play continues until two passes; no mid-game n-in-a-row
	if ((config.objectiveMode ?? "n_in_a_row") === "area_control") {
		const nextPlayer: Player = state.currentPlayer === "X" ? "O" : "X";
		return {
			...state,
			grid: newGrid,
			currentPlayer: nextPlayer,
			moveCount: newMoveCount,
			consecutivePasses: 0,
			koPoint: nextKoPoint,
			positionHistory: nextHistory
		};
	}

	// Place→fire (destroy_hidden only): place advances phase; win on fire.
	// connect_or_destroy falls through to n-in-a-row checks after place.
	if ((config.objectiveMode ?? "n_in_a_row") === "destroy_hidden") {
		const turn = withPhaseOrTurnAdvanced(state, config);
		return {
			...state,
			grid: newGrid,
			currentPlayer: turn.currentPlayer,
			actionsRemaining: turn.actionsRemaining,
			turnPhaseIndex: turn.turnPhaseIndex,
			moveCount: newMoveCount,
			koPoint: nextKoPoint,
			positionHistory: nextHistory
		};
	}

	// Check win condition using config (n_in_a_row + connect_or_destroy)
	const winner = checkWinner(
		newGrid,
		state.currentPlayer,
		config.winLength,
		config.adjacency,
		config.topology ?? "rectangle",
		config.graph,
		wrap
	);
	if (winner) {
		return {
			...state,
			grid: newGrid,
			status: "won",
			winner: state.currentPlayer,
			moveCount: newMoveCount,
			koPoint: nextKoPoint,
			positionHistory: nextHistory
		};
	}

	// Check draw (all playable cells filled)
	const isFull = isBoardFull(newGrid, config);
	if (isFull) {
		return {
			...state,
			grid: newGrid,
			status: "draw",
			moveCount: newMoveCount,
			koPoint: nextKoPoint,
			positionHistory: nextHistory
		};
	}

	// Effect: advance turn (multi-step / in-turn phases keep currentPlayer)
	const turn = withPhaseOrTurnAdvanced(state, config);

	return {
		...state,
		grid: newGrid,
		currentPlayer: turn.currentPlayer,
		actionsRemaining: turn.actionsRemaining,
		turnPhaseIndex: turn.turnPhaseIndex,
		moveCount: newMoveCount,
		koPoint: nextKoPoint,
		positionHistory: nextHistory
	};
}

/**
 * Delayed place: queue an intent now; materialize after `delayTurns` more places.
 * Cell intents reserve that intersection. Column/row intents reserve a slot and
 * settle via gravity on the board at resolve time.
 */
type DelayedIntent =
	| { kind: "cell"; position: Position }
	| { kind: "column"; col: number }
	| { kind: "row"; row: number };

function handleDelayedIntent(
	state: GameState,
	intent: DelayedIntent,
	config: GameConfig,
	delayTurns: number
): GameState {
	const width = state.grid.width;
	const height = state.grid.height;
	const cells0 = state.grid.cells;

	if (intent.kind === "cell") {
		if (isPendingReserved(state.pendingPlaces, intent.position)) return state;
		if (getCell(state.grid, intent.position) !== null) return state;
	} else if (intent.kind === "column") {
		if (
			!columnHasPendingSpace(
				cells0,
				width,
				height,
				state.pendingPlaces,
				intent.col
			)
		) {
			return state;
		}
	} else if (
		!rowHasPendingSpace(cells0, width, state.pendingPlaces, intent.row)
	) {
		return state;
	}

	const wrap = config.gridWrap === true;
	const topology = config.topology ?? "rectangle";
	const direction = config.gravityDirection ?? "down";
	const newMoveCount = state.moveCount + 1;
	const queued: PendingPlace =
		intent.kind === "cell"
			? {
					player: state.currentPlayer,
					resolveAt: newMoveCount + delayTurns,
					kind: "cell",
					position: intent.position
				}
			: intent.kind === "column"
				? {
						player: state.currentPlayer,
						resolveAt: newMoveCount + delayTurns,
						kind: "column",
						col: intent.col
					}
				: {
						player: state.currentPlayer,
						resolveAt: newMoveCount + delayTurns,
						kind: "row",
						row: intent.row
					};
	let pending: PendingPlace[] = [...(state.pendingPlaces ?? []), queued];
	let cells = [...state.grid.cells];
	const resolvedOrder: Player[] = [];

	const materializeDue = (forceAll: boolean) => {
		const keep: PendingPlace[] = [];
		for (const p of pending) {
			if (forceAll || p.resolveAt <= newMoveCount) {
				if (p.kind === "cell") {
					const idx = toIndex(p.position, width);
					if (cells[idx] === null) {
						cells[idx] = p.player;
						resolvedOrder.push(p.player);
					}
				} else if (p.kind === "column") {
					const vert =
						direction === "up" || direction === "down" ? direction : "down";
					const targetRow = settleColumnRow(
						cells,
						width,
						height,
						p.col,
						vert
					);
					if (targetRow !== null) {
						cells[toIndex({ row: targetRow, col: p.col }, width)] = p.player;
						resolvedOrder.push(p.player);
					}
				} else {
					const horiz =
						direction === "left" || direction === "right"
							? direction
							: "right";
					const targetCol = settleRowCol(cells, width, p.row, horiz);
					if (targetCol !== null) {
						cells[toIndex({ row: p.row, col: targetCol }, width)] = p.player;
						resolvedOrder.push(p.player);
					}
				}
			} else {
				keep.push(p);
			}
		}
		pending = keep;
	};

	materializeDue(false);

	// Deadlock avoidance: if every cell is occupied or reserved, flush pending now
	if (
		countFreeCells(cells, pending, state.grid, config) === 0 &&
		pending.length > 0
	) {
		materializeDue(true);
	}

	const newGrid: Grid = { ...state.grid, cells };

	for (const player of resolvedOrder) {
		const won = checkWinner(
			newGrid,
			player,
			config.winLength,
			config.adjacency,
			topology,
			config.graph,
			wrap
		);
		if (won) {
			return {
				...state,
				grid: newGrid,
				pendingPlaces: pending.length > 0 ? pending : undefined,
				status: "won",
				winner: player,
				moveCount: newMoveCount
			};
		}
	}

	if (isBoardFull(newGrid, config) && pending.length === 0) {
		return {
			...state,
			grid: newGrid,
			pendingPlaces: undefined,
			status: "draw",
			moveCount: newMoveCount
		};
	}

	const turn = withTurnAdvanced(state, config);
	return {
		...state,
		grid: newGrid,
		pendingPlaces: pending.length > 0 ? pending : undefined,
		currentPlayer: turn.currentPlayer,
		actionsRemaining: turn.actionsRemaining,
		moveCount: newMoveCount
	};
}

function handleDelayedPlace(
	state: GameState,
	pos: Position,
	config: GameConfig,
	delayTurns: number
): GameState {
	return handleDelayedIntent(
		state,
		{ kind: "cell", position: { row: pos.row, col: pos.col } },
		config,
		delayTurns
	);
}

function handleActivateColumn(
	state: GameState,
	col: number,
	config: GameConfig
): GameState {
	if (state.status !== "playing") return state;
	const height = state.grid.height;
	const width = state.grid.width;
	if (col < 0 || col >= width) return state;

	const direction = config.gravityDirection ?? "down";
	if (direction !== "down" && direction !== "up") return state;

	const delayTurns = resolveDelayTurns(config);
	if (delayTurns > 0) {
		return handleDelayedIntent(
			state,
			{ kind: "column", col },
			config,
			delayTurns
		);
	}

	// Settle toward the gravity exit: down → first empty from bottom;
	// up → first empty from top.
	const targetRow = settleColumnRow(
		state.grid.cells,
		width,
		height,
		col,
		direction
	);
	if (targetRow === null) {
		// Column full
		return state;
	}

	return handlePlace(state, { row: targetRow, col }, config);
}

function handleActivateRow(
	state: GameState,
	row: number,
	config: GameConfig
): GameState {
	if (state.status !== "playing") return state;
	const height = state.grid.height;
	const width = state.grid.width;
	if (row < 0 || row >= height) return state;

	const direction = config.gravityDirection ?? "down";
	if (direction !== "left" && direction !== "right") return state;

	const delayTurns = resolveDelayTurns(config);
	if (delayTurns > 0) {
		return handleDelayedIntent(
			state,
			{ kind: "row", row },
			config,
			delayTurns
		);
	}

	// Settle toward the gravity exit: right → first empty from right;
	// left → first empty from left.
	const targetCol = settleRowCol(state.grid.cells, width, row, direction);
	if (targetCol === null) {
		// Row full
		return state;
	}

	return handlePlace(state, { row, col: targetCol }, config);
}

function handlePopOutColumn(
	state: GameState,
	col: number,
	config: GameConfig
): GameState {
	if (state.status !== "playing") return state;
	const height = state.grid.height;
	const width = state.grid.width;
	if (col < 0 || col >= width) return state;

	const overflow = config.overflow ?? "reject";
	const direction = config.gravityDirection ?? "down";
	const fromBottom =
		overflow === "pop_out_bottom" && direction === "down";
	const fromTop = overflow === "pop_out_top" && direction === "up";
	if (!fromBottom && !fromTop) return state;

	const exitRow = fromBottom ? height - 1 : 0;
	const exitVal = getCell(state.grid, { row: exitRow, col });
	if (exitVal === null) return state; // nothing to pop
	// Must pop own token
	if (exitVal !== state.currentPlayer) return state;

	const newCells = [...state.grid.cells];
	if (fromBottom) {
		// Shift column down: remove bottom, pull from above
		for (let row = height - 1; row > 0; row--) {
			const from = { row: row - 1, col };
			const to = { row, col };
			newCells[toIndex(to, state.grid.width)] = getCell(state.grid, from);
		}
		newCells[toIndex({ row: 0, col }, state.grid.width)] = null;
	} else {
		// Shift column up: remove top, pull from below
		for (let row = 0; row < height - 1; row++) {
			const from = { row: row + 1, col };
			const to = { row, col };
			newCells[toIndex(to, state.grid.width)] = getCell(state.grid, from);
		}
		newCells[toIndex({ row: height - 1, col }, state.grid.width)] = null;
	}

	const newGrid = { ...state.grid, cells: newCells };
	const newMoveCount = state.moveCount + 1;

	// Check win conditions after pop (some variants may differ)
	const winner = checkWinner(
		newGrid,
		state.currentPlayer,
		config.winLength,
		config.adjacency,
		config.topology ?? "rectangle",
		config.graph,
		config.gridWrap === true
	);
	if (winner) {
		return {
			...state,
			grid: newGrid,
			status: "won",
			winner: state.currentPlayer,
			moveCount: newMoveCount
		};
	}

	const isFull = isBoardFull(newGrid, config);
	if (isFull) {
		return {
			...state,
			grid: newGrid,
			status: "draw",
			moveCount: newMoveCount
		};
	}

	const nextPlayer: Player = state.currentPlayer === "X" ? "O" : "X";
	return {
		...state,
		grid: newGrid,
		currentPlayer: nextPlayer,
		moveCount: newMoveCount
	};
}

function handlePopOutRow(
	state: GameState,
	row: number,
	config: GameConfig
): GameState {
	if (state.status !== "playing") return state;
	const height = state.grid.height;
	const width = state.grid.width;
	if (row < 0 || row >= height) return state;

	const overflow = config.overflow ?? "reject";
	const direction = config.gravityDirection ?? "down";
	const fromRight = overflow === "pop_out_right" && direction === "right";
	const fromLeft = overflow === "pop_out_left" && direction === "left";
	if (!fromRight && !fromLeft) return state;

	const exitCol = fromRight ? width - 1 : 0;
	const exitVal = getCell(state.grid, { row, col: exitCol });
	if (exitVal === null) return state; // nothing to pop
	// Must pop own token
	if (exitVal !== state.currentPlayer) return state;

	const newCells = [...state.grid.cells];
	if (fromRight) {
		// Shift row right: remove rightmost, pull from the left
		for (let col = width - 1; col > 0; col--) {
			const from = { row, col: col - 1 };
			const to = { row, col };
			newCells[toIndex(to, state.grid.width)] = getCell(state.grid, from);
		}
		newCells[toIndex({ row, col: 0 }, state.grid.width)] = null;
	} else {
		// Shift row left: remove leftmost, pull from the right
		for (let col = 0; col < width - 1; col++) {
			const from = { row, col: col + 1 };
			const to = { row, col };
			newCells[toIndex(to, state.grid.width)] = getCell(state.grid, from);
		}
		newCells[toIndex({ row, col: width - 1 }, state.grid.width)] = null;
	}

	const newGrid = { ...state.grid, cells: newCells };
	const newMoveCount = state.moveCount + 1;

	const winner = checkWinner(
		newGrid,
		state.currentPlayer,
		config.winLength,
		config.adjacency,
		config.topology ?? "rectangle",
		config.graph,
		config.gridWrap === true
	);
	if (winner) {
		return {
			...state,
			grid: newGrid,
			status: "won",
			winner: state.currentPlayer,
			moveCount: newMoveCount
		};
	}

	const isFull = isBoardFull(newGrid, config);
	if (isFull) {
		return {
			...state,
			grid: newGrid,
			status: "draw",
			moveCount: newMoveCount
		};
	}

	const nextPlayer: Player = state.currentPlayer === "X" ? "O" : "X";
	return {
		...state,
		grid: newGrid,
		currentPlayer: nextPlayer,
		moveCount: newMoveCount
	};
}
