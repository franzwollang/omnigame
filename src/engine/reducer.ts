// Pure reducer: State -> Event -> State

import type {
	GameState,
	GameEvent,
	Position,
	Player,
	CellValue,
	Grid,
	PendingPlace
} from "./types";
import { getCell, setCell, toIndex } from "./types";
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
import { canMove, type MovementConfig } from "@/engine/movement";
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
	inputMode?: "cell" | "column" | "row" | "move";
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
	observationMode?: "full" | "hit_miss" | "fog";
	/** Fog-of-war radius (Chebyshev/Manhattan/hex/graph hops). Used when mode=fog. */
	fogRadius?: number;
	fogMetric?: "chebyshev" | "manhattan";
	objectiveMode?:
		| "n_in_a_row"
		| "destroy_hidden"
		| "reach_row"
		| "area_control"
		| "none";
	/** Classic alternating turns, discrete global tick (Life), or simultaneous joint place. */
	turnSchedule?: "alternating" | "manual_tick" | "simultaneous";
	/**
	 * Successful actions before handoff (alternating). Default 1.
	 * When > 1, GameState.actionsRemaining tracks the remaining budget.
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
	scheduler?: SchedulerConfig;
	movement?: MovementConfig;
	/** Home rows for reach_row objective (player → target row index). */
	targetRows?: { X: number; O: number };
	/**
	 * Multi-ship placement phase for hit_miss. When set, game starts in
	 * placement (place onto hidden) then transitions to combat (fire).
	 */
	fleet?: FleetConfig;
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

function isPendingReserved(
	pending: PendingPlace[] | undefined,
	pos: Position
): boolean {
	return (pending ?? []).some(
		(p) => p.position.row === pos.row && p.position.col === pos.col
	);
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
		return free;
	}
	for (let row = 0; row < grid.height; row++) {
		for (let col = 0; col < grid.width; col++) {
			const pos = { row, col };
			const idx = toIndex(pos, grid.width);
			if (cells[idx] === null && !isPendingReserved(pending, pos)) free += 1;
		}
	}
	return free;
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
		actionsRemaining: actionsPerTurn > 1 ? actionsPerTurn : undefined
	};

	const seeds = config.initial ?? [];
	const hasOwner = seeds.some((p) => (p.visibility ?? "public") === "owner");
	if (hasOwner || config.observationMode === "hit_miss" || placement) {
		base.hidden = emptyGrid(config.gridWidth, config.gridHeight);
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
		case "commitPlace":
			return handleCommitPlace(state, event.player, event.position, config);
		case "reset":
			return createInitialState(config);
		default:
			return state;
	}
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
 * Simultaneous schedule: both players submit a place; resolve in one step.
 * Joint (`resolveOrder=joint`): same-cell conflict → neither places (round advances).
 * Ordered (`x_first` / `o_first`): apply seats in order; earlier seat wins same-cell.
 * If both complete a winning line in the same round → draw.
 */
function handleSimultaneousPlace(
	state: GameState,
	placements: { X: Position; O: Position },
	config: GameConfig
): GameState {
	if ((config.turnSchedule ?? "alternating") !== "simultaneous") return state;
	if (state.status !== "playing") return state;
	if ((config.inputMode ?? "cell") === "move") return state;
	if ((config.observationMode ?? "full") === "hit_miss") return state;

	const topology = config.topology ?? "rectangle";
	const wrap = config.gridWrap === true;
	const resolveOrder = config.resolveOrder ?? "joint";

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

	if (!validPos(placements.X) || !validPos(placements.O)) return state;

	const conflict =
		placements.X.row === placements.O.row &&
		placements.X.col === placements.O.col;

	let newGrid = state.grid;
	if (resolveOrder === "joint") {
		if (!conflict) {
			let cells = setCell(state.grid, placements.X, "X");
			cells = setCell({ ...state.grid, cells }, placements.O, "O");
			newGrid = { ...state.grid, cells };
		}
	} else {
		const first: Player = resolveOrder === "x_first" ? "X" : "O";
		const second: Player = first === "X" ? "O" : "X";
		let cells = setCell(state.grid, placements[first], first);
		let afterFirst: typeof state.grid = { ...state.grid, cells };
		if (getCell(afterFirst, placements[second]) === null) {
			cells = setCell(afterFirst, placements[second], second);
			newGrid = { ...state.grid, cells };
		} else {
			newGrid = afterFirst;
		}
	}

	const newMoveCount = state.moveCount + 1;
	// Reveal clears any private commits from a commit-reveal round.
	const clearedCommits = { committedPlacements: undefined as undefined };

	// Joint skips win checks on conflict (board unchanged). Ordered always checks.
	const shouldCheckWin = resolveOrder !== "joint" || !conflict;
	if (shouldCheckWin) {
		const xWins = Boolean(
			checkWinner(
				newGrid,
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
				newGrid,
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
				grid: newGrid,
				status: "draw",
				winner: null,
				moveCount: newMoveCount
			};
		}
		if (xWins) {
			return {
				...state,
				...clearedCommits,
				grid: newGrid,
				status: "won",
				winner: "X",
				moveCount: newMoveCount
			};
		}
		if (oWins) {
			return {
				...state,
				...clearedCommits,
				grid: newGrid,
				status: "won",
				winner: "O",
				moveCount: newMoveCount
			};
		}
	}

	if (isBoardFull(newGrid, config)) {
		return {
			...state,
			...clearedCommits,
			grid: newGrid,
			status: "draw",
			winner: null,
			moveCount: newMoveCount
		};
	}

	return {
		...state,
		...clearedCommits,
		grid: newGrid,
		moveCount: newMoveCount
		// Simultaneous rounds do not flip currentPlayer
	};
}

/**
 * Hidden simultaneous: record a private commit. When both seats have committed,
 * resolve via handleSimultaneousPlace (joint or ordered resolveOrder).
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
	if (prior[player]) return state; // already committed this round

	const nextCommits: Partial<Record<Player, Position>> = {
		...prior,
		[player]: position
	};

	const xPos = nextCommits.X;
	const oPos = nextCommits.O;
	if (xPos && oPos) {
		return handleSimultaneousPlace(
			{ ...state, committedPlacements: nextCommits },
			{ X: xPos, O: oPos },
			config
		);
	}

	return {
		...state,
		committedPlacements: nextCommits
		// moveCount unchanged until reveal
	};
}

function handleMove(
	state: GameState,
	from: Position,
	to: Position,
	config: GameConfig
): GameState {
	if ((config.inputMode ?? "cell") !== "move") return state;
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
			config.gridWrap === true
		)
	) {
		return state;
	}

	let cells = setCell(state.grid, from, null);
	cells = setCell({ ...state.grid, cells }, to, state.currentPlayer);
	const newGrid = { ...state.grid, cells };
	const newMoveCount = state.moveCount + 1;
	const next: GameState = {
		...state,
		grid: newGrid,
		moveCount: newMoveCount
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

	const nextPlayer: Player = state.currentPlayer === "X" ? "O" : "X";
	return {
		...next,
		currentPlayer: nextPlayer
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
	if (
		pos.row < 0 ||
		pos.row >= state.grid.height ||
		pos.col < 0 ||
		pos.col >= state.grid.width
	) {
		return state;
	}
	// Already shot
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

	if ((config.objectiveMode ?? "n_in_a_row") === "destroy_hidden") {
		const opponent: Player = state.currentPlayer === "X" ? "O" : "X";
		if (fleetDestroyed(next, opponent)) {
			return {
				...next,
				status: "won",
				winner: state.currentPlayer
			};
		}
	}

	const nextPlayer: Player = state.currentPlayer === "X" ? "O" : "X";
	return {
		...next,
		currentPlayer: nextPlayer
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
	// Hit/miss with fleet: place onto hidden during placement phase
	if ((config.observationMode ?? "full") === "hit_miss") {
		return handleFleetPlace(state, pos, config);
	}
	// Move games relocate existing pieces
	if ((config.inputMode ?? "cell") === "move") return state;

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

	// Check win condition using config
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

	// Effect: advance turn (multi-step keeps currentPlayer until budget spent)
	const turn = withTurnAdvanced(state, config);

	return {
		...state,
		grid: newGrid,
		currentPlayer: turn.currentPlayer,
		actionsRemaining: turn.actionsRemaining,
		moveCount: newMoveCount,
		koPoint: nextKoPoint,
		positionHistory: nextHistory
	};
}

/**
 * Delayed place: queue an intent now; materialize after `delayTurns` more places.
 * Pending cells are reserved. When no free cells remain, flush remaining pending.
 */
function handleDelayedPlace(
	state: GameState,
	pos: Position,
	config: GameConfig,
	delayTurns: number
): GameState {
	if (isPendingReserved(state.pendingPlaces, pos)) return state;

	const wrap = config.gridWrap === true;
	const topology = config.topology ?? "rectangle";
	const newMoveCount = state.moveCount + 1;
	let pending: PendingPlace[] = [
		...(state.pendingPlaces ?? []),
		{
			player: state.currentPlayer,
			position: { row: pos.row, col: pos.col },
			resolveAt: newMoveCount + delayTurns
		}
	];
	let cells = [...state.grid.cells];
	const resolvedOrder: Player[] = [];

	const materializeDue = (forceAll: boolean) => {
		const keep: PendingPlace[] = [];
		for (const p of pending) {
			if (forceAll || p.resolveAt <= newMoveCount) {
				const idx = toIndex(p.position, state.grid.width);
				if (cells[idx] === null) {
					cells[idx] = p.player;
					resolvedOrder.push(p.player);
				}
				// else fizzle (should not happen under reservation)
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

	// Settle toward the gravity exit: down → first empty from bottom;
	// up → first empty from top.
	let targetRow = -1;
	if (direction === "down") {
		for (let row = height - 1; row >= 0; row--) {
			if (getCell(state.grid, { row, col }) === null) {
				targetRow = row;
				break;
			}
		}
	} else {
		for (let row = 0; row < height; row++) {
			if (getCell(state.grid, { row, col }) === null) {
				targetRow = row;
				break;
			}
		}
	}
	if (targetRow === -1) {
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

	// Settle toward the gravity exit: right → first empty from right;
	// left → first empty from left.
	let targetCol = -1;
	if (direction === "right") {
		for (let col = width - 1; col >= 0; col--) {
			if (getCell(state.grid, { row, col }) === null) {
				targetCol = col;
				break;
			}
		}
	} else {
		for (let col = 0; col < width; col++) {
			if (getCell(state.grid, { row, col }) === null) {
				targetCol = col;
				break;
			}
		}
	}
	if (targetCol === -1) {
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
