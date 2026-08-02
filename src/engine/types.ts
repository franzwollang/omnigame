// Core engine types for OmniGame
// Pure functional: State -> Event -> State

export type Player = "X" | "O";
/** Public cell marks: player tokens, or hit/miss shot results (partial-info). */
export type CellValue = Player | "hit" | "miss" | null;
export type Position = { row: number; col: number };

export type Grid = {
	width: number;
	height: number;
	cells: CellValue[];
};

export type GameStatus = "playing" | "won" | "draw";

/** hit_miss: placement = lay fleet; combat = fire. Other modes omit / combat. */
export type GamePhase = "placement" | "combat";

/**
 * Queued place intent for delayed placement (`placement.delayTurns` > 0).
 * - `cell`: reserve a fixed intersection (direct place)
 * - `column` / `row`: gravity intent; landing cell is settled at resolve time
 */
export type PendingPlace =
	| {
			player: Player;
			/** Absolute `moveCount` at which this place materializes. */
			resolveAt: number;
			kind: "cell";
			position: Position;
	  }
	| {
			player: Player;
			resolveAt: number;
			kind: "column";
			col: number;
	  }
	| {
			player: Player;
			resolveAt: number;
			kind: "row";
			row: number;
	  };

export function isCellPending(
	p: PendingPlace
): p is Extract<PendingPlace, { kind: "cell" }> {
	return p.kind === "cell";
}

export function pendingFingerprint(p: PendingPlace): string {
	if (p.kind === "cell") {
		return `${p.player}@cell:${p.position.row},${p.position.col}@${p.resolveAt}`;
	}
	if (p.kind === "column") {
		return `${p.player}@col:${p.col}@${p.resolveAt}`;
	}
	return `${p.player}@row:${p.row}@${p.resolveAt}`;
}

export type GameState = {
	/** Public board (placements or shot results). */
	grid: Grid;
	/** Owner-only fleet layer for hit/miss games; absent in full-info games. */
	hidden?: Grid;
	currentPlayer: Player;
	status: GameStatus;
	winner: Player | null;
	moveCount: number;
	/**
	 * Multi-step alternating: actions left in the current player's turn budget.
	 * Present when `actionsPerTurn > 1` under alternating; decremented on success;
	 * reset on handoff. Unused under simultaneous (budget is per-round collection).
	 */
	actionsRemaining?: number;
	/**
	 * Delayed places: queued intents that materialize after intervening places.
	 * Cell intents reserve that intersection; column/row intents reserve a slot
	 * on that line until resolved/fizzled.
	 */
	pendingPlaces?: PendingPlace[];
	/** Consecutive pass actions (area_control / Go-lite); two ends the game. */
	consecutivePasses?: number;
	/**
	 * Simple (point) ko: intersection forbidden for the next place only.
	 * Set when a single stone was just captured; cleared otherwise / on reset.
	 * Pass does not clear (Go-correct). Unused when koRule is positional/situational.
	 */
	koPoint?: Position | null;
	/**
	 * Superko history: positional = board-cell hashes; situational =
	 * `board|sideToMove` hashes. Seeded with the initial situation; appended
	 * after each successful place. Pass does not append.
	 */
	positionHistory?: string[];
	/** Placement vs combat for fleet games; default combat when omitted. */
	phase?: GamePhase;
	/** Per-player ship placement progress when phase = placement. */
	fleetProgress?: {
		X: {
			shipIndex: number;
			cells: Array<{ row: number; col: number }>;
			done: boolean;
		};
		O: {
			shipIndex: number;
			cells: Array<{ row: number; col: number }>;
			done: boolean;
		};
	};
	/**
	 * Hidden simultaneous: per-round private commits (0..actionsPerTurn each).
	 * Cleared after joint resolve. Public grid unchanged until both seats have
	 * committed their full per-round budget.
	 */
	committedPlacements?: Partial<Record<Player, Position[]>>;
	/**
	 * In-turn phase index when `turn.phases` is set (0 .. phases.length-1).
	 * Advances after each successful phase action; resets to 0 on handoff.
	 * Distinct from fleet `phase` (game-long placement/combat).
	 */
	turnPhaseIndex?: number;
	/** Deduction / Guess Who-lite secrets + per-player eliminations. */
	deduction?: DeductionState;
};

export type DeductionCharacter = {
	id: string;
	traits: Record<string, boolean>;
};

export type QueryClause = { trait: string; value: boolean };

export type DeductionLastQuery = {
	by: Player;
	answer: boolean;
	/** Single-trait query (queryShape single). */
	trait?: string;
	value?: boolean;
	/** Conjunction clauses (queryShape and). */
	clauses?: QueryClause[];
};

export type DeductionState = {
	secret: { X: string; O: string };
	eliminated: { X: string[]; O: string[] };
	lastQuery?: DeductionLastQuery;
};

/** Normalize a simultaneous placement payload to a position list. */
export function asPlacementList(
	p: Position | readonly Position[] | undefined
): Position[] {
	if (!p) return [];
	return Array.isArray(p) ? [...p] : [p];
}

export function positionsEqual(a: Position, b: Position): boolean {
	return a.row === b.row && a.col === b.col;
}

/** True when `list` already contains `pos`. */
export function listHasPosition(
	list: readonly Position[] | undefined,
	pos: Position
): boolean {
	return (list ?? []).some((p) => positionsEqual(p, pos));
}

export type PlaceMoveEvent = {
	type: "place";
	position: Position;
};

export type MoveEvent = {
	type: "move";
	from: Position;
	to: Position;
};

export type FireEvent = {
	type: "fire";
	position: Position;
};

export type ActivateColumnEvent = {
	type: "activateColumn";
	col: number;
};

export type ActivateRowEvent = {
	type: "activateRow";
	row: number;
};

export type PopOutColumnEvent = {
	type: "popOutColumn";
	col: number;
};

export type PopOutRowEvent = {
	type: "popOutRow";
	row: number;
};

export type TickEvent = {
	type: "tick";
};

export type PassEvent = {
	type: "pass";
};

export type SimultaneousPlaceEvent = {
	type: "simultaneousPlace";
	/** One place each (scalar) or N places per seat for multi-action rounds. */
	placements: {
		X: Position | Position[];
		O: Position | Position[];
	};
};

/** Joint move round: both seats submit one {from,to} relocation. */
export type SimultaneousMoveEvent = {
	type: "simultaneousMove";
	moves: {
		X: { from: Position; to: Position };
		O: { from: Position; to: Position };
	};
};

/** Hidden simultaneous: one seat's private commit (player required). */
export type CommitPlaceEvent = {
	type: "commitPlace";
	player: Player;
	position: Position;
};

export type ResetEvent = {
	type: "reset";
};

export type QueryEvent = {
	type: "query";
	/** Single-trait atom (queryShape single). */
	trait?: string;
	value?: boolean;
	/** Two-clause AND (queryShape and). */
	clauses?: QueryClause[];
};

export type GuessEvent = {
	type: "guess";
	id: string;
};

/** Manual hypothesis commit: prune one candidate from the actor's board. */
export type EliminateEvent = {
	type: "eliminate";
	id: string;
};

export type GameEvent =
	| PlaceMoveEvent
	| MoveEvent
	| FireEvent
	| ActivateColumnEvent
	| ActivateRowEvent
	| PopOutColumnEvent
	| PopOutRowEvent
	| TickEvent
	| PassEvent
	| SimultaneousPlaceEvent
	| SimultaneousMoveEvent
	| CommitPlaceEvent
	| QueryEvent
	| GuessEvent
	| EliminateEvent
	| ResetEvent;

// Helper to convert row/col to flat index
export function toIndex(pos: Position, width: number): number {
	return pos.row * width + pos.col;
}

// Helper to get cell value at position
export function getCell(grid: Grid, pos: Position): CellValue {
	return grid.cells[toIndex(pos, grid.width)] ?? null;
}

// Helper to set cell value at position (pure, returns new cells array)
export function setCell(
	grid: Grid,
	pos: Position,
	value: CellValue
): CellValue[] {
	const index = toIndex(pos, grid.width);
	const newCells = [...grid.cells];
	newCells[index] = value;
	return newCells;
}
