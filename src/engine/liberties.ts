/**
 * Liberty / group-capture helpers (M5 Go-lite foothold; M56 hex; M57 graph).
 * Rectangle: orthogonal (von Neumann) connectivity. Hex_offset: six cube-axis
 * neighbors. Graph: explicit undirected edges (`graph.neighborsOf`).
 * Optional point ko, positional superko, or situational superko;
 * suicide is illegal after opponent captures.
 */
import type { CellValue, Grid, Player, Position } from "@/engine/types";
import { getCell, setCell, toIndex } from "@/engine/types";
import { step } from "@/engine/adjacency";
import {
	isActivePosition,
	neighbors,
	type GraphTopologyData,
	type GridTopology
} from "@/engine/topology";

/** Ko / superko rule selected by config. */
export type KoRule = "none" | "point" | "positional" | "situational";

/** Stable hash of the public board for positional superko. */
export function boardPositionHash(grid: Grid): string {
	return grid.cells.map((c) => (c == null ? "." : c)).join("");
}

/** Board + side-to-move hash for situational superko. */
export function situationHash(grid: Grid, sideToMove: Player): string {
	return `${boardPositionHash(grid)}|${sideToMove}`;
}

export function usesSuperkoHistory(rule: KoRule): boolean {
	return rule === "positional" || rule === "situational";
}

const ORTHOGONAL: ReadonlyArray<readonly [number, number]> = [
	[-1, 0],
	[1, 0],
	[0, -1],
	[0, 1]
];

function inBounds(grid: Grid, pos: Position): boolean {
	return (
		pos.row >= 0 &&
		pos.row < grid.height &&
		pos.col >= 0 &&
		pos.col < grid.width
	);
}

function keyOf(pos: Position): string {
	return `${pos.row},${pos.col}`;
}

/** Four orthogonal neighbors (von Neumann); toroidal when wrap=true. */
export function orthogonalNeighbors(
	grid: Grid,
	pos: Position,
	wrap: boolean = false
): Position[] {
	const out: Position[] = [];
	for (const [dr, dc] of ORTHOGONAL) {
		const next = step(grid, pos, { row: dr, col: dc }, wrap);
		if (next) out.push(next);
	}
	return out;
}

/**
 * Liberty adjacency for group capture / area scoring.
 * Rectangle stays 4-orthogonal (not Chebyshev-8 from topology.neighbors).
 * Hex_offset uses six cube-axis neighbors.
 * Graph uses explicit undirected edges.
 */
export function libertyNeighbors(
	grid: Grid,
	pos: Position,
	wrap: boolean = false,
	topology: GridTopology = "rectangle",
	graph?: GraphTopologyData
): Position[] {
	if (topology === "hex_offset") {
		return neighbors(grid, pos, "hex_offset", undefined, wrap);
	}
	if (topology === "graph") {
		return neighbors(grid, pos, "graph", graph, false);
	}
	return orthogonalNeighbors(grid, pos, wrap);
}

/** Flood-fill same-color stone group containing `start` (must be occupied). */
export function findGroup(
	grid: Grid,
	start: Position,
	wrap: boolean = false,
	topology: GridTopology = "rectangle",
	graph?: GraphTopologyData
): Position[] {
	const color = getCell(grid, start);
	if (color !== "X" && color !== "O") return [];

	const group: Position[] = [];
	const seen = new Set<string>();
	const stack: Position[] = [start];
	seen.add(keyOf(start));

	while (stack.length > 0) {
		const cur = stack.pop()!;
		group.push(cur);
		for (const n of libertyNeighbors(grid, cur, wrap, topology, graph)) {
			const k = keyOf(n);
			if (seen.has(k)) continue;
			if (getCell(grid, n) !== color) continue;
			seen.add(k);
			stack.push(n);
		}
	}
	return group;
}

/** Distinct empty cells adjacent (liberty-topology) to any stone in the group. */
export function countLiberties(
	grid: Grid,
	group: Position[],
	wrap: boolean = false,
	topology: GridTopology = "rectangle",
	graph?: GraphTopologyData
): number {
	const libs = new Set<string>();
	for (const stone of group) {
		for (const n of libertyNeighbors(grid, stone, wrap, topology, graph)) {
			if (getCell(grid, n) === null) libs.add(keyOf(n));
		}
	}
	return libs.size;
}

function removePositions(grid: Grid, positions: Position[]): CellValue[] {
	let cells = grid.cells;
	for (const p of positions) {
		cells = setCell({ ...grid, cells }, p, null);
	}
	return cells;
}

export type LibertyCaptureResult = {
	cells: CellValue[];
	/** Positions of stones removed this capture. */
	removed: Position[];
};

/**
 * After a stone is placed at `placed`, remove any opponent groups with
 * zero liberties. Does not check suicide of the placer's group.
 */
export function applyLibertyCapture(
	grid: Grid,
	placed: Position,
	currentPlayer: Player,
	wrap: boolean = false,
	topology: GridTopology = "rectangle",
	graph?: GraphTopologyData
): LibertyCaptureResult {
	const opponent: Player = currentPlayer === "X" ? "O" : "X";
	let cells = grid.cells;
	const working: Grid = { ...grid, cells };
	const removedKeys = new Set<string>();
	const removed: Position[] = [];

	for (const n of libertyNeighbors(working, placed, wrap, topology, graph)) {
		if (getCell(working, n) !== opponent) continue;
		const k = keyOf(n);
		if (removedKeys.has(k)) continue;
		const group = findGroup({ ...working, cells }, n, wrap, topology, graph);
		if (group.length === 0) continue;
		if (
			countLiberties({ ...working, cells }, group, wrap, topology, graph) ===
			0
		) {
			cells = removePositions({ ...working, cells }, group);
			for (const p of group) {
				const pk = keyOf(p);
				if (removedKeys.has(pk)) continue;
				removedKeys.add(pk);
				removed.push(p);
			}
		}
	}
	return { cells, removed };
}

/** Simple point-ko: when exactly one stone is captured, that intersection is forbidden next. */
export function koPointFromCapture(removed: Position[]): Position | null {
	return removed.length === 1 ? removed[0]! : null;
}

function samePoint(a: Position, b: Position): boolean {
	return a.row === b.row && a.col === b.col;
}

export type LibertyPlaceOpts = {
	/** Prefer over legacy koEnabled. */
	koRule?: KoRule;
	/** Legacy: true ≡ point ko when koRule omitted. */
	koEnabled?: boolean;
	koPoint?: Position | null;
	/**
	 * Prior hashes when koRule is positional (board) or situational
	 * (board|side-to-move).
	 */
	positionHistory?: readonly string[];
	/** Board topology for liberty adjacency (default rectangle). */
	topology?: GridTopology;
	/** Compiled graph adjacency when topology = graph. */
	graph?: GraphTopologyData;
};

function resolveKoRule(opts?: LibertyPlaceOpts): KoRule {
	if (opts?.koRule) return opts.koRule;
	return opts?.koEnabled ? "point" : "none";
}

/**
 * Simulate place + opponent capture. Returns null if out of bounds, occupied,
 * inactive (graph), or the placer's group would have zero liberties (suicide).
 */
export function simulateLibertyPlace(
	grid: Grid,
	pos: Position,
	player: Player,
	wrap: boolean = false,
	topology: GridTopology = "rectangle",
	graph?: GraphTopologyData
): LibertyCaptureResult | null {
	if (!inBounds(grid, pos)) return null;
	if (!isActivePosition(pos, topology, graph)) return null;
	if (getCell(grid, pos) !== null) return null;
	const placedCells = setCell(grid, pos, player);
	const afterCapture = applyLibertyCapture(
		{ ...grid, cells: placedCells },
		pos,
		player,
		wrap,
		topology,
		graph
	);
	const afterGrid: Grid = { ...grid, cells: afterCapture.cells };
	const ownGroup = findGroup(afterGrid, pos, wrap, topology, graph);
	if (countLiberties(afterGrid, ownGroup, wrap, topology, graph) <= 0)
		return null;
	return afterCapture;
}

/**
 * Legal Go-lite placement: empty cell, point-ko / superko rules, and after
 * place + opponent capture the placer's group still has ≥1 liberty.
 */
export function isLegalLibertyPlace(
	grid: Grid,
	pos: Position,
	player: Player,
	wrap: boolean = false,
	opts?: LibertyPlaceOpts
): boolean {
	const topology = opts?.topology ?? "rectangle";
	const graph = opts?.graph;
	const koRule = resolveKoRule(opts);
	if (
		koRule === "point" &&
		opts?.koPoint != null &&
		samePoint(pos, opts.koPoint)
	) {
		return false;
	}

	const simulated = simulateLibertyPlace(
		grid,
		pos,
		player,
		wrap,
		topology,
		graph
	);
	if (!simulated) return false;

	if (usesSuperkoHistory(koRule)) {
		const afterGrid: Grid = { ...grid, cells: simulated.cells };
		const history = opts?.positionHistory ?? [];
		const nextPlayer: Player = player === "X" ? "O" : "X";
		const hash =
			koRule === "situational"
				? situationHash(afterGrid, nextPlayer)
				: boardPositionHash(afterGrid);
		if (history.includes(hash)) return false;
	}

	return true;
}

export type AreaScore = { X: number; O: number };

export type GroupInfo = {
	id: number;
	color: Player;
	stones: Position[];
	liberties: Set<string>;
};

function seedPositionsFor(
	grid: Grid,
	topology: GridTopology,
	graph?: GraphTopologyData
): Position[] {
	if (topology === "graph" && graph) return graph.active;
	const all: Position[] = [];
	for (let row = 0; row < grid.height; row++) {
		for (let col = 0; col < grid.width; col++) {
			all.push({ row, col });
		}
	}
	return all;
}

function libertySetOf(
	grid: Grid,
	group: Position[],
	wrap: boolean,
	topology: GridTopology,
	graph?: GraphTopologyData
): Set<string> {
	const libs = new Set<string>();
	for (const stone of group) {
		for (const n of libertyNeighbors(grid, stone, wrap, topology, graph)) {
			if (getCell(grid, n) === null) libs.add(keyOf(n));
		}
	}
	return libs;
}

/** Enumerate same-color stone groups with their liberty key sets. */
export function enumerateGroups(
	grid: Grid,
	wrap: boolean = false,
	topology: GridTopology = "rectangle",
	graph?: GraphTopologyData
): GroupInfo[] {
	const groups: GroupInfo[] = [];
	const seen = new Set<string>();
	for (const start of seedPositionsFor(grid, topology, graph)) {
		const k = keyOf(start);
		if (seen.has(k)) continue;
		const cell = getCell(grid, start);
		if (cell !== "X" && cell !== "O") continue;
		const stones = findGroup(grid, start, wrap, topology, graph);
		for (const p of stones) seen.add(keyOf(p));
		groups.push({
			id: groups.length,
			color: cell,
			stones,
			liberties: libertySetOf(grid, stones, wrap, topology, graph)
		});
	}
	return groups;
}

/**
 * Shared-life (seki) clusters: mixed-color groups that share liberties where
 * every group has fewer than 2 private liberties (M67).
 */
export function findSekiClusters(
	grid: Grid,
	wrap: boolean = false,
	topology: GridTopology = "rectangle",
	graph?: GraphTopologyData
): GroupInfo[][] {
	const groups = enumerateGroups(grid, wrap, topology, graph);
	const n = groups.length;
	const parent = groups.map((_, i) => i);
	const find = (i: number): number => {
		let x = i;
		while (parent[x] !== x) {
			parent[x] = parent[parent[x]!];
			x = parent[x]!;
		}
		return x;
	};
	const uni = (a: number, b: number) => {
		const ra = find(a);
		const rb = find(b);
		if (ra !== rb) parent[ra] = rb;
	};

	for (let i = 0; i < n; i++) {
		for (let j = i + 1; j < n; j++) {
			const gi = groups[i]!;
			const gj = groups[j]!;
			for (const lib of Array.from(gi.liberties)) {
				if (gj.liberties.has(lib)) {
					uni(i, j);
					break;
				}
			}
		}
	}

	const clusters = new Map<number, number[]>();
	for (let i = 0; i < n; i++) {
		const root = find(i);
		const list = clusters.get(root);
		if (list) list.push(i);
		else clusters.set(root, [i]);
	}

	const out: GroupInfo[][] = [];
	for (const ids of Array.from(clusters.values())) {
		const colors = new Set(ids.map((i) => groups[i]!.color));
		if (colors.size < 2) continue;

		const oppLibs = (color: Player): Set<string> => {
			const s = new Set<string>();
			for (const i of ids) {
				const g = groups[i]!;
				if (g.color === color) continue;
				for (const lib of Array.from(g.liberties)) s.add(lib);
			}
			return s;
		};

		let isSeki = true;
		for (const i of ids) {
			const g = groups[i]!;
			const shared = oppLibs(g.color);
			let priv = 0;
			for (const lib of Array.from(g.liberties)) {
				if (!shared.has(lib)) priv += 1;
			}
			if (priv >= 2) {
				isSeki = false;
				break;
			}
		}
		if (!isSeki) continue;
		out.push(ids.map((i) => groups[i]!));
	}
	return out;
}

/**
 * Empty cells that must stay neutral under seki scoring (M67).
 *
 * Clusters groups that share ≥1 liberty. A mixed-color cluster is seki when
 * every group has fewer than 2 private liberties (liberties not shared with
 * any opposite-color group in the cluster). All liberties of seki-cluster
 * groups are returned as neutral — including mono-border “eyes” that plain
 * area scoring would award as territory.
 */
export function findSekiNeutralCells(
	grid: Grid,
	wrap: boolean = false,
	topology: GridTopology = "rectangle",
	graph?: GraphTopologyData
): Set<string> {
	const neutral = new Set<string>();
	for (const cluster of findSekiClusters(grid, wrap, topology, graph)) {
		for (const g of cluster) {
			for (const lib of Array.from(g.liberties)) neutral.add(lib);
		}
	}
	return neutral;
}

/**
 * True eye: empty intersection whose every liberty-neighbor is `color`
 * (or off-board / inactive). Used for pass-alive lite (M68).
 */
export function countTrueEyes(
	grid: Grid,
	group: Position[],
	color: Player,
	wrap: boolean = false,
	topology: GridTopology = "rectangle",
	graph?: GraphTopologyData
): number {
	const libs = libertySetOf(grid, group, wrap, topology, graph);
	let eyes = 0;
	for (const k of Array.from(libs)) {
		const [rs, cs] = k.split(",");
		const pos = { row: Number(rs), col: Number(cs) };
		const ns = libertyNeighbors(grid, pos, wrap, topology, graph);
		if (ns.length === 0) continue;
		if (ns.every((n) => getCell(grid, n) === color)) eyes += 1;
	}
	return eyes;
}

/**
 * Board-edge foothold: group touches the lattice border (rectangle/hex) or an
 * inactive/missing neighbor slot (graph). Edge contact counts as life under
 * dead-stone lite so open-board fights are not mass-removed at two-pass.
 */
export function groupTouchesEdge(
	grid: Grid,
	stones: Position[],
	topology: GridTopology = "rectangle",
	graph?: GraphTopologyData
): boolean {
	for (const p of stones) {
		if (
			p.row <= 0 ||
			p.col <= 0 ||
			p.row >= grid.height - 1 ||
			p.col >= grid.width - 1
		) {
			return true;
		}
		if (topology === "graph" && graph) {
			for (const [dr, dc] of ORTHOGONAL) {
				const n = { row: p.row + dr, col: p.col + dc };
				if (!inBounds(grid, n) || !isActivePosition(n, "graph", graph)) {
					return true;
				}
			}
		}
	}
	return false;
}

/**
 * Interior groups with fewer than 2 true eyes are dead at scoring (M68),
 * except stones in seki clusters (shared life is not death). Edge-touching
 * groups are kept. Returns cells to clear before area count.
 */
export function findDeadStoneCells(
	grid: Grid,
	wrap: boolean = false,
	topology: GridTopology = "rectangle",
	graph?: GraphTopologyData
): Position[] {
	const groups = enumerateGroups(grid, wrap, topology, graph);
	const sekiIds = new Set<number>();
	for (const cluster of findSekiClusters(grid, wrap, topology, graph)) {
		for (const g of cluster) sekiIds.add(g.id);
	}

	const dead: Position[] = [];
	for (const g of groups) {
		if (sekiIds.has(g.id)) continue;
		if (groupTouchesEdge(grid, g.stones, topology, graph)) continue;
		const eyes = countTrueEyes(
			grid,
			g.stones,
			g.color,
			wrap,
			topology,
			graph
		);
		if (eyes >= 2) continue;
		for (const p of g.stones) dead.push(p);
	}
	return dead;
}

/** Clear dead stones from a grid copy (M68 pass-alive lite removal). */
export function removeDeadStones(
	grid: Grid,
	wrap: boolean = false,
	topology: GridTopology = "rectangle",
	graph?: GraphTopologyData
): Grid {
	const dead = findDeadStoneCells(grid, wrap, topology, graph);
	if (dead.length === 0) return grid;
	let cells = grid.cells;
	for (const p of dead) {
		cells = setCell({ ...grid, cells }, p, null);
	}
	return { ...grid, cells };
}

/**
 * Simplified area scoring: stones + empty regions bordered only by one color.
 * Mixed-border or edge-open empty regions score for neither (dame).
 * On wrap boards, regions never "edge-open" via board boundary.
 * Region flood uses the same liberty adjacency as capture.
 * On graph boards, only active nodes participate (inactive cells ignored).
 * When `sekiNeutral` is set, mono-border regions that intersect those cells
 * are not awarded as territory (shared-life / seki scoring).
 */
export function scoreArea(
	grid: Grid,
	wrap: boolean = false,
	topology: GridTopology = "rectangle",
	graph?: GraphTopologyData,
	sekiNeutral?: Set<string>
): AreaScore {
	const score: AreaScore = { X: 0, O: 0 };

	const seedPositions = seedPositionsFor(grid, topology, graph);

	for (const pos of seedPositions) {
		const cell = getCell(grid, pos);
		if (cell === "X") score.X += 1;
		else if (cell === "O") score.O += 1;
	}

	const visited = new Set<string>();
	for (const start of seedPositions) {
		const k = keyOf(start);
		if (visited.has(k)) continue;
		if (getCell(grid, start) !== null) {
			visited.add(k);
			continue;
		}

		const region: Position[] = [];
		const border = new Set<Player>();
		const stack: Position[] = [start];
		visited.add(k);

		while (stack.length > 0) {
			const cur = stack.pop()!;
			region.push(cur);
			for (const n of libertyNeighbors(grid, cur, wrap, topology, graph)) {
				const nk = keyOf(n);
				const val = getCell(grid, n);
				if (val === null) {
					if (!visited.has(nk)) {
						visited.add(nk);
						stack.push(n);
					}
				} else if (val === "X" || val === "O") {
					border.add(val);
				}
			}
		}

		if (border.size === 1) {
			if (
				sekiNeutral &&
				region.some((p) => sekiNeutral.has(keyOf(p)))
			) {
				continue;
			}
			const owner = border.has("X") ? "X" : "O";
			score[owner] += region.length;
		}
	}

	return score;
}

/**
 * Winner by area score; draw on tie.
 * `komi` (default 0) is added to O's score as second-player compensation
 * under area_control (Go Lite Komi). Returned `score.O` includes komi.
 * When `sekiScoring` is true, empty points in shared-life (seki) clusters
 * are neutral (Go Lite Seki).
 * When `deadStones` is true, interior groups with fewer than 2 true eyes are
 * removed before scoring (pass-alive lite; seki clusters exempt) (M68).
 */
export function areaOutcome(
	grid: Grid,
	wrap: boolean = false,
	topology: GridTopology = "rectangle",
	graph?: GraphTopologyData,
	komi: number = 0,
	sekiScoring: boolean = false,
	deadStones: boolean = false
): {
	status: "won" | "draw";
	winner: Player | null;
	score: AreaScore;
} {
	const scored = deadStones
		? removeDeadStones(grid, wrap, topology, graph)
		: grid;
	const neutral = sekiScoring
		? findSekiNeutralCells(scored, wrap, topology, graph)
		: undefined;
	const raw = scoreArea(scored, wrap, topology, graph, neutral);
	const k = Number.isFinite(komi) && komi > 0 ? komi : 0;
	const score: AreaScore = { X: raw.X, O: raw.O + k };
	if (score.X > score.O) return { status: "won", winner: "X", score };
	if (score.O > score.X) return { status: "won", winner: "O", score };
	return { status: "draw", winner: null, score };
}

/** Debug helper: liberty count for the group at a stone. */
export function libertiesAt(
	grid: Grid,
	pos: Position,
	wrap: boolean = false,
	topology: GridTopology = "rectangle",
	graph?: GraphTopologyData
): number {
	const group = findGroup(grid, pos, wrap, topology, graph);
	if (group.length === 0) return 0;
	return countLiberties(grid, group, wrap, topology, graph);
}

export function cellIndex(grid: Grid, pos: Position): number {
	return toIndex(pos, grid.width);
}
