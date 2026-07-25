/**
 * Fleet placement phase for hit/miss games (Battleship depth).
 *
 * Players place contiguous orthogonal ships onto the hidden layer in order,
 * finishing their whole fleet before the opponent places. When both fleets
 * are complete, the game enters combat (`fire`).
 */
import type { GameState, Player, Position } from "@/engine/types";
import { getCell } from "@/engine/types";

export type FleetConfig = {
	/** Ship lengths each player must place (contiguous orthogonal lines). */
	ships: number[];
};

export type FleetProgress = {
	/** Index of the ship currently being placed. */
	shipIndex: number;
	/** Cells placed so far for the current ship. */
	cells: Position[];
	/** True once every ship length has been satisfied. */
	done: boolean;
};

export type FleetProgressMap = Record<Player, FleetProgress>;

export function emptyFleetProgress(): FleetProgress {
	return { shipIndex: 0, cells: [], done: false };
}

export function initialFleetProgressMap(): FleetProgressMap {
	return {
		X: emptyFleetProgress(),
		O: emptyFleetProgress()
	};
}

export function usesPlacementPhase(fleet?: FleetConfig): boolean {
	return Boolean(fleet && fleet.ships.length > 0);
}

export function fleetCellsRequired(fleet: FleetConfig): number {
	return fleet.ships.reduce((sum, len) => sum + len, 0);
}

function orthoAdjacent(a: Position, b: Position): boolean {
	const dr = Math.abs(a.row - b.row);
	const dc = Math.abs(a.col - b.col);
	return (dr === 1 && dc === 0) || (dr === 0 && dc === 1);
}

/**
 * True when `next` can extend `cells` into a straight orthogonal ship segment.
 * First cell: always ok. Second: any orthogonal neighbor. Later: must keep
 * the established row- or column-aligned line and attach to an open end.
 */
export function isValidShipExtension(
	cells: Position[],
	next: Position
): boolean {
	if (cells.length === 0) return true;
	if (cells.length === 1) {
		return orthoAdjacent(cells[0]!, next);
	}

	const rows = new Set(cells.map((c) => c.row));
	const cols = new Set(cells.map((c) => c.col));
	const horizontal = rows.size === 1;
	const vertical = cols.size === 1;
	if (!horizontal && !vertical) return false;

	if (horizontal) {
		const row = cells[0]!.row;
		if (next.row !== row) return false;
		const minCol = Math.min(...cells.map((c) => c.col));
		const maxCol = Math.max(...cells.map((c) => c.col));
		return next.col === minCol - 1 || next.col === maxCol + 1;
	}

	const col = cells[0]!.col;
	if (next.col !== col) return false;
	const minRow = Math.min(...cells.map((c) => c.row));
	const maxRow = Math.max(...cells.map((c) => c.row));
	return next.row === minRow - 1 || next.row === maxRow + 1;
}

/** Hidden layer is empty at `pos` (no ship already placed). */
export function isHiddenEmpty(state: GameState, pos: Position): boolean {
	if (!state.hidden) return false;
	return getCell(state.hidden, pos) === null;
}

export function canPlaceFleetCell(
	state: GameState,
	pos: Position,
	player: Player,
	fleet: FleetConfig
): boolean {
	if ((state.phase ?? "combat") !== "placement") return false;
	if (state.status !== "playing") return false;
	if (state.currentPlayer !== player) return false;
	const progress = state.fleetProgress?.[player];
	if (!progress || progress.done) return false;
	if (
		pos.row < 0 ||
		pos.row >= state.grid.height ||
		pos.col < 0 ||
		pos.col >= state.grid.width
	) {
		return false;
	}
	if (!isHiddenEmpty(state, pos)) return false;
	return isValidShipExtension(progress.cells, pos);
}

/**
 * Advance progress after a successful cell placement.
 * Returns updated progress for the placing player.
 */
export function advanceFleetProgress(
	progress: FleetProgress,
	pos: Position,
	fleet: FleetConfig
): FleetProgress {
	const shipLen = fleet.ships[progress.shipIndex] ?? 0;
	const cells = [...progress.cells, pos];
	if (cells.length < shipLen) {
		return { ...progress, cells };
	}
	const nextIndex = progress.shipIndex + 1;
	if (nextIndex >= fleet.ships.length) {
		return { shipIndex: nextIndex, cells: [], done: true };
	}
	return { shipIndex: nextIndex, cells: [], done: false };
}

export function bothFleetsPlaced(progress: FleetProgressMap): boolean {
	return progress.X.done && progress.O.done;
}
