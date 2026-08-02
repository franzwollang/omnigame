/**
 * Pure movement legality helpers (M5 Move foothold + piece-table adjacency).
 * Rectangle: orthogonal | diagonal | king with sliding range 1..8 (blocker-
 * aware ray walk). Optional `capture: "replace"` allows landing on an enemy
 * (path empty except destination). Hex_offset: orthogonal cube-axis slides
 * (range 1..8, same blocker/replace rules). Graph: orthogonal chain-walk
 * along explicit edges (range 1..8; no turning at junctions) **or** hop-ball
 * BFS within range (`graphReach: "hop"`; may turn at junctions) — same
 * blocker/replace rules as rectangle/hex.
 */
import type { Grid, Position, Player } from "@/engine/types";
import { getCell, setCell } from "@/engine/types";
import { inBounds, step } from "@/engine/adjacency";
import {
	neighbors,
	stepHex,
	CUBE_NEIGHBOR_DIRS,
	type GridTopology,
	type GraphTopologyData
} from "@/engine/topology";

export type MovementAdjacency = "orthogonal" | "diagonal" | "king";

export type MovementCapture = "none" | "replace";

/** Graph path mode: chain-walk (default) or hop-ball BFS. */
export type GraphReach = "chain" | "hop";

export type MovementConfig = {
	adjacency: MovementAdjacency;
	/** Max steps along a ray / hop depth (1 = adjacent only; >1 = sliding/hop). */
	range: number;
	/** Move onto enemy removes occupant then lands. Default none. */
	capture?: MovementCapture;
	/**
	 * Graph-only path mode. `chain` = unique-forward edge walk (no junction
	 * turns). `hop` = BFS within range (may turn at junctions). Ignored on
	 * rectangle / hex_offset.
	 */
	graphReach?: GraphReach;
};

export type MovementBoard = {
	topology?: GridTopology;
	graph?: GraphTopologyData;
	wrap?: boolean;
};

const ORTHOGONAL: ReadonlyArray<readonly [number, number]> = [
	[-1, 0],
	[1, 0],
	[0, -1],
	[0, 1]
];

const DIAGONAL: ReadonlyArray<readonly [number, number]> = [
	[-1, -1],
	[-1, 1],
	[1, -1],
	[1, 1]
];

/** Deltas for a movement adjacency (rectangle piece-table rays). */
export function adjacencyDeltas(
	adjacency: MovementAdjacency
): ReadonlyArray<readonly [number, number]> {
	if (adjacency === "orthogonal") return ORTHOGONAL;
	if (adjacency === "diagonal") return DIAGONAL;
	return [...ORTHOGONAL, ...DIAGONAL];
}

function boardOpts(
	wrapOrBoard: boolean | MovementBoard = false
): Required<Pick<MovementBoard, "wrap">> &
	Pick<MovementBoard, "topology" | "graph"> {
	if (typeof wrapOrBoard === "boolean") {
		return { wrap: wrapOrBoard, topology: "rectangle", graph: undefined };
	}
	return {
		wrap: wrapOrBoard.wrap === true,
		topology: wrapOrBoard.topology ?? "rectangle",
		graph: wrapOrBoard.graph
	};
}

function posKey(p: Position): string {
	return `${p.row},${p.col}`;
}

/**
 * Cells reachable by sliding along adjacency rays up to `range`.
 * Empty cells along the ray are always destinations. With
 * `capture: "replace"`, the first enemy cell within range is also legal
 * (path empty except that destination); own pieces block without landing.
 */
function slideDestinations(
	grid: Grid,
	from: Position,
	config: MovementConfig,
	wrap: boolean,
	mover: Player
): Position[] {
	const out: Position[] = [];
	const range = Math.max(1, Math.floor(config.range));
	const replace = config.capture === "replace";
	for (const [dr, dc] of adjacencyDeltas(config.adjacency)) {
		let cur = from;
		const seen = new Set<string>([posKey(from)]);
		for (let dist = 1; dist <= range; dist++) {
			const next = step(grid, cur, { row: dr, col: dc }, wrap);
			if (!next) break;
			const key = posKey(next);
			if (seen.has(key)) break;
			seen.add(key);
			const occ = getCell(grid, next);
			if (occ !== null) {
				if (replace && occ !== mover && (occ === "X" || occ === "O")) {
					out.push(next);
				}
				break;
			}
			out.push(next);
			cur = next;
		}
	}
	return out;
}

/**
 * Hex cube-axis slides (odd-r): walk each of the six neighbor directions up
 * to `range` via `stepHex`. Same blocker / replace / wrap-loop rules as
 * rectangle `slideDestinations`.
 */
function slideHexDestinations(
	grid: Grid,
	from: Position,
	config: MovementConfig,
	wrap: boolean,
	mover: Player
): Position[] {
	const out: Position[] = [];
	const range = Math.max(1, Math.floor(config.range));
	const replace = config.capture === "replace";
	for (const d of CUBE_NEIGHBOR_DIRS) {
		let cur = from;
		const seen = new Set<string>([posKey(from)]);
		for (let dist = 1; dist <= range; dist++) {
			const next = stepHex(grid, cur, d, wrap);
			if (!next) break;
			const key = posKey(next);
			if (seen.has(key)) break;
			seen.add(key);
			const occ = getCell(grid, next);
			if (occ !== null) {
				if (replace && occ !== mover && (occ === "X" || occ === "O")) {
					out.push(next);
				}
				break;
			}
			out.push(next);
			cur = next;
		}
	}
	return out;
}

/**
 * Graph chain-walk slides: for each first edge from `from`, walk forward
 * along the unique non-backtrack neighbor up to `range`. Empty cells along
 * the chain are destinations. With `capture: "replace"`, the first enemy
 * within range is also legal (path empty except that destination); own
 * pieces block without landing. Junctions (|forward| ≠ 1) stop the chain —
 * no turning mid-slide. Range 1 degenerates to empty (or enemy) neighbors.
 * Distinct from fog hop-ball BFS.
 */
function slideGraphDestinations(
	grid: Grid,
	from: Position,
	config: MovementConfig,
	graph: GraphTopologyData,
	mover: Player
): Position[] {
	const range = Math.max(1, Math.floor(config.range));
	const replace = config.capture === "replace";
	const out: Position[] = [];
	const seen = new Set<string>();

	for (const n1 of graph.neighborsOf.get(posKey(from)) ?? []) {
		let cur = n1;
		let prev = from;
		const pathSeen = new Set<string>([posKey(from)]);
		for (let dist = 1; dist <= range; dist++) {
			const key = posKey(cur);
			if (pathSeen.has(key)) break;
			pathSeen.add(key);
			const occ = getCell(grid, cur);
			if (occ !== null) {
				if (replace && occ !== mover && (occ === "X" || occ === "O")) {
					if (!seen.has(key)) {
						seen.add(key);
						out.push(cur);
					}
				}
				break;
			}
			if (!seen.has(key)) {
				seen.add(key);
				out.push(cur);
			}
			if (dist === range) break;
			const forward = (graph.neighborsOf.get(key) ?? []).filter(
				(p) => p.row !== prev.row || p.col !== prev.col
			);
			if (forward.length !== 1) break;
			prev = cur;
			cur = forward[0]!;
		}
	}
	return out;
}

/**
 * Graph hop-ball BFS: all empty nodes within `range` hops along explicit
 * edges, traversing only through empty cells. With `capture: "replace"`,
 * an enemy node within range is a legal landing (not traversable). Own
 * pieces block. May turn at junctions — distinct from chain-walk.
 * Range 1 degenerates to empty (or enemy) neighbors.
 */
function hopGraphDestinations(
	grid: Grid,
	from: Position,
	config: MovementConfig,
	graph: GraphTopologyData,
	mover: Player
): Position[] {
	const range = Math.max(1, Math.floor(config.range));
	const replace = config.capture === "replace";
	const out: Position[] = [];
	const seen = new Set<string>([posKey(from)]);
	const queue: Array<{ pos: Position; dist: number }> = [
		{ pos: from, dist: 0 }
	];

	while (queue.length > 0) {
		const cur = queue.shift()!;
		if (cur.dist >= range) continue;
		for (const n of graph.neighborsOf.get(posKey(cur.pos)) ?? []) {
			const key = posKey(n);
			if (seen.has(key)) continue;
			seen.add(key);
			const occ = getCell(grid, n);
			if (occ !== null) {
				if (replace && occ !== mover && (occ === "X" || occ === "O")) {
					out.push(n);
				}
				// Occupied cells are never traversable.
				continue;
			}
			out.push(n);
			queue.push({ pos: n, dist: cur.dist + 1 });
		}
	}
	return out;
}

/** Neighbor cells for a range-1 step under the board topology. */
export function movementNeighbors(
	grid: Grid,
	from: Position,
	config: MovementConfig,
	wrapOrBoard: boolean | MovementBoard = false
): Position[] {
	const { wrap, topology, graph } = boardOpts(wrapOrBoard);
	if (!inBounds(grid, from)) return [];

	if (topology === "graph") {
		// Graph: orthogonal = explicit edges; range applied in legalDestinations.
		if (config.adjacency !== "orthogonal") return [];
		return neighbors(grid, from, topology, graph, wrap);
	}

	if (topology === "hex_offset") {
		// Unit cube-axis steps (range is applied in legalDestinations).
		if (config.adjacency !== "orthogonal") return [];
		return neighbors(grid, from, topology, graph, wrap);
	}

	// Rectangle range-1: one step along each delta (empty check is caller's job).
	const out: Position[] = [];
	for (const [dr, dc] of adjacencyDeltas(config.adjacency)) {
		const to = step(grid, from, { row: dr, col: dc }, wrap);
		if (to) out.push(to);
	}
	return out;
}

/**
 * Whether `to` lies on a clear adjacency ray within range.
 * When `grid` is omitted, uses rectangle deltas at distance 1 only (legacy).
 */
export function isWithinRange(
	from: Position,
	to: Position,
	config: MovementConfig,
	grid?: Grid,
	wrapOrBoard: boolean | MovementBoard = false
): boolean {
	const opts = boardOpts(wrapOrBoard);
	if (!grid) {
		// Legacy no-grid path: rectangle unit deltas only.
		const dr = to.row - from.row;
		const dc = to.col - from.col;
		return adjacencyDeltas(config.adjacency).some(
			([r, c]) => r === dr && c === dc
		);
	}
	return legalDestinations(grid, from, config, opts).some(
		(n) => n.row === to.row && n.col === to.col
	);
}

/** Legal destinations a piece at `from` may move to (empty, or enemy if replace). */
export function legalDestinations(
	grid: Grid,
	from: Position,
	config: MovementConfig,
	wrapOrBoard: boolean | MovementBoard = false
): Position[] {
	if (!inBounds(grid, from)) return [];
	const mover = getCell(grid, from);
	if (mover !== "X" && mover !== "O") return [];

	const opts = boardOpts(wrapOrBoard);
	const { wrap, topology, graph } = opts;

	if (topology === "graph") {
		// Chain-walk (default) or hop-ball BFS; same blocker/replace as rect/hex.
		if (config.adjacency !== "orthogonal" || !graph) return [];
		if (config.graphReach === "hop") {
			return hopGraphDestinations(grid, from, config, graph, mover);
		}
		return slideGraphDestinations(grid, from, config, graph, mover);
	}

	if (topology === "hex_offset") {
		// Cube-axis slides with the same blocker / replace rules as rectangle.
		if (config.adjacency !== "orthogonal") return [];
		return slideHexDestinations(grid, from, config, wrap, mover);
	}

	// Rectangle: sliding ray walk (range 1 ≡ adjacent; replace may land on enemy).
	return slideDestinations(grid, from, config, wrap, mover);
}

export function canMove(
	grid: Grid,
	from: Position,
	to: Position,
	player: Player,
	config: MovementConfig,
	wrapOrBoard: boolean | MovementBoard = false
): boolean {
	if (!inBounds(grid, from) || !inBounds(grid, to)) return false;
	if (getCell(grid, from) !== player) return false;
	const dest = getCell(grid, to);
	if (dest === player) return false;
	if (dest !== null && config.capture !== "replace") return false;
	if (
		dest !== null &&
		config.capture === "replace" &&
		dest !== "X" &&
		dest !== "O"
	) {
		return false;
	}
	return legalDestinations(grid, from, config, wrapOrBoard).some(
		(n) => n.row === to.row && n.col === to.col
	);
}

export type JointMoveSpec = { from: Position; to: Position };

/**
 * Joint simultaneous move legality.
 * Both seats validated on a vacated-origin board so a fleeing piece does not
 * block the other's path (incl. slides through the vacating cell) and so a
 * seat may land on the opponent's vacated origin (joint apply clears both
 * origins before landing — no pieceCaptured for a fleer). Stationary enemies
 * stay visible, so `capture: "replace"` is still required to take them.
 * Same-destination pairs still return true here; apply resolves conflict.
 */
export function canJointSimultaneousMoves(
	grid: Grid,
	moves: { X: JointMoveSpec; O: JointMoveSpec },
	config: MovementConfig,
	wrapOrBoard: boolean | MovementBoard = false
): boolean {
	if (getCell(grid, moves.X.from) !== "X") return false;
	if (getCell(grid, moves.O.from) !== "O") return false;

	let cells = setCell(grid, moves.X.from, null);
	cells = setCell({ ...grid, cells }, moves.O.from, null);
	const vacated: Grid = { ...grid, cells };

	const withX: Grid = {
		...vacated,
		cells: setCell(vacated, moves.X.from, "X")
	};
	const withO: Grid = {
		...vacated,
		cells: setCell(vacated, moves.O.from, "O")
	};

	return (
		canMove(withX, moves.X.from, moves.X.to, "X", config, wrapOrBoard) &&
		canMove(withO, moves.O.from, moves.O.to, "O", config, wrapOrBoard)
	);
}

/**
 * Ordered simultaneous move legality (resolveOrder = x_first | o_first):
 * first seat validated on the pre-round board; second seat validated after
 * simulating the first seat's move (sequential path revalidation).
 * Same-destination conflict: both paths must be legal on the pre-round board
 * (apply gives the cell to the first seat).
 * Replace: if first captures the piece second is moving, second is treated as
 * a legal noop (apply will skip them) so priority can capture before flee.
 */
export function canOrderedSimultaneousMoves(
	grid: Grid,
	moves: { X: JointMoveSpec; O: JointMoveSpec },
	config: MovementConfig,
	resolveOrder: "x_first" | "o_first",
	wrapOrBoard: boolean | MovementBoard = false
): boolean {
	if (getCell(grid, moves.X.from) !== "X") return false;
	if (getCell(grid, moves.O.from) !== "O") return false;

	const first: Player = resolveOrder === "x_first" ? "X" : "O";
	const second: Player = first === "X" ? "O" : "X";
	const firstMove = moves[first];
	const secondMove = moves[second];

	if (
		!canMove(
			grid,
			firstMove.from,
			firstMove.to,
			first,
			config,
			wrapOrBoard
		)
	) {
		return false;
	}

	const sameDest =
		firstMove.to.row === secondMove.to.row &&
		firstMove.to.col === secondMove.to.col;
	if (sameDest) {
		return canMove(
			grid,
			secondMove.from,
			secondMove.to,
			second,
			config,
			wrapOrBoard
		);
	}

	// Priority capture of the piece second is moving — second becomes a noop.
	if (
		config.capture === "replace" &&
		firstMove.to.row === secondMove.from.row &&
		firstMove.to.col === secondMove.from.col
	) {
		const prior = getCell(grid, firstMove.to);
		if (prior === second) return true;
	}

	let cells = setCell(grid, firstMove.from, null);
	cells = setCell({ ...grid, cells }, firstMove.to, first);
	const afterFirst: Grid = { ...grid, cells };

	return canMove(
		afterFirst,
		secondMove.from,
		secondMove.to,
		second,
		config,
		wrapOrBoard
	);
}

/** Build movement board context from a GameConfig-like object. */
export function movementBoardFrom(config: {
	topology?: GridTopology;
	graph?: GraphTopologyData;
	gridWrap?: boolean;
}): MovementBoard {
	return {
		topology: config.topology ?? "rectangle",
		graph: config.graph,
		wrap: config.gridWrap === true
	};
}
