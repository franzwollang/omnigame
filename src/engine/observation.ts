/**
 * Observation projection (M4+).
 *
 * full: identity view of the public grid.
 * hit_miss: each player sees own hidden fleet + public shot results + any
 * public spotters (X/O on the public grid from place→fire / move→fire); opponent fleet
 * cells stay blank until marked hit/miss on the public grid.
 * fog: cells within `fogRadius` of any own piece are visible; others fogged.
 * Bootstrap: with no own pieces yet, the whole board is visible.
 * deduction: dummy empty board + public roster / own eliminations / own lastQuery.
 */
import type { GameConfig } from "@/engine/reducer";
import type {
	CellValue,
	DeductionCharacter,
	GameState,
	Player,
	Position
} from "@/engine/types";
import { getCell, toIndex } from "@/engine/types";
import {
	offsetToCube,
	posKey,
	type GraphTopologyData,
	type GridTopology
} from "@/engine/topology";

export type ShotResult = "hit" | "miss";
export type FogMetric = "chebyshev" | "manhattan";

export type PlayerObservation = {
	player: Player;
	/** Cells visible to this player (length = width * height). */
	cells: CellValue[];
	/**
	 * Per-cell visibility mask (same length as cells).
	 * false ⇒ fogged (cells[i] is null and must not be treated as known-empty).
	 */
	visible: boolean[];
	lastShot?: { position: Position; result: ShotResult };
	/** Deduction / Guess Who-lite private view. */
	deduction?: {
		roster: DeductionCharacter[];
		eliminated: string[];
		lastQuery?: {
			by: Player;
			trait?: string;
			value?: boolean;
			clauses?: Array<{ trait: string; value: boolean }>;
			op?: "and" | "or";
			answer: boolean;
		};
	};
};

function emptyCells(count: number): CellValue[] {
	return Array(count).fill(null);
}

function allVisible(count: number): boolean[] {
	return Array(count).fill(true);
}

function noneVisible(count: number): boolean[] {
	return Array(count).fill(false);
}

function cubeDistance(a: Position, b: Position): number {
	const ca = offsetToCube(a);
	const cb = offsetToCube(b);
	return (
		(Math.abs(ca.q - cb.q) + Math.abs(ca.r - cb.r) + Math.abs(ca.s - cb.s)) /
		2
	);
}

function rectDistance(
	a: Position,
	b: Position,
	metric: FogMetric
): number {
	const dr = Math.abs(a.row - b.row);
	const dc = Math.abs(a.col - b.col);
	return metric === "manhattan" ? dr + dc : Math.max(dr, dc);
}

/** Graph hop distance via BFS; Infinity if unreachable. */
function graphDistance(
	from: Position,
	to: Position,
	graph: GraphTopologyData
): number {
	const start = posKey(from);
	const goal = posKey(to);
	if (start === goal) return 0;
	if (!graph.neighborsOf.has(start) || !graph.neighborsOf.has(goal)) {
		return Number.POSITIVE_INFINITY;
	}
	const queue: Array<{ key: string; dist: number }> = [
		{ key: start, dist: 0 }
	];
	const seen = new Set<string>([start]);
	while (queue.length > 0) {
		const cur = queue.shift()!;
		const neighbors = graph.neighborsOf.get(cur.key) ?? [];
		for (const n of neighbors) {
			const key = posKey(n);
			if (seen.has(key)) continue;
			const dist = cur.dist + 1;
			if (key === goal) return dist;
			seen.add(key);
			queue.push({ key, dist });
		}
	}
	return Number.POSITIVE_INFINITY;
}

export function fogDistance(
	a: Position,
	b: Position,
	topology: GridTopology = "rectangle",
	metric: FogMetric = "chebyshev",
	graph?: GraphTopologyData
): number {
	if (topology === "graph" && graph) {
		return graphDistance(a, b, graph);
	}
	if (topology === "hex_offset") {
		return cubeDistance(a, b);
	}
	return rectDistance(a, b, metric);
}

function ownPiecePositions(state: GameState, player: Player): Position[] {
	const { width, height, cells } = state.grid;
	const out: Position[] = [];
	for (let row = 0; row < height; row++) {
		for (let col = 0; col < width; col++) {
			if (cells[toIndex({ row, col }, width)] === player) {
				out.push({ row, col });
			}
		}
	}
	return out;
}

function projectFog(
	config: GameConfig,
	state: GameState,
	player: Player,
	lastShot?: { position: Position; result: ShotResult }
): PlayerObservation {
	const size = state.grid.width * state.grid.height;
	const anchors = ownPiecePositions(state, player);
	// Bootstrap: no vision anchors yet → full board (first placements).
	if (anchors.length === 0) {
		return {
			player,
			cells: [...state.grid.cells],
			visible: allVisible(size),
			lastShot
		};
	}

	const radius = config.fogRadius ?? 1;
	const metric = config.fogMetric ?? "chebyshev";
	const topology = config.topology ?? "rectangle";
	const cells = emptyCells(size);
	const visible = noneVisible(size);

	for (let row = 0; row < state.grid.height; row++) {
		for (let col = 0; col < state.grid.width; col++) {
			const pos = { row, col };
			const idx = toIndex(pos, state.grid.width);
			let inRange = false;
			for (const anchor of anchors) {
				if (
					fogDistance(pos, anchor, topology, metric, config.graph) <=
					radius
				) {
					inRange = true;
					break;
				}
			}
			if (!inRange) continue;
			visible[idx] = true;
			cells[idx] = state.grid.cells[idx] ?? null;
		}
	}

	return { player, cells, visible, lastShot };
}

/** Project full state to one player's observation. */
export function observe(
	config: GameConfig,
	state: GameState,
	player: Player,
	lastShot?: { position: Position; result: ShotResult }
): PlayerObservation {
	const size = state.grid.width * state.grid.height;
	const mode = config.observationMode ?? "full";

	if (mode === "deduction") {
		const ded = state.deduction;
		const roster = config.deduction?.roster ?? [];
		const lastQuery =
			ded?.lastQuery && ded.lastQuery.by === player
				? ded.lastQuery
				: undefined;
		return {
			player,
			cells: emptyCells(size),
			visible: allVisible(size),
			lastShot,
			deduction: {
				roster: roster.map((c) => ({
					id: c.id,
					traits: { ...c.traits }
				})),
				eliminated: [...(ded?.eliminated[player] ?? [])],
				...(lastQuery ? { lastQuery } : {})
			}
		};
	}

	if (mode === "fog") {
		return projectFog(config, state, player, lastShot);
	}

	if (mode !== "hit_miss") {
		const cells = [...state.grid.cells];
		// Hidden simultaneous: overlay own commit only (opponent stays secret).
		if (config.commitReveal && state.committedPlacements) {
			const own = state.committedPlacements[player] ?? [];
			for (const pos of own) {
				cells[toIndex(pos, state.grid.width)] = player;
			}
		}
		return {
			player,
			cells,
			visible: allVisible(size),
			lastShot
		};
	}

	const cells = emptyCells(size);
	const visible = allVisible(size);
	const hidden = state.hidden;

	for (let i = 0; i < size; i++) {
		const shot = state.grid.cells[i] ?? null;
		if (shot === "hit" || shot === "miss") {
			cells[i] = shot;
			continue;
		}
		// Public spotters (place→fire in-turn phases) are visible to both seats
		if (shot === "X" || shot === "O") {
			cells[i] = shot;
			continue;
		}
		// Reveal own unhit ships from the hidden layer
		if (hidden && hidden.cells[i] === player) {
			cells[i] = player;
		}
	}

	return { player, cells, visible, lastShot };
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
