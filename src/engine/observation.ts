/**
 * Observation projection (M4).
 *
 * Full mode: identity view of the public grid.
 * Hit/miss: each player sees own hidden fleet + public shot results; opponent
 * fleet cells stay blank until marked hit/miss on the public grid.
 */
import type { GameConfig } from "@/engine/reducer";
import type { CellValue, GameState, Player, Position } from "@/engine/types";
import { getCell, toIndex } from "@/engine/types";

export type ShotResult = "hit" | "miss";

export type PlayerObservation = {
	player: Player;
	/** Cells visible to this player (length = width * height). */
	cells: CellValue[];
	lastShot?: { position: Position; result: ShotResult };
};

function emptyCells(count: number): CellValue[] {
	return Array(count).fill(null);
}

/** Project full state to one player's observation. */
export function observe(
	config: GameConfig,
	state: GameState,
	player: Player,
	lastShot?: { position: Position; result: ShotResult }
): PlayerObservation {
	const size = state.grid.width * state.grid.height;

	if ((config.observationMode ?? "full") !== "hit_miss") {
		return {
			player,
			cells: [...state.grid.cells],
			lastShot
		};
	}

	const cells = emptyCells(size);
	const hidden = state.hidden;

	for (let i = 0; i < size; i++) {
		const shot = state.grid.cells[i] ?? null;
		if (shot === "hit" || shot === "miss") {
			cells[i] = shot;
			continue;
		}
		// Reveal own unhit ships from the hidden layer
		if (hidden && hidden.cells[i] === player) {
			cells[i] = player;
		}
	}

	return { player, cells, lastShot };
}

/** True when every fleet cell owned by `owner` has been marked hit. */
export function fleetDestroyed(state: GameState, owner: Player): boolean {
	if (!state.hidden) return false;
	let hasShip = false;
	for (let i = 0; i < state.hidden.cells.length; i++) {
		if (state.hidden.cells[i] !== owner) continue;
		hasShip = true;
		if (state.grid.cells[i] !== "hit") return false;
	}
	return hasShip;
}

/** Opponent ship present under this cell (for fire resolution). */
export function hiddenOccupant(
	state: GameState,
	pos: Position
): Player | null {
	if (!state.hidden) return null;
	const v = getCell(state.hidden, pos);
	return v === "X" || v === "O" ? v : null;
}

export function shotAt(state: GameState, pos: Position): CellValue {
	return getCell(state.grid, pos);
}

export function indexOf(pos: Position, width: number): number {
	return toIndex(pos, width);
}
