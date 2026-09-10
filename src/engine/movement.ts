/**
 * Pure movement legality helpers (M5 Move foothold + piece-table adjacency).
 * Rectangle: orthogonal | diagonal | king with sliding range 1..8 (blocker-
 * aware ray walk). Optional `capture: "replace"` allows landing on an enemy
 * (path empty except destination). Optional `capture: "jump"` leaps over an
 * adjacent enemy to the empty cell beyond (rectangle | hex_offset | graph;
 * quiet moves stay range 1). Optional `mustCapture: true` (jump only) forbids
 * quiet moves at turn start when any jump exists for the acting seat
 * (Checkers-lite mandatory capture; mid-chain still uses `mustContinueFrom`).
 * Optional `mustLongestCapture: true` (requires `mustCapture`) further
 * restricts jump starts / mid-chain branches to those that maximize total
 * pieces captured along the jump tree (Draughts longest-chain rule).
 * Optional `promotion` (rectangle | hex_offset | graph jump): land on
 * `targetRows[seat]` or graph `targetNodes[seat]` (`"row,col"`) → crown
 * (`X+`/`O+`); crowned pieces use `crownedAdjacency` (default king on
 * rectangle; orthogonal required on hex/graph) and optional `crownedRange`
 * (quiet slide depth; default men `range`) via `effectiveMovement`. Optional
 * `crownedFlyingCapture` (rectangle | hex_offset | graph): crowned pieces may
 * leap over an enemy at any distance along a ray (empties before the mid) and
 * land on any empty cell beyond within `crownedRange` (Draughts-lite flying
 * capture; hex uses cube-axis rays; graph uses chain-walk rays); men stay
 * adjacent single-leap. Optional `menForwardOnly` (rectangle | hex_offset |
 * graph): uncrowned pieces may only quiet-move / jump toward their promotion
 * side — row-delta from the two `targetRows` on rect/hex (hex filters
 * cube-axis lands by the same offset-row sign); on graph, strict decrease in
 * shortest-path edge distance to any node on `targetRows[seat]` **or** to the
 * exact `targetNodes[seat]` hub. Crowned pieces ignore the filter.
 * Hex_offset: orthogonal cube-axis slides (range 1..8,
 * same blocker/replace rules) and cube-axis jump (enemy mid + empty land two
 * hops along one cube dir; flying capture extends rays). Graph: orthogonal
 * chain-walk along explicit edges (range 1..8; no turning at junctions) **or**
 * hop-ball BFS within range (`graphReach: "hop"`; may turn at junctions) —
 * same blocker/replace rules as rectangle/hex — plus jump as a 2-edge leap
 * over an enemy mid node to an empty landing (flying capture extends
 * chain-walk rays).
 */
import type { CellValue, Grid, Position, Player } from "@/engine/types";
import { getCell, setCell } from "@/engine/types";
import { cellOwner, isCrowned } from "@/engine/pieces";
import { inBounds, step } from "@/engine/adjacency";
import {
	neighbors,
	stepHex,
	CUBE_NEIGHBOR_DIRS,
	offsetToCube,
	cubeToOffset,
	posKey,
	type GridTopology,
	type GraphTopologyData
} from "@/engine/topology";

export type MovementAdjacency = "orthogonal" | "diagonal" | "king";

export type MovementCapture = "none" | "replace" | "jump";

/** Graph path mode: chain-walk (default) or hop-ball BFS. */
export type GraphReach = "chain" | "hop";

export type MovementPromotion = {
	/**
	 * Row-based promotion trigger (rectangle | hex | lane graphs). Mutually
	 * exclusive with `targetNodes`.
	 */
	targetRows?: { X: number; O: number };
	/**
	 * Node-key promotion trigger (`"row,col"`). Graph-only hub geometry —
	 * promotes only when landing on the seat's exact node (not every node
	 * sharing that row). Mutually exclusive with `targetRows`.
	 */
	targetNodes?: { X: string; O: string };
	/** Quiet/jump adjacency for crowned pieces. Default king. */
	crownedAdjacency?: MovementAdjacency;
	/**
	 * Quiet slide range for crowned pieces (1–8). Men keep `config.range`.
	 * Default: same as men range. Also caps flying-capture ray length when
	 * `crownedFlyingCapture` is on.
	 */
	crownedRange?: number;
	/**
	 * When true, crowned pieces may jump over a non-adjacent enemy (empty
	 * approach) and/or land beyond the cell immediately past the mid, along
	 * a clear ray within `crownedRange`. Men keep adjacent leaps.
	 */
	crownedFlyingCapture?: boolean;
	/**
	 * When true, uncrowned men may only advance toward their promotion side.
	 * Rectangle | hex_offset: row-delta sign from the two targetRows (hex
	 * filters cube-axis lands by offset-row). Graph: strict decrease in
	 * shortest-path edge distance to any node on `targetRows[seat]` **or**
	 * to the exact `targetNodes[seat]` hub key. Crowned pieces unrestricted.
	 */
	menForwardOnly?: boolean;
};

/** True when landing at `to` triggers promotion for `seat`. */
export function landsOnPromotionTarget(
	promo: MovementPromotion,
	seat: Player,
	to: Position
): boolean {
	if (promo.targetNodes) {
		return posKey(to) === promo.targetNodes[seat];
	}
	if (promo.targetRows) {
		return to.row === promo.targetRows[seat];
	}
	return false;
}

export type MovementConfig = {
	adjacency: MovementAdjacency;
	/** Max steps along a ray / hop depth (1 = adjacent only; >1 = sliding/hop). */
	range: number;
	/**
	 * Capture geometry. `replace` = land on enemy. `jump` = leap over adjacent
	 * enemy to empty cell beyond (rectangle | hex_offset | graph). Default none.
	 */
	capture?: MovementCapture;
	/**
	 * When true with `capture: "jump"`, quiet (non-jump) moves are illegal at
	 * turn start if the acting seat has any jump available from any owned
	 * piece. Mid-chain `mustContinueFrom` is unchanged. Default false.
	 */
	mustCapture?: boolean;
	/**
	 * When true with `mustCapture`, only jumps that begin (or continue) a
	 * maximum-length capture chain are legal. Turn start: compare chain
	 * lengths across all owned pieces; mid-chain: compare remaining captures
	 * among continuations from `mustContinueFrom`. Default false.
	 */
	mustLongestCapture?: boolean;
	/**
	 * Graph-only path mode. `chain` = unique-forward edge walk (no junction
	 * turns). `hop` = BFS within range (may turn at junctions). Ignored on
	 * rectangle / hex_offset.
	 */
	graphReach?: GraphReach;
	/**
	 * Crowned kings / Transform lite (rectangle | hex_offset | graph jump):
	 * promote on `targetRows[seat]` / graph `targetNodes`; crowned pieces use
	 * `crownedAdjacency` and optional `crownedRange` /
	 * `crownedFlyingCapture` (rectangle | hex_offset | graph). Optional
	 * `menForwardOnly` (rectangle | hex_offset | graph) restricts uncrowned
	 * quiet/jump: row-delta on rect/hex; edge-distance toward the promo row
	 * (`targetRows`) or hub node (`targetNodes`) on graph. Hex/graph require
	 * crownedAdjacency = orthogonal.
	 */
	promotion?: MovementPromotion;
};

/** True when this piece uses Draughts-lite flying jump capture. */
export function usesFlyingCapture(
	config: MovementConfig,
	cellValue: CellValue
): boolean {
	return (
		config.promotion?.crownedFlyingCapture === true && isCrowned(cellValue)
	);
}

export type MovementBoard = {
	topology?: GridTopology;
	graph?: GraphTopologyData;
	wrap?: boolean;
};

/**
 * Per-piece movement: crowned marks use `crownedAdjacency` (default king)
 * and optional `crownedRange` (default men `range`); uncrowned use
 * config.adjacency / config.range.
 */
export function effectiveMovement(
	config: MovementConfig,
	cellValue: CellValue
): MovementConfig {
	if (!isCrowned(cellValue)) return config;
	return {
		...config,
		adjacency: config.promotion?.crownedAdjacency ?? "king",
		range: config.promotion?.crownedRange ?? config.range
	};
}

/**
 * Row-delta sign uncrowned men must advance with under `menForwardOnly`.
 * Derived from the two promotion rows: each seat advances toward its own
 * `targetRows` along the axis they define. Equal targetRows → Checkers-like
 * default (X −1 / O +1).
 */
export function manForwardRowSign(
	seat: Player,
	targetRows: { X: number; O: number }
): -1 | 1 {
	const tx = targetRows.X;
	const to = targetRows.O;
	if (tx === to) return seat === "X" ? -1 : 1;
	if (seat === "X") return tx < to ? -1 : 1;
	return to < tx ? -1 : 1;
}

/** True when `dr` is a forward row step for an uncrowned man of `seat`. */
export function isForwardRowDelta(
	dr: number,
	seat: Player,
	targetRows: { X: number; O: number }
): boolean {
	if (dr === 0) return false;
	return Math.sign(dr) === manForwardRowSign(seat, targetRows);
}

/**
 * Shortest-path edge distance from `from` to any active graph node on
 * `promoRow`. Infinity if unreachable / no promo-row nodes.
 */
export function graphMinEdgeDistToPromoRow(
	from: Position,
	promoRow: number,
	graph: GraphTopologyData
): number {
	const start = posKey(from);
	if (!graph.neighborsOf.has(start)) return Number.POSITIVE_INFINITY;
	if (from.row === promoRow) return 0;
	const queue: Array<{ key: string; dist: number }> = [
		{ key: start, dist: 0 }
	];
	const seen = new Set<string>([start]);
	while (queue.length > 0) {
		const cur = queue.shift()!;
		for (const n of graph.neighborsOf.get(cur.key) ?? []) {
			const key = posKey(n);
			if (seen.has(key)) continue;
			const dist = cur.dist + 1;
			if (n.row === promoRow) return dist;
			seen.add(key);
			queue.push({ key, dist });
		}
	}
	return Number.POSITIVE_INFINITY;
}

/**
 * Shortest-path edge distance from `from` to the exact hub node `targetKey`
 * (`"row,col"`). Infinity if unreachable / missing from the graph.
 */
export function graphMinEdgeDistToTargetNode(
	from: Position,
	targetKey: string,
	graph: GraphTopologyData
): number {
	const start = posKey(from);
	if (!graph.neighborsOf.has(start)) return Number.POSITIVE_INFINITY;
	if (start === targetKey) return 0;
	if (!graph.neighborsOf.has(targetKey)) return Number.POSITIVE_INFINITY;
	const queue: Array<{ key: string; dist: number }> = [
		{ key: start, dist: 0 }
	];
	const seen = new Set<string>([start]);
	while (queue.length > 0) {
		const cur = queue.shift()!;
		for (const n of graph.neighborsOf.get(cur.key) ?? []) {
			const key = posKey(n);
			if (seen.has(key)) continue;
			const dist = cur.dist + 1;
			if (key === targetKey) return dist;
			seen.add(key);
			queue.push({ key, dist });
		}
	}
	return Number.POSITIVE_INFINITY;
}

/**
 * Graph menForwardOnly: land must strictly decrease edge distance toward
 * the seat's promotion target — any node on `targetRows[seat]`, or the exact
 * `targetNodes[seat]` hub (lateral / retreat blocked).
 */
export function isForwardGraphStep(
	from: Position,
	to: Position,
	seat: Player,
	promo: Pick<MovementPromotion, "targetRows" | "targetNodes">,
	graph: GraphTopologyData
): boolean {
	if (promo.targetNodes) {
		const hub = promo.targetNodes[seat];
		const dFrom = graphMinEdgeDistToTargetNode(from, hub, graph);
		const dTo = graphMinEdgeDistToTargetNode(to, hub, graph);
		return dTo < dFrom;
	}
	if (promo.targetRows) {
		const promoRow = promo.targetRows[seat];
		const dFrom = graphMinEdgeDistToPromoRow(from, promoRow, graph);
		const dTo = graphMinEdgeDistToPromoRow(to, promoRow, graph);
		return dTo < dFrom;
	}
	return false;
}

/**
 * Adjacency ray deltas for a specific piece: crowned uses crownedAdjacency;
 * uncrowned with `menForwardOnly` keep only forward row-delta rays.
 */
export function pieceAdjacencyDeltas(
	config: MovementConfig,
	cellValue: CellValue
): ReadonlyArray<readonly [number, number]> {
	const eff = effectiveMovement(config, cellValue);
	const deltas = adjacencyDeltas(eff.adjacency);
	const owner = cellOwner(cellValue);
	if (
		owner === null ||
		isCrowned(cellValue) ||
		config.promotion?.menForwardOnly !== true ||
		!config.promotion.targetRows
	) {
		return deltas;
	}
	const sign = manForwardRowSign(owner, config.promotion.targetRows);
	return deltas.filter(([dr]) => Math.sign(dr) === sign);
}

/**
 * Filter destinations for uncrowned menForwardOnly.
 * Rectangle / hex: forward row-delta (requires `targetRows`). Graph: strict
 * edge-distance decrease toward `targetRows[seat]` or `targetNodes[seat]`
 * hub (requires `graph`).
 */
function filterMenForwardDestinations(
	from: Position,
	dests: Position[],
	config: MovementConfig,
	cellValue: CellValue,
	graph?: GraphTopologyData
): Position[] {
	if (config.promotion?.menForwardOnly !== true) return dests;
	if (isCrowned(cellValue)) return dests;
	const owner = cellOwner(cellValue);
	const promo = config.promotion;
	if (owner === null) return dests;
	if (graph && (promo.targetNodes || promo.targetRows)) {
		return dests.filter((to) =>
			isForwardGraphStep(from, to, owner, promo, graph)
		);
	}
	if (!promo.targetRows) return dests;
	return dests.filter((to) =>
		isForwardRowDelta(to.row - from.row, owner, promo.targetRows!)
	);
}

/** True when `occ` is an enemy piece relative to `moverOwner`. */
function isEnemyPiece(occ: CellValue, moverOwner: Player): boolean {
	const owner = cellOwner(occ);
	return owner !== null && owner !== moverOwner;
}

/** True when `occ` is an own piece for `moverOwner`. */
function isOwnPiece(occ: CellValue, moverOwner: Player): boolean {
	return cellOwner(occ) === moverOwner;
}

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

/**
 * Mid cell for a jump: adjacent 2-step leap (rectangle / hex / graph), or
 * the unique enemy on a flying-capture ray when `crownedFlyingCapture` is
 * set and `from→to` lies on a clear adjacency / chain-walk ray within
 * `config.range`. Returns null when no legal mid exists. Pass `wrapOrBoard`
 * + `grid` for hex/graph/flying (and wrap-aware mid); rectangle adjacent
 * leaps still use raw deltas when board/grid omitted.
 */
export function jumpMid(
	from: Position,
	to: Position,
	config: MovementConfig,
	wrapOrBoard: boolean | MovementBoard = false,
	grid?: Grid
): Position | null {
	const opts = boardOpts(wrapOrBoard);
	if (opts.topology === "graph") {
		if (config.adjacency !== "orthogonal" || !opts.graph) return null;
		for (const mid of opts.graph.neighborsOf.get(posKey(from)) ?? []) {
			const midNeighbors = opts.graph.neighborsOf.get(posKey(mid)) ?? [];
			if (
				midNeighbors.some((p) => p.row === to.row && p.col === to.col)
			) {
				return mid;
			}
		}
		// Flying capture: unique enemy between from and to on a chain-walk ray.
		if (
			config.promotion?.crownedFlyingCapture === true &&
			grid &&
			config.capture === "jump"
		) {
			const mover = cellOwner(getCell(grid, from));
			if (mover === null) return null;
			for (const n1 of opts.graph.neighborsOf.get(posKey(from)) ?? []) {
				let enemy: Position | null = null;
				let prev: Position = from;
				let cur: Position = n1;
				const pathSeen = new Set<string>([posKey(from)]);
				for (let i = 1; i <= config.range; i++) {
					const key = posKey(cur);
					if (pathSeen.has(key)) break;
					pathSeen.add(key);
					if (cur.row === to.row && cur.col === to.col) {
						return enemy;
					}
					const occ = getCell(grid, cur);
					if (enemy === null) {
						if (occ === null) {
							/* approach empty */
						} else if (isEnemyPiece(occ, mover)) {
							enemy = cur;
						} else {
							break;
						}
					} else if (occ !== null) {
						break;
					}
					const next = graphChainForward(cur, prev, opts.graph);
					if (!next) break;
					prev = cur;
					cur = next;
				}
			}
		}
		return null;
	}
	if (opts.topology === "hex_offset") {
		if (config.adjacency !== "orthogonal") return null;
		for (const d of CUBE_NEIGHBOR_DIRS) {
			if (grid) {
				const mid = stepHex(grid, from, d, opts.wrap);
				if (!mid) continue;
				const land = stepHex(grid, mid, d, opts.wrap);
				if (land && land.row === to.row && land.col === to.col) {
					return mid;
				}
			} else {
				const c = offsetToCube(from);
				const midCube = { q: c.q + d.q, r: c.r + d.r };
				const mid = cubeToOffset(midCube);
				const land = cubeToOffset({
					q: midCube.q + d.q,
					r: midCube.r + d.r
				});
				if (land.row === to.row && land.col === to.col) return mid;
			}
		}
		// Flying capture: unique enemy between from and to on a cube-axis ray.
		if (
			config.promotion?.crownedFlyingCapture === true &&
			grid &&
			config.capture === "jump"
		) {
			const mover = cellOwner(getCell(grid, from));
			if (mover === null) return null;
			for (const d of CUBE_NEIGHBOR_DIRS) {
				let enemy: Position | null = null;
				let cursor: Position = from;
				for (let i = 1; i <= config.range; i++) {
					const next = stepHex(grid, cursor, d, opts.wrap);
					if (!next) break;
					cursor = next;
					if (cursor.row === to.row && cursor.col === to.col) {
						return enemy;
					}
					const occ = getCell(grid, cursor);
					if (enemy === null) {
						if (occ === null) continue;
						if (isEnemyPiece(occ, mover)) {
							enemy = cursor;
							continue;
						}
						return null;
					}
					if (occ !== null) return null;
				}
			}
		}
		return null;
	}
	for (const [dr, dc] of adjacencyDeltas(config.adjacency)) {
		if (to.row === from.row + 2 * dr && to.col === from.col + 2 * dc) {
			return { row: from.row + dr, col: from.col + dc };
		}
	}
	// Flying capture: unique enemy between from and to on a clear ray.
	if (
		config.promotion?.crownedFlyingCapture === true &&
		grid &&
		config.capture === "jump"
	) {
		const mover = cellOwner(getCell(grid, from));
		if (mover === null) return null;
		for (const [dr, dc] of adjacencyDeltas(config.adjacency)) {
			let enemy: Position | null = null;
			let cursor: Position = from;
			for (let i = 1; i <= config.range; i++) {
				const next = step(grid, cursor, { row: dr, col: dc }, opts.wrap);
				if (!next) break;
				cursor = next;
				if (cursor.row === to.row && cursor.col === to.col) {
					return enemy;
				}
				const occ = getCell(grid, cursor);
				if (enemy === null) {
					if (occ === null) continue;
					if (isEnemyPiece(occ, mover)) {
						enemy = cursor;
						continue;
					}
					return null;
				}
				if (occ !== null) return null;
			}
		}
	}
	return null;
}

/**
 * Landing cells reachable by jumping over exactly one enemy to an empty
 * square (rectangle adjacency rays, hex cube-axis double steps, or graph
 * 2-edge leaps). With `crownedFlyingCapture`, crowned rectangle | hex | graph
 * pieces may approach across empties and land any empty cell beyond the mid
 * within `crownedRange` (hex: cube-axis; graph: chain-walk). Distinct from
 * replace (land on enemy) and hop-ball (BFS through empties).
 */
export function jumpDestinations(
	grid: Grid,
	from: Position,
	config: MovementConfig,
	wrapOrBoard: boolean | MovementBoard = false,
	mover?: Player
): Position[] {
	if (!inBounds(grid, from)) return [];
	const opts = boardOpts(wrapOrBoard);
	const cell = getCell(grid, from);
	const owner = mover ?? cellOwner(cell);
	if (owner === null) return [];
	if (mover != null && cellOwner(cell) !== mover) return [];
	const eff = effectiveMovement(config, cell);
	const out: Position[] = [];

	if (opts.topology === "graph") {
		if (eff.adjacency !== "orthogonal" || !opts.graph) return [];
		const seen = new Set<string>();
		// Graph flying capture (crowned only): chain-walk ray approach + long land.
		if (usesFlyingCapture(config, cell)) {
			for (const n1 of opts.graph.neighborsOf.get(posKey(from)) ?? []) {
				let enemyMid: Position | null = null;
				let prev: Position = from;
				let cur: Position = n1;
				const pathSeen = new Set<string>([posKey(from)]);
				for (let i = 1; i <= eff.range; i++) {
					const key = posKey(cur);
					if (pathSeen.has(key)) break;
					pathSeen.add(key);
					const occ = getCell(grid, cur);
					if (enemyMid === null) {
						if (occ === null) {
							/* approach empty */
						} else if (isEnemyPiece(occ, owner)) {
							enemyMid = cur;
						} else {
							break;
						}
					} else {
						if (occ !== null) break;
						if (!seen.has(key)) {
							seen.add(key);
							out.push(cur);
						}
					}
					const next = graphChainForward(cur, prev, opts.graph);
					if (!next) break;
					prev = cur;
					cur = next;
				}
			}
			return out;
		}
		for (const mid of opts.graph.neighborsOf.get(posKey(from)) ?? []) {
			const occ = getCell(grid, mid);
			if (!isEnemyPiece(occ, owner)) continue;
			for (const land of opts.graph.neighborsOf.get(posKey(mid)) ?? []) {
				if (land.row === from.row && land.col === from.col) continue;
				const key = posKey(land);
				if (seen.has(key)) continue;
				if (getCell(grid, land) !== null) continue;
				seen.add(key);
				out.push(land);
			}
		}
		return filterMenForwardDestinations(from, out, config, cell, opts.graph);
	}

	if (opts.topology === "hex_offset") {
		if (eff.adjacency !== "orthogonal") return [];
		// Hex flying capture (crowned only): cube-axis ray approach + long land.
		if (usesFlyingCapture(config, cell)) {
			for (const d of CUBE_NEIGHBOR_DIRS) {
				let enemyMid: Position | null = null;
				let cursor: Position = from;
				for (let i = 1; i <= eff.range; i++) {
					const next = stepHex(grid, cursor, d, opts.wrap);
					if (!next) break;
					cursor = next;
					const occ = getCell(grid, cursor);
					if (enemyMid === null) {
						if (occ === null) continue;
						if (isEnemyPiece(occ, owner)) {
							enemyMid = cursor;
							continue;
						}
						break;
					}
					if (occ !== null) break;
					out.push(cursor);
				}
			}
			return out;
		}
		for (const d of CUBE_NEIGHBOR_DIRS) {
			const mid = stepHex(grid, from, d, opts.wrap);
			if (!mid) continue;
			const occ = getCell(grid, mid);
			if (!isEnemyPiece(occ, owner)) continue;
			const land = stepHex(grid, mid, d, opts.wrap);
			if (!land || getCell(grid, land) !== null) continue;
			out.push(land);
		}
		return filterMenForwardDestinations(from, out, config, cell);
	}

	// Rectangle flying capture (crowned only): ray approach + long land.
	if (usesFlyingCapture(config, cell)) {
		for (const [dr, dc] of pieceAdjacencyDeltas(config, cell)) {
			let enemyMid: Position | null = null;
			let cursor: Position = from;
			for (let i = 1; i <= eff.range; i++) {
				const next = step(
					grid,
					cursor,
					{ row: dr, col: dc },
					opts.wrap
				);
				if (!next) break;
				cursor = next;
				const occ = getCell(grid, cursor);
				if (enemyMid === null) {
					if (occ === null) continue;
					if (isEnemyPiece(occ, owner)) {
						enemyMid = cursor;
						continue;
					}
					break;
				}
				if (occ !== null) break;
				out.push(cursor);
			}
		}
		return out;
	}

	for (const [dr, dc] of pieceAdjacencyDeltas(config, cell)) {
		const mid = step(grid, from, { row: dr, col: dc }, opts.wrap);
		if (!mid) continue;
		const occ = getCell(grid, mid);
		if (!isEnemyPiece(occ, owner)) continue;
		const land = step(grid, mid, { row: dr, col: dc }, opts.wrap);
		if (!land || getCell(grid, land) !== null) continue;
		out.push(land);
	}
	return out;
}

/** True when from→to is a jump capture (enemy mid, empty landing). */
export function isJumpCapture(
	grid: Grid,
	from: Position,
	to: Position,
	player: Player,
	config: MovementConfig,
	wrapOrBoard: boolean | MovementBoard = false
): boolean {
	if (config.capture !== "jump") return false;
	const opts = boardOpts(wrapOrBoard);
	if (
		opts.topology !== "rectangle" &&
		opts.topology !== "hex_offset" &&
		opts.topology !== "graph"
	) {
		return false;
	}
	const cell = getCell(grid, from);
	if (cellOwner(cell) !== player) return false;
	const eff = effectiveMovement(config, cell);
	const mid = jumpMid(from, to, eff, wrapOrBoard, grid);
	if (!mid || !inBounds(grid, mid) || !inBounds(grid, to)) return false;
	const occ = getCell(grid, mid);
	if (!isEnemyPiece(occ, player)) return false;
	if (getCell(grid, to) !== null) return false;
	return jumpDestinations(grid, from, config, wrapOrBoard, player).some(
		(p) => p.row === to.row && p.col === to.col
	);
}

/**
 * True when the acting seat has at least one jump capture from any owned
 * piece. Used by `mustCapture` turn-start filtering.
 */
export function hasAnyJumpCapture(
	grid: Grid,
	player: Player,
	config: MovementConfig,
	wrapOrBoard: boolean | MovementBoard = false
): boolean {
	if (config.capture !== "jump") return false;
	const opts = boardOpts(wrapOrBoard);
	if (
		opts.topology !== "rectangle" &&
		opts.topology !== "hex_offset" &&
		opts.topology !== "graph"
	) {
		return false;
	}
	for (let row = 0; row < grid.height; row++) {
		for (let col = 0; col < grid.width; col++) {
			const from = { row, col };
			if (cellOwner(getCell(grid, from)) !== player) continue;
			if (jumpDestinations(grid, from, config, wrapOrBoard, player).length > 0) {
				return true;
			}
		}
	}
	return false;
}

/** Simulate one jump: clear origin + mid enemy, land piece at `to`. */
function applyJumpSim(
	grid: Grid,
	from: Position,
	to: Position,
	config: MovementConfig,
	wrapOrBoard: boolean | MovementBoard,
	player: Player
): Grid | null {
	if (!isJumpCapture(grid, from, to, player, config, wrapOrBoard)) return null;
	const cell = getCell(grid, from);
	const eff = effectiveMovement(config, cell);
	const mid = jumpMid(from, to, eff, wrapOrBoard, grid);
	if (!mid) return null;
	let cells = setCell(grid, from, null);
	cells = setCell({ ...grid, cells }, mid, null);
	cells = setCell({ ...grid, cells }, to, cell);
	return { ...grid, cells };
}

/**
 * Solo-apply a seat's move list onto a probe grid, clearing jump mids when
 * `capture = jump`. Used for multi-action simultaneous move chains (open,
 * commitReveal probe, stepPly, jointLegal enumeration).
 */
export function applySoloMovesCaptureAware(
	grid: Grid,
	player: Player,
	moves: readonly { from: Position; to: Position }[],
	config: MovementConfig,
	wrapOrBoard: boolean | MovementBoard = false
): Grid {
	let g = grid;
	for (const m of moves) {
		if (config.capture === "jump") {
			const jumped = applyJumpSim(
				g,
				m.from,
				m.to,
				config,
				wrapOrBoard,
				player
			);
			if (jumped) {
				g = jumped;
				continue;
			}
		}
		let cells = setCell(g, m.from, null);
		cells = setCell({ ...g, cells }, m.to, player);
		g = { ...g, cells };
	}
	return g;
}

/**
 * Maximum number of captures reachable by a jump tree starting at `from`
 * (0 when no jump exists). Pure DFS over `jumpDestinations` with simulated
 * clears — used by `mustLongestCapture`.
 */
export function maxJumpChainFrom(
	grid: Grid,
	from: Position,
	config: MovementConfig,
	wrapOrBoard: boolean | MovementBoard = false,
	player?: Player
): number {
	if (config.capture !== "jump") return 0;
	const cell = getCell(grid, from);
	const owner = player ?? cellOwner(cell);
	if (owner === null) return 0;
	if (player != null && cellOwner(cell) !== player) return 0;
	const dests = jumpDestinations(grid, from, config, wrapOrBoard, owner);
	if (dests.length === 0) return 0;
	let best = 0;
	for (const to of dests) {
		const next = applyJumpSim(grid, from, to, config, wrapOrBoard, owner);
		if (!next) continue;
		best = Math.max(
			best,
			1 + maxJumpChainFrom(next, to, config, wrapOrBoard, owner)
		);
	}
	return best;
}

/**
 * Capture count of the chain that begins with the specific jump `from→to`
 * (1 + max remaining after that leap). 0 when the leap is illegal.
 */
export function jumpChainLengthThrough(
	grid: Grid,
	from: Position,
	to: Position,
	config: MovementConfig,
	wrapOrBoard: boolean | MovementBoard = false,
	player?: Player
): number {
	const cell = getCell(grid, from);
	const owner = player ?? cellOwner(cell);
	if (owner === null) return 0;
	const next = applyJumpSim(grid, from, to, config, wrapOrBoard, owner);
	if (!next) return 0;
	return 1 + maxJumpChainFrom(next, to, config, wrapOrBoard, owner);
}

/**
 * Global maximum jump-chain length over all pieces owned by `player`.
 * 0 when the seat has no jumps.
 */
export function globalMaxJumpCaptures(
	grid: Grid,
	player: Player,
	config: MovementConfig,
	wrapOrBoard: boolean | MovementBoard = false
): number {
	if (config.capture !== "jump") return 0;
	let best = 0;
	for (let row = 0; row < grid.height; row++) {
		for (let col = 0; col < grid.width; col++) {
			const from = { row, col };
			if (cellOwner(getCell(grid, from)) !== player) continue;
			best = Math.max(
				best,
				maxJumpChainFrom(grid, from, config, wrapOrBoard, player)
			);
		}
	}
	return best;
}

/**
 * True when `from→to` is a maximal-length jump under `mustLongestCapture`
 * turn-start rules (chain length equals the seat-wide maximum).
 */
export function isMaximalJumpStart(
	grid: Grid,
	from: Position,
	to: Position,
	player: Player,
	config: MovementConfig,
	wrapOrBoard: boolean | MovementBoard = false
): boolean {
	if (config.mustLongestCapture !== true) return true;
	const global = globalMaxJumpCaptures(grid, player, config, wrapOrBoard);
	if (global <= 0) return true;
	return (
		jumpChainLengthThrough(grid, from, to, config, wrapOrBoard, player) ===
		global
	);
}

/**
 * True when mid-chain continuation `from→to` maximizes remaining captures
 * among jumps from `from` (Draughts longest-branch rule).
 */
export function isMaximalJumpContinuation(
	grid: Grid,
	from: Position,
	to: Position,
	player: Player,
	config: MovementConfig,
	wrapOrBoard: boolean | MovementBoard = false
): boolean {
	if (config.mustLongestCapture !== true) return true;
	const dests = jumpDestinations(grid, from, config, wrapOrBoard, player);
	if (dests.length === 0) return false;
	let maxRem = 0;
	for (const d of dests) {
		maxRem = Math.max(
			maxRem,
			jumpChainLengthThrough(grid, from, d, config, wrapOrBoard, player)
		);
	}
	return (
		jumpChainLengthThrough(grid, from, to, config, wrapOrBoard, player) ===
		maxRem
	);
}

/**
 * Cells reachable by sliding along adjacency rays up to `range`.
 * Empty cells along the ray are always destinations. With
 * `capture: "replace"`, the first enemy cell within range is also legal
 * (path empty except that destination); own pieces block without landing.
 * When `fromCell` is provided, uses `pieceAdjacencyDeltas` (menForwardOnly).
 */
function slideDestinations(
	grid: Grid,
	from: Position,
	config: MovementConfig,
	wrap: boolean,
	mover: Player,
	fromCell?: CellValue
): Position[] {
	const out: Position[] = [];
	const range = Math.max(1, Math.floor(config.range));
	const replace = config.capture === "replace";
	const deltas =
		fromCell !== undefined
			? pieceAdjacencyDeltas(config, fromCell)
			: adjacencyDeltas(config.adjacency);
	for (const [dr, dc] of deltas) {
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
				if (replace && isEnemyPiece(occ, mover)) {
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
				if (replace && isEnemyPiece(occ, mover)) {
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
 * Unique forward neighbor on a graph chain-walk ray (exclude backtrack).
 * Returns null at junctions (|forward| ≠ 1) or dead-ends — same junction
 * rule as quiet `slideGraphDestinations` / flying-capture rays.
 */
function graphChainForward(
	cur: Position,
	prev: Position,
	graph: GraphTopologyData
): Position | null {
	const forward = (graph.neighborsOf.get(posKey(cur)) ?? []).filter(
		(p) => p.row !== prev.row || p.col !== prev.col
	);
	return forward.length === 1 ? forward[0]! : null;
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
				if (replace && isEnemyPiece(occ, mover)) {
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
			const next = graphChainForward(cur, prev, graph);
			if (!next) break;
			prev = cur;
			cur = next;
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
				if (replace && isEnemyPiece(occ, mover)) {
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
	const cell = getCell(grid, from);
	const mover = cellOwner(cell);
	if (mover === null) return [];
	const eff = effectiveMovement(config, cell);

	const opts = boardOpts(wrapOrBoard);
	const { wrap, topology, graph } = opts;

	if (topology === "graph") {
		// Chain-walk (default) or hop-ball BFS; same blocker/replace as rect/hex.
		// Jump: quiet slides (eff.range; crowned may use crownedRange) ∪ leaps.
		// menForwardOnly: edge-distance toward targetRows/targetNodes on uncrowned.
		if (eff.adjacency !== "orthogonal" || !graph) return [];
		if (eff.capture === "jump") {
			const quiet = slideGraphDestinations(
				grid,
				from,
				{ ...eff, capture: "none" },
				graph,
				mover
			);
			const jumps = jumpDestinations(grid, from, config, opts, mover);
			const seen = new Set(quiet.map(posKey));
			const out = [...quiet];
			for (const j of jumps) {
				const k = posKey(j);
				if (!seen.has(k)) {
					seen.add(k);
					out.push(j);
				}
			}
			return filterMenForwardDestinations(from, out, config, cell, graph);
		}
		if (eff.graphReach === "hop") {
			return filterMenForwardDestinations(
				from,
				hopGraphDestinations(grid, from, eff, graph, mover),
				config,
				cell,
				graph
			);
		}
		return filterMenForwardDestinations(
			from,
			slideGraphDestinations(grid, from, eff, graph, mover),
			config,
			cell,
			graph
		);
	}

	if (topology === "hex_offset") {
		// Cube-axis slides with the same blocker / replace rules as rectangle.
		// menForwardOnly filters uncrowned quiet ∪ jump lands by offset-row sign.
		if (eff.adjacency !== "orthogonal") return [];
		if (eff.capture === "jump") {
			const quiet = slideHexDestinations(
				grid,
				from,
				{ ...eff, capture: "none" },
				wrap,
				mover
			);
			const jumps = jumpDestinations(grid, from, config, opts, mover);
			const seen = new Set(quiet.map(posKey));
			const out = [...quiet];
			for (const j of jumps) {
				const k = posKey(j);
				if (!seen.has(k)) {
					seen.add(k);
					out.push(j);
				}
			}
			return filterMenForwardDestinations(from, out, config, cell);
		}
		return filterMenForwardDestinations(
			from,
			slideHexDestinations(grid, from, eff, wrap, mover),
			config,
			cell
		);
	}

	// Rectangle: jump capture unions quiet slides (men range 1; crowned may
	// use crownedRange) with leaps (adjacent, or flying when
	// crownedFlyingCapture).
	if (eff.capture === "jump") {
		const quiet = slideDestinations(
			grid,
			from,
			{ ...eff, capture: "none" },
			wrap,
			mover,
			cell
		);
		const jumps = jumpDestinations(grid, from, config, opts, mover);
		const seen = new Set(quiet.map(posKey));
		const out = [...quiet];
		for (const j of jumps) {
			const k = posKey(j);
			if (!seen.has(k)) {
				seen.add(k);
				out.push(j);
			}
		}
		return filterMenForwardDestinations(from, out, config, cell);
	}

	// Rectangle: sliding ray walk (range 1 ≡ adjacent; replace may land on enemy).
	return filterMenForwardDestinations(
		from,
		slideDestinations(grid, from, eff, wrap, mover, cell),
		config,
		cell
	);
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
	if (cellOwner(getCell(grid, from)) !== player) return false;
	const dest = getCell(grid, to);
	if (isOwnPiece(dest, player)) return false;
	if (dest !== null && config.capture !== "replace") return false;
	if (dest !== null && config.capture === "replace" && !isEnemyPiece(dest, player)) {
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
	if (cellOwner(getCell(grid, moves.X.from)) !== "X") return false;
	if (cellOwner(getCell(grid, moves.O.from)) !== "O") return false;

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
 * Jump (M82): if first jumps over the piece second is moving (mid ===
 * second.from), second is a legal noop (capture-before-flee). First-seat
 * simulation clears the jump mid so flee-before-capture rejects the jump.
 */
export function canOrderedSimultaneousMoves(
	grid: Grid,
	moves: { X: JointMoveSpec; O: JointMoveSpec },
	config: MovementConfig,
	resolveOrder: "x_first" | "o_first",
	wrapOrBoard: boolean | MovementBoard = false
): boolean {
	if (cellOwner(getCell(grid, moves.X.from)) !== "X") return false;
	if (cellOwner(getCell(grid, moves.O.from)) !== "O") return false;

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

	// Priority replace capture of the piece second is moving — second noop.
	if (
		config.capture === "replace" &&
		firstMove.to.row === secondMove.from.row &&
		firstMove.to.col === secondMove.from.col
	) {
		const prior = getCell(grid, firstMove.to);
		if (cellOwner(prior) === second) return true;
	}

	// Priority jump capture over the piece second is moving — second noop.
	if (
		config.capture === "jump" &&
		isJumpCapture(
			grid,
			firstMove.from,
			firstMove.to,
			first,
			config,
			wrapOrBoard
		)
	) {
		const mid = jumpMid(
			firstMove.from,
			firstMove.to,
			config,
			wrapOrBoard,
			grid
		);
		if (
			mid &&
			mid.row === secondMove.from.row &&
			mid.col === secondMove.from.col &&
			cellOwner(getCell(grid, mid)) === second
		) {
			return true;
		}
	}

	let cells = setCell(grid, firstMove.from, null);
	if (
		config.capture === "jump" &&
		isJumpCapture(
			grid,
			firstMove.from,
			firstMove.to,
			first,
			config,
			wrapOrBoard
		)
	) {
		const mid = jumpMid(
			firstMove.from,
			firstMove.to,
			config,
			wrapOrBoard,
			grid
		);
		if (mid) {
			cells = setCell({ ...grid, cells }, mid, null);
		}
	}
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
