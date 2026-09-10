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

type BensonRegion = {
	cells: Position[];
	adjacentGroupIds: Set<number>;
};

/**
 * Empty regions whose border stones are exclusively `color` (no opponent).
 * Used as candidate vital regions for Benson unconditional life (M69) and
 * nakade shape detection (M76).
 */
function findColorOnlyEmptyRegions(
	grid: Grid,
	color: Player,
	stoneToGroup: Map<string, number>,
	wrap: boolean,
	topology: GridTopology,
	graph?: GraphTopologyData
): BensonRegion[] {
	const regions: BensonRegion[] = [];
	const visited = new Set<string>();
	for (const start of seedPositionsFor(grid, topology, graph)) {
		const sk = keyOf(start);
		if (visited.has(sk)) continue;
		if (getCell(grid, start) !== null) {
			visited.add(sk);
			continue;
		}

		const cells: Position[] = [];
		const adjacentGroupIds = new Set<number>();
		const border = new Set<Player>();
		const stack: Position[] = [start];
		visited.add(sk);

		while (stack.length > 0) {
			const cur = stack.pop()!;
			cells.push(cur);
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
					if (val === color) {
						const gid = stoneToGroup.get(nk);
						if (gid !== undefined) adjacentGroupIds.add(gid);
					}
				}
			}
		}

		if (border.size === 1 && border.has(color) && adjacentGroupIds.size > 0) {
			regions.push({ cells, adjacentGroupIds });
		}
	}
	return regions;
}

/**
 * Classic 3-point straight nakade (T1): mono-border empty region of exactly
 * three cells in an orthogonal line; vital = middle. L (bent-3) is M86
 * `lNakadeDeath`; 4+ / bulky shapes still deferred.
 */
export function isNakadeVulnerableRegion(
	regionCells: Position[]
): { vital: Position } | null {
	if (regionCells.length !== 3) return null;
	const sorted = [...regionCells].sort(
		(a, b) => a.row - b.row || a.col - b.col
	);
	const a = sorted[0]!;
	const b = sorted[1]!;
	const c = sorted[2]!;
	const sameRow = a.row === b.row && b.row === c.row;
	const sameCol = a.col === b.col && b.col === c.col;
	if (sameRow && b.col === a.col + 1 && c.col === a.col + 2) {
		return { vital: b };
	}
	if (sameCol && b.row === a.row + 1 && c.row === a.row + 2) {
		return { vital: b };
	}
	return null;
}

/**
 * Bent-3 (L) nakade: three orthogonally connected empties that are not
 * colinear; vital = unique elbow (degree 2 in the induced region). Square-4 /
 * bulky shapes deferred (M86).
 */
export function isLNakadeVulnerableRegion(
	regionCells: Position[]
): { vital: Position } | null {
	if (regionCells.length !== 3) return null;
	// Straight T1 is `nakadeDeath`'s job — keep flags contrastable.
	if (isNakadeVulnerableRegion(regionCells)) return null;
	const ortho = (a: Position, b: Position) =>
		Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
	const degrees = regionCells.map((p, i) =>
		regionCells.reduce(
			(d, q, j) => (i !== j && ortho(p, q) ? d + 1 : d),
			0
		)
	);
	if (degrees.some((d) => d === 0)) return null;
	const elbows = degrees
		.map((d, i) => (d === 2 ? i : -1))
		.filter((i) => i >= 0);
	if (elbows.length !== 1) return null;
	if (degrees.filter((d) => d === 1).length !== 2) return null;
	return { vital: regionCells[elbows[0]!]! };
}

/**
 * Interior groups that border a T1 nakade big-eye and would have fewer than
 * 2 true eyes after an opponent vital fill are dead at scoring (M76). Edge
 * foothold + seki clusters kept (same exemptions as deadStones/Benson).
 * This removes Benson-alive dual one-eyed blocks that share a 3-cell corridor
 * — a shape deadStones clears but Benson keeps.
 */
export function findNakadeDeadCells(
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
	const deadGroupIds = new Set<number>();

	for (const color of ["X", "O"] as const) {
		const colorGroups = groups.filter((g) => g.color === color);
		if (colorGroups.length === 0) continue;
		const stoneToGroup = new Map<string, number>();
		for (const g of colorGroups) {
			for (const p of g.stones) stoneToGroup.set(keyOf(p), g.id);
		}
		const regions = findColorOnlyEmptyRegions(
			grid,
			color,
			stoneToGroup,
			wrap,
			topology,
			graph
		);
		const attacker: Player = color === "X" ? "O" : "X";

		for (const region of regions) {
			const nakade = isNakadeVulnerableRegion(region.cells);
			if (!nakade) continue;
			const sim = simulateLibertyPlace(
				grid,
				nakade.vital,
				attacker,
				wrap,
				topology,
				graph
			);
			if (!sim) continue;
			const nextGrid: Grid = { ...grid, cells: sim.cells };

			for (const gid of Array.from(region.adjacentGroupIds)) {
				if (deadGroupIds.has(gid)) continue;
				const g = colorGroups.find((x) => x.id === gid);
				if (!g) continue;
				if (sekiIds.has(g.id)) continue;
				if (groupTouchesEdge(grid, g.stones, topology, graph)) continue;

				const rem = g.stones.filter((p) => getCell(nextGrid, p) === color);
				if (rem.length === 0) {
					deadGroupIds.add(gid);
					for (const p of g.stones) dead.push(p);
					continue;
				}
				const eyes = countTrueEyes(
					nextGrid,
					rem,
					color,
					wrap,
					topology,
					graph
				);
				if (eyes >= 2) continue;
				deadGroupIds.add(gid);
				for (const p of g.stones) dead.push(p);
			}
		}
	}
	return dead;
}

/** Clear nakade-dead stones from a grid copy (M76). */
export function removeNakadeDeadStones(
	grid: Grid,
	wrap: boolean = false,
	topology: GridTopology = "rectangle",
	graph?: GraphTopologyData
): Grid {
	const dead = findNakadeDeadCells(grid, wrap, topology, graph);
	if (dead.length === 0) return grid;
	let cells = grid.cells;
	for (const p of dead) {
		cells = setCell({ ...grid, cells }, p, null);
	}
	return { ...grid, cells };
}

/**
 * Interior groups that border a bent-3 (L) nakade big-eye and would have
 * fewer than 2 true eyes after an opponent vital fill are dead at scoring
 * (M86). Same exemptions as T1 nakade (edge + seki). Contrastable with
 * `nakadeDeath` (straight-only).
 */
export function findLNakadeDeadCells(
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
	const deadGroupIds = new Set<number>();

	for (const color of ["X", "O"] as const) {
		const colorGroups = groups.filter((g) => g.color === color);
		if (colorGroups.length === 0) continue;
		const stoneToGroup = new Map<string, number>();
		for (const g of colorGroups) {
			for (const p of g.stones) stoneToGroup.set(keyOf(p), g.id);
		}
		const regions = findColorOnlyEmptyRegions(
			grid,
			color,
			stoneToGroup,
			wrap,
			topology,
			graph
		);
		const attacker: Player = color === "X" ? "O" : "X";

		for (const region of regions) {
			const nakade = isLNakadeVulnerableRegion(region.cells);
			if (!nakade) continue;
			const sim = simulateLibertyPlace(
				grid,
				nakade.vital,
				attacker,
				wrap,
				topology,
				graph
			);
			if (!sim) continue;
			const nextGrid: Grid = { ...grid, cells: sim.cells };

			for (const gid of Array.from(region.adjacentGroupIds)) {
				if (deadGroupIds.has(gid)) continue;
				const g = colorGroups.find((x) => x.id === gid);
				if (!g) continue;
				if (sekiIds.has(g.id)) continue;
				if (groupTouchesEdge(grid, g.stones, topology, graph)) continue;

				const rem = g.stones.filter((p) => getCell(nextGrid, p) === color);
				if (rem.length === 0) {
					deadGroupIds.add(gid);
					for (const p of g.stones) dead.push(p);
					continue;
				}
				const eyes = countTrueEyes(
					nextGrid,
					rem,
					color,
					wrap,
					topology,
					graph
				);
				if (eyes >= 2) continue;
				deadGroupIds.add(gid);
				for (const p of g.stones) dead.push(p);
			}
		}
	}
	return dead;
}

/** Clear L-nakade-dead stones from a grid copy (M86). */
export function removeLNakadeDeadStones(
	grid: Grid,
	wrap: boolean = false,
	topology: GridTopology = "rectangle",
	graph?: GraphTopologyData
): Grid {
	const dead = findLNakadeDeadCells(grid, wrap, topology, graph);
	if (dead.length === 0) return grid;
	let cells = grid.cells;
	for (const p of dead) {
		cells = setCell({ ...grid, cells }, p, null);
	}
	return { ...grid, cells };
}

/**
 * Benson unconditional life for one color: iterative vital-region fixed point.
 * A chain set is unconditionally alive when every remaining chain has ≥2
 * regions that border only remaining chains of that color (M69).
 */
export function findBensonAliveGroupIds(
	grid: Grid,
	color: Player,
	wrap: boolean = false,
	topology: GridTopology = "rectangle",
	graph?: GraphTopologyData
): Set<number> {
	const groups = enumerateGroups(grid, wrap, topology, graph).filter(
		(g) => g.color === color
	);
	if (groups.length === 0) return new Set();

	const stoneToGroup = new Map<string, number>();
	for (const g of groups) {
		for (const p of g.stones) stoneToGroup.set(keyOf(p), g.id);
	}

	let X = new Set(groups.map((g) => g.id));
	let R = findColorOnlyEmptyRegions(
		grid,
		color,
		stoneToGroup,
		wrap,
		topology,
		graph
	);

	for (;;) {
		const Xnew = new Set<number>();
		for (const gid of Array.from(X)) {
			let vital = 0;
			for (const region of R) {
				if (region.adjacentGroupIds.has(gid)) vital += 1;
			}
			if (vital >= 2) Xnew.add(gid);
		}

		const Rnew = R.filter((region) => {
			for (const gid of Array.from(region.adjacentGroupIds)) {
				if (!Xnew.has(gid)) return false;
			}
			return region.adjacentGroupIds.size > 0;
		});

		const sameX =
			Xnew.size === X.size && Array.from(Xnew).every((id) => X.has(id));
		const sameR =
			Rnew.length === R.length &&
			Rnew.every((region, i) => region === R[i]);
		if (sameX && sameR) return Xnew;

		X = Xnew;
		R = Rnew;
		if (X.size === 0) return X;
	}
}

/**
 * Interior groups that are not Benson-unconditionally alive are dead at
 * scoring (M69). Edge foothold and seki clusters are kept — same as M68.
 */
export function findBensonDeadStoneCells(
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

	const alive = new Set<number>([
		...Array.from(findBensonAliveGroupIds(grid, "X", wrap, topology, graph)),
		...Array.from(findBensonAliveGroupIds(grid, "O", wrap, topology, graph))
	]);

	const dead: Position[] = [];
	for (const g of groups) {
		if (sekiIds.has(g.id)) continue;
		if (groupTouchesEdge(grid, g.stones, topology, graph)) continue;
		if (alive.has(g.id)) continue;
		for (const p of g.stones) dead.push(p);
	}
	return dead;
}

/** Clear Benson-dead stones from a grid copy (M69). */
export function removeBensonDeadStones(
	grid: Grid,
	wrap: boolean = false,
	topology: GridTopology = "rectangle",
	graph?: GraphTopologyData
): Grid {
	const dead = findBensonDeadStoneCells(grid, wrap, topology, graph);
	if (dead.length === 0) return grid;
	let cells = grid.cells;
	for (const p of dead) {
		cells = setCell({ ...grid, cells }, p, null);
	}
	return { ...grid, cells };
}

function parseLibertyKey(k: string): Position {
	const comma = k.indexOf(",");
	return {
		row: Number(k.slice(0, comma)),
		col: Number(k.slice(comma + 1))
	};
}

function libertyPositionsOf(
	grid: Grid,
	stones: Position[],
	wrap: boolean,
	topology: GridTopology,
	graph?: GraphTopologyData
): Position[] {
	return Array.from(libertySetOf(grid, stones, wrap, topology, graph)).map(
		parseLibertyKey
	);
}

/**
 * Attacker-sente ladder / atari-run lite (M73): opponent can force-capture
 * `stones` by filling liberties while the runner stays at ≤1 liberty after
 * each attacker move. Defender replies considered: play the remaining
 * liberty, or capture the stone just played when that fill is legal.
 */
export function isLadderDeadGroup(
	grid: Grid,
	stones: Position[],
	color: Player,
	wrap: boolean = false,
	topology: GridTopology = "rectangle",
	graph?: GraphTopologyData
): boolean {
	if (stones.length === 0) return false;
	const attacker: Player = color === "X" ? "O" : "X";
	const maxDepth = grid.width * grid.height;
	const originalKeys = stones.map(keyOf);

	const remainingOf = (g: Grid): Position[] => {
		const out: Position[] = [];
		for (const k of originalKeys) {
			const p = parseLibertyKey(k);
			if (getCell(g, p) === color) out.push(p);
		}
		return out;
	};

	const groupOn = (g: Grid, rem: Position[]): Position[] => {
		if (rem.length === 0) return [];
		return findGroup(g, rem[0]!, wrap, topology, graph);
	};

	const attackerCanCapture = (g: Grid, depth: number): boolean => {
		if (depth > maxDepth) return false;
		const rem = remainingOf(g);
		if (rem.length === 0) return true;
		const group = groupOn(g, rem);
		const libs = libertyPositionsOf(g, group, wrap, topology, graph);
		if (libs.length === 0) return true;
		if (libs.length > 2) return false;

		const tryFill = (fill: Position): boolean => {
			const sim = simulateLibertyPlace(
				g,
				fill,
				attacker,
				wrap,
				topology,
				graph
			);
			if (!sim) return false;
			const next: Grid = { ...g, cells: sim.cells };
			if (remainingOf(next).length === 0) return true;
			const nextRem = remainingOf(next);
			const nextGroup = groupOn(next, nextRem);
			const nextLibs = libertyPositionsOf(
				next,
				nextGroup,
				wrap,
				topology,
				graph
			);
			// After attacker fill the runner must stay under pressure (≤1 liberty).
			if (nextLibs.length >= 2) return false;
			return defenderForced(next, fill, depth + 1);
		};

		if (libs.length === 1) {
			return tryFill(libs[0]!);
		}

		// Exactly two liberties: try either first fill.
		for (const fill of libs) {
			if (tryFill(fill)) return true;
		}
		return false;
	};

	const defenderForced = (
		g: Grid,
		lastAttack: Position,
		depth: number
	): boolean => {
		if (depth > maxDepth) return false;
		const rem = remainingOf(g);
		if (rem.length === 0) return true;
		const group = groupOn(g, rem);
		const libs = libertyPositionsOf(g, group, wrap, topology, graph);
		if (libs.length >= 2) return false;
		if (libs.length === 0) return true;

		const replyKeys = new Set<string>();
		for (const p of libs) replyKeys.add(keyOf(p));
		if (getCell(g, lastAttack) === attacker) {
			const atkGroup = findGroup(g, lastAttack, wrap, topology, graph);
			const atkLibs = libertyPositionsOf(
				g,
				atkGroup,
				wrap,
				topology,
				graph
			);
			if (atkLibs.length === 1) replyKeys.add(keyOf(atkLibs[0]!));
		}

		let anyLegal = false;
		for (const rk of Array.from(replyKeys)) {
			const reply = parseLibertyKey(rk);
			const sim = simulateLibertyPlace(
				g,
				reply,
				color,
				wrap,
				topology,
				graph
			);
			if (!sim) continue;
			anyLegal = true;
			const next: Grid = { ...g, cells: sim.cells };
			if (!attackerCanCapture(next, depth + 1)) return false;
		}
		if (!anyLegal) return attackerCanCapture(g, depth + 1);
		return true;
	};

	return attackerCanCapture(grid, 0);
}

/**
 * Groups force-capturable by an attacker-sente ladder / atari-run at scoring
 * (M73). Unlike deadStones/Benson, edge foothold does not save a laddered
 * runner. Seki exemption is intentionally omitted: the lite seki detector can
 * cluster true atari/ladder stones with neighbors, and a force-capturable
 * group is not shared-life.
 */
export function findLadderDeadCells(
	grid: Grid,
	wrap: boolean = false,
	topology: GridTopology = "rectangle",
	graph?: GraphTopologyData
): Position[] {
	const groups = enumerateGroups(grid, wrap, topology, graph);
	const dead: Position[] = [];
	for (const g of groups) {
		if (
			!isLadderDeadGroup(grid, g.stones, g.color, wrap, topology, graph)
		) {
			continue;
		}
		for (const p of g.stones) dead.push(p);
	}
	return dead;
}

/** Clear ladder-dead stones from a grid copy (M73). */
export function removeLadderDeadStones(
	grid: Grid,
	wrap: boolean = false,
	topology: GridTopology = "rectangle",
	graph?: GraphTopologyData
): Grid {
	const dead = findLadderDeadCells(grid, wrap, topology, graph);
	if (dead.length === 0) return grid;
	let cells = grid.cells;
	for (const p of dead) {
		cells = setCell({ ...grid, cells }, p, null);
	}
	return { ...grid, cells };
}

/**
 * Attacker-sente net / geta search (M77/M78): opponent can force-capture
 * `stones` when the group starts with exactly `rootLibertyExact` liberties
 * (ladderDeath domain is ≤2). Every legal defender liberty extension has an
 * attacker liberty-fill reply that either captures, leaves a ladder, or
 * re-nets. Edge foothold does not save (parity with ladderDeath).
 * M77 tight net: rootLibertyExact = 3; M78 loose net: 4.
 */
export function isNetDeadGroup(
	grid: Grid,
	stones: Position[],
	color: Player,
	wrap: boolean = false,
	topology: GridTopology = "rectangle",
	graph?: GraphTopologyData,
	rootLibertyExact: number = 3
): boolean {
	if (stones.length === 0) return true;
	const attacker: Player = color === "X" ? "O" : "X";
	const maxDepth = grid.width * grid.height;
	const originalKeys = stones.map(keyOf);

	const remainingOf = (g: Grid): Position[] => {
		const out: Position[] = [];
		for (const k of originalKeys) {
			const p = parseLibertyKey(k);
			if (getCell(g, p) === color) out.push(p);
		}
		return out;
	};

	const groupOn = (g: Grid, rem: Position[]): Position[] => {
		if (rem.length === 0) return [];
		return findGroup(g, rem[0]!, wrap, topology, graph);
	};

	const forceCapturable = (
		g: Grid,
		rem: Position[],
		depth: number
	): boolean => {
		if (rem.length === 0) return true;
		if (depth > maxDepth) return false;
		if (isLadderDeadGroup(g, rem, color, wrap, topology, graph)) {
			return true;
		}
		const libs = libertyPositionsOf(g, rem, wrap, topology, graph);
		// Recursive nets may reopen to ≥3 liberties after a reply.
		if (libs.length < 3) return false;
		return netDeadFrom(g, rem, depth, false);
	};

	const attackerHasReply = (
		g: Grid,
		rem: Position[],
		depth: number
	): boolean => {
		if (depth > maxDepth) return false;
		const group = groupOn(g, rem);
		const libs = libertyPositionsOf(g, group, wrap, topology, graph);
		for (const fill of libs) {
			const sim = simulateLibertyPlace(
				g,
				fill,
				attacker,
				wrap,
				topology,
				graph
			);
			if (!sim) continue;
			const next: Grid = { ...g, cells: sim.cells };
			const nextRem = remainingOf(next);
			if (forceCapturable(next, nextRem, depth + 1)) return true;
		}
		return false;
	};

	const netDeadFrom = (
		g: Grid,
		rem: Position[],
		depth: number,
		exactRoot: number | false
	): boolean => {
		if (depth > maxDepth) return false;
		const group = groupOn(g, rem);
		const libs = libertyPositionsOf(g, group, wrap, topology, graph);
		if (exactRoot !== false) {
			if (libs.length !== exactRoot) return false;
		} else if (libs.length < 3) {
			return false;
		}

		for (const escape of libs) {
			const sim = simulateLibertyPlace(
				g,
				escape,
				color,
				wrap,
				topology,
				graph
			);
			if (!sim) continue;
			const next: Grid = { ...g, cells: sim.cells };
			const nextRem = remainingOf(next);
			if (nextRem.length === 0) continue;
			if (!attackerHasReply(next, nextRem, depth + 1)) return false;
		}
		// No legal extension (all suicides) ⇒ already trapped.
		return true;
	};

	const rootLibs = libertyPositionsOf(grid, stones, wrap, topology, graph);
	// Root must match the mechanism's liberty gate (3 = tight net / M77;
	// 4 = loose net / M78). Not ladder (≤2); open fights above the gate
	// stay out of that mechanism's lite scope.
	if (rootLibs.length !== rootLibertyExact) return false;
	return netDeadFrom(grid, stones, 0, rootLibertyExact);
}

/**
 * Attacker-sente loose net (M78): same search as `isNetDeadGroup`, but root
 * must have exactly 4 liberties (tight net covers exactly 3).
 */
export function isLooseNetDeadGroup(
	grid: Grid,
	stones: Position[],
	color: Player,
	wrap: boolean = false,
	topology: GridTopology = "rectangle",
	graph?: GraphTopologyData
): boolean {
	return isNetDeadGroup(grid, stones, color, wrap, topology, graph, 4);
}

/**
 * Groups force-capturable by an attacker-sente net / geta at scoring (M77).
 * Root groups must have exactly 3 liberties (ladderDeath covers ≤2; loose
 * net covers 4). Edge foothold does not save. Seki exemption omitted for the
 * same reason as ladderDeath.
 */
export function findNetDeadCells(
	grid: Grid,
	wrap: boolean = false,
	topology: GridTopology = "rectangle",
	graph?: GraphTopologyData
): Position[] {
	const groups = enumerateGroups(grid, wrap, topology, graph);
	const dead: Position[] = [];
	for (const g of groups) {
		if (!isNetDeadGroup(grid, g.stones, g.color, wrap, topology, graph)) {
			continue;
		}
		for (const p of g.stones) dead.push(p);
	}
	return dead;
}

/** Clear net-dead stones from a grid copy (M77). */
export function removeNetDeadStones(
	grid: Grid,
	wrap: boolean = false,
	topology: GridTopology = "rectangle",
	graph?: GraphTopologyData
): Grid {
	const dead = findNetDeadCells(grid, wrap, topology, graph);
	if (dead.length === 0) return grid;
	let cells = grid.cells;
	for (const p of dead) {
		cells = setCell({ ...grid, cells }, p, null);
	}
	return { ...grid, cells };
}

/**
 * Groups force-capturable by an attacker-sente loose net at scoring (M78).
 * Root groups must have exactly 4 liberties. Edge foothold does not save.
 */
export function findLooseNetDeadCells(
	grid: Grid,
	wrap: boolean = false,
	topology: GridTopology = "rectangle",
	graph?: GraphTopologyData
): Position[] {
	const groups = enumerateGroups(grid, wrap, topology, graph);
	const dead: Position[] = [];
	for (const g of groups) {
		if (
			!isLooseNetDeadGroup(grid, g.stones, g.color, wrap, topology, graph)
		) {
			continue;
		}
		for (const p of g.stones) dead.push(p);
	}
	return dead;
}

/** Clear loose-net-dead stones from a grid copy (M78). */
export function removeLooseNetDeadStones(
	grid: Grid,
	wrap: boolean = false,
	topology: GridTopology = "rectangle",
	graph?: GraphTopologyData
): Grid {
	const dead = findLooseNetDeadCells(grid, wrap, topology, graph);
	if (dead.length === 0) return grid;
	let cells = grid.cells;
	for (const p of dead) {
		cells = setCell({ ...grid, cells }, p, null);
	}
	return { ...grid, cells };
}

/**
 * Attacker-sente 3-lib → ladder collapse (M79): root exactly 3 liberties;
 * multi-stone group (≥2); some attacker liberty-fill either captures
 * immediately or leaves a ladder-dead group. Unlike `isNetDeadGroup`
 * (defender-to-move escape search), this gives the attacker the first move.
 * Single-stone 3-lib shapes are out of scope (lite focuses on pair/geta
 * cages). Edge foothold does not save. Open cages that fail defender-first
 * nets but still ladder under one liberty atari are the unique seam.
 */
export function isSenteLadderDeadGroup(
	grid: Grid,
	stones: Position[],
	color: Player,
	wrap: boolean = false,
	topology: GridTopology = "rectangle",
	graph?: GraphTopologyData
): boolean {
	if (stones.length < 2) return false;
	const attacker: Player = color === "X" ? "O" : "X";
	const rootLibs = libertyPositionsOf(grid, stones, wrap, topology, graph);
	if (rootLibs.length !== 3) return false;
	const originalKeys = stones.map(keyOf);

	for (const fill of rootLibs) {
		const sim = simulateLibertyPlace(
			grid,
			fill,
			attacker,
			wrap,
			topology,
			graph
		);
		if (!sim) continue;
		const next: Grid = { ...grid, cells: sim.cells };
		const rem: Position[] = [];
		for (const k of originalKeys) {
			const p = parseLibertyKey(k);
			if (getCell(next, p) === color) rem.push(p);
		}
		if (rem.length === 0) return true;
		if (isLadderDeadGroup(next, rem, color, wrap, topology, graph)) {
			return true;
		}
	}
	return false;
}

/**
 * Groups force-capturable by an attacker-sente 3-lib → ladder fill at
 * scoring (M79). Root exactly 3 liberties. Edge foothold does not save.
 */
export function findSenteLadderDeadCells(
	grid: Grid,
	wrap: boolean = false,
	topology: GridTopology = "rectangle",
	graph?: GraphTopologyData
): Position[] {
	const groups = enumerateGroups(grid, wrap, topology, graph);
	const dead: Position[] = [];
	for (const g of groups) {
		if (
			!isSenteLadderDeadGroup(
				grid,
				g.stones,
				g.color,
				wrap,
				topology,
				graph
			)
		) {
			continue;
		}
		for (const p of g.stones) dead.push(p);
	}
	return dead;
}

/** Clear sente-ladder-dead stones from a grid copy (M79). */
export function removeSenteLadderDeadStones(
	grid: Grid,
	wrap: boolean = false,
	topology: GridTopology = "rectangle",
	graph?: GraphTopologyData
): Grid {
	const dead = findSenteLadderDeadCells(grid, wrap, topology, graph);
	if (dead.length === 0) return grid;
	let cells = grid.cells;
	for (const p of dead) {
		cells = setCell({ ...grid, cells }, p, null);
	}
	return { ...grid, cells };
}

/**
 * Approach-move net (M80): multi-stone group with exactly 3 or 4 root liberties
 * that is not already net / loose-net / sente-ladder / ladder dead, but becomes
 * net-dead or loose-net-dead after one attacker place on a cell that is **not**
 * a current liberty (an approach / kakari that closes the cage). Distinct from
 * senteLadderDeath (liberty-fill → ladder) and from defender-first nets that
 * already succeed without the approach. Edge foothold does not save.
 */
export function isApproachNetDeadGroup(
	grid: Grid,
	stones: Position[],
	color: Player,
	wrap: boolean = false,
	topology: GridTopology = "rectangle",
	graph?: GraphTopologyData
): boolean {
	if (stones.length < 2) return false;
	const rootLibs = libertyPositionsOf(grid, stones, wrap, topology, graph);
	if (rootLibs.length !== 3 && rootLibs.length !== 4) return false;
	if (isLadderDeadGroup(grid, stones, color, wrap, topology, graph)) {
		return false;
	}
	if (isNetDeadGroup(grid, stones, color, wrap, topology, graph)) {
		return false;
	}
	if (isLooseNetDeadGroup(grid, stones, color, wrap, topology, graph)) {
		return false;
	}
	if (isSenteLadderDeadGroup(grid, stones, color, wrap, topology, graph)) {
		return false;
	}

	const attacker: Player = color === "X" ? "O" : "X";
	const libKeys = new Set(rootLibs.map(keyOf));
	const originalKeys = stones.map(keyOf);

	for (let row = 0; row < grid.height; row++) {
		for (let col = 0; col < grid.width; col++) {
			const A: Position = { row, col };
			const ak = keyOf(A);
			if (libKeys.has(ak)) continue;
			if (getCell(grid, A) !== null) continue;
			if (!isActivePosition(A, topology, graph)) continue;
			const sim = simulateLibertyPlace(
				grid,
				A,
				attacker,
				wrap,
				topology,
				graph
			);
			if (!sim) continue;
			const next: Grid = { ...grid, cells: sim.cells };
			const rem: Position[] = [];
			for (const k of originalKeys) {
				const p = parseLibertyKey(k);
				if (getCell(next, p) === color) rem.push(p);
			}
			if (rem.length === 0) continue;
			if (
				isNetDeadGroup(next, rem, color, wrap, topology, graph) ||
				isLooseNetDeadGroup(next, rem, color, wrap, topology, graph)
			) {
				return true;
			}
		}
	}
	return false;
}

/**
 * Groups force-capturable by an approach-move net at scoring (M80). Root
 * exactly 3 or 4 liberties. Edge foothold does not save.
 */
export function findApproachNetDeadCells(
	grid: Grid,
	wrap: boolean = false,
	topology: GridTopology = "rectangle",
	graph?: GraphTopologyData
): Position[] {
	const groups = enumerateGroups(grid, wrap, topology, graph);
	const dead: Position[] = [];
	for (const g of groups) {
		if (
			!isApproachNetDeadGroup(
				grid,
				g.stones,
				g.color,
				wrap,
				topology,
				graph
			)
		) {
			continue;
		}
		for (const p of g.stones) dead.push(p);
	}
	return dead;
}

/** Clear approach-net-dead stones from a grid copy (M80). */
export function removeApproachNetDeadStones(
	grid: Grid,
	wrap: boolean = false,
	topology: GridTopology = "rectangle",
	graph?: GraphTopologyData
): Grid {
	const dead = findApproachNetDeadCells(grid, wrap, topology, graph);
	if (dead.length === 0) return grid;
	let cells = grid.cells;
	for (const p of dead) {
		cells = setCell({ ...grid, cells }, p, null);
	}
	return { ...grid, cells };
}

/**
 * Capturing-race (semeai) lite (M75): a group is dead when it shares ≥1 liberty
 * with an opposing group that has strictly more liberties. Equal counts against
 * all shared opponents keep both sides (seki-like). Unlike ladderDeath, this is
 * a static inter-group liberty comparison — groups with >2 liberties can still
 * lose. Unlike seki, unequal races are not treated as mutual life.
 */
export function findSemeaiDeadCells(
	grid: Grid,
	wrap: boolean = false,
	topology: GridTopology = "rectangle",
	graph?: GraphTopologyData
): Position[] {
	const groups = enumerateGroups(grid, wrap, topology, graph);
	const dead: Position[] = [];
	for (const g of groups) {
		let maxOpp = 0;
		let shares = false;
		for (const h of groups) {
			if (h.color === g.color) continue;
			let share = false;
			for (const lib of Array.from(g.liberties)) {
				if (h.liberties.has(lib)) {
					share = true;
					break;
				}
			}
			if (!share) continue;
			shares = true;
			if (h.liberties.size > maxOpp) maxOpp = h.liberties.size;
		}
		if (!shares || g.liberties.size >= maxOpp) continue;
		for (const p of g.stones) dead.push(p);
	}
	return dead;
}

/** Clear semeai-dead stones from a grid copy (M75). */
export function removeSemeaiDeadStones(
	grid: Grid,
	wrap: boolean = false,
	topology: GridTopology = "rectangle",
	graph?: GraphTopologyData
): Grid {
	const dead = findSemeaiDeadCells(grid, wrap, topology, graph);
	if (dead.length === 0) return grid;
	let cells = grid.cells;
	for (const p of dead) {
		cells = setCell({ ...grid, cells }, p, null);
	}
	return { ...grid, cells };
}

/**
 * Remove stones whose keys appear in `markedKeys` (`row,col`). Used when
 * interactive dead-stone marking confirms (two passes in markingPhase).
 */
export function removeMarkedDeadStones(
	grid: Grid,
	markedKeys: readonly string[]
): Grid {
	if (markedKeys.length === 0) return grid;
	const dead = new Set(markedKeys);
	let cells = grid.cells;
	for (let row = 0; row < grid.height; row++) {
		for (let col = 0; col < grid.width; col++) {
			const k = `${row},${col}`;
			if (!dead.has(k)) continue;
			if (getCell({ ...grid, cells }, { row, col }) == null) continue;
			cells = setCell({ ...grid, cells }, { row, col }, null);
		}
	}
	return { ...grid, cells };
}

/**
 * Empty cells in mixed-border or edge-open regions (dame) — score for neither
 * under simplified area scoring. Mono-border territory empties are excluded
 * (including seki-neutral mono regions, which are not dame-fill targets).
 */
export function findDameCells(
	grid: Grid,
	wrap: boolean = false,
	topology: GridTopology = "rectangle",
	graph?: GraphTopologyData
): Position[] {
	const dame: Position[] = [];
	const seedPositions = seedPositionsFor(grid, topology, graph);
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

		if (border.size !== 1) {
			dame.push(...region);
		}
	}
	return dame;
}

/**
 * Empty mono-border regions only (Japanese-style territory points).
 * Mixed-border or edge-open empties score for neither (dame). Same flood /
 * sekiNeutral rules as {@link scoreArea}, without counting on-board stones.
 */
export function scoreTerritory(
	grid: Grid,
	wrap: boolean = false,
	topology: GridTopology = "rectangle",
	graph?: GraphTopologyData,
	sekiNeutral?: Set<string>
): AreaScore {
	const score: AreaScore = { X: 0, O: 0 };
	const seedPositions = seedPositionsFor(grid, topology, graph);
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

	const territory = scoreTerritory(grid, wrap, topology, graph, sekiNeutral);
	score.X += territory.X;
	score.O += territory.O;

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
 * When `bensonLife` is true, interior groups that are not Benson-
 * unconditionally alive are removed instead (M69; supersedes deadStones
 * when both are set — richer vital-region life).
 * When `ladderDeath` is true, attacker-sente ladder / atari-run groups are
 * removed after optional Benson/deadStones clearance (M73; edge runners
 * included — the seam M68/M69 intentionally keep).
 * When `semeaiDeath` is true, groups that lose a capturing race against a
 * higher-liberty opponent sharing a liberty are removed after optional
 * Benson/deadStones and before nakadeDeath / ladderDeath (M75).
 * When `nakadeDeath` is true, interior groups bordering a T1 (3-straight)
 * nakade big-eye that would have <2 true eyes after an opponent vital fill
 * are removed after optional semeaiDeath and before lNakadeDeath / netDeath /
 * ladderDeath (M76). When `lNakadeDeath` is true, the same vital-fill path
 * for bent-3 (L) big-eyes runs after optional nakadeDeath and before
 * netDeath (M86). When `netDeath` is true, groups force-capturable by an
 * attacker-sente tight net / geta (exactly 3 root liberties; every escape
 * has a finishing reply) are removed after optional nakadeDeath /
 * lNakadeDeath and before looseNetDeath / senteLadderDeath / ladderDeath
 * (M77). When `looseNetDeath` is true, the same search with exactly 4 root
 * liberties runs after netDeath and before senteLadderDeath / ladderDeath
 * (M78). When `senteLadderDeath` is true, multi-stone groups with exactly 3
 * root liberties that collapse to a ladder (or capture) under one attacker
 * liberty-fill are removed after optional looseNetDeath and before
 * ladderDeath (M79; attacker-first polarity vs defender-first netDeath;
 * single-stone 3-lib shapes omitted). When `approachNetDeath` is true,
 * multi-stone groups with exactly 3 or 4 root liberties that become
 * net/loose-net dead after one non-liberty approach place are removed after
 * optional senteLadderDeath and before ladderDeath (M80). When
 * `territoryPrisoners` is true, score is territory + prisoners (Japanese
 * lite) instead of stones + territory (M74); `prisoners` tallies captures
 * in play.
 */
export function areaOutcome(
	grid: Grid,
	wrap: boolean = false,
	topology: GridTopology = "rectangle",
	graph?: GraphTopologyData,
	komi: number = 0,
	sekiScoring: boolean = false,
	deadStones: boolean = false,
	bensonLife: boolean = false,
	ladderDeath: boolean = false,
	territoryPrisoners: boolean = false,
	prisoners: AreaScore = { X: 0, O: 0 },
	semeaiDeath: boolean = false,
	nakadeDeath: boolean = false,
	netDeath: boolean = false,
	looseNetDeath: boolean = false,
	senteLadderDeath: boolean = false,
	approachNetDeath: boolean = false,
	lNakadeDeath: boolean = false
): {
	status: "won" | "draw";
	winner: Player | null;
	score: AreaScore;
} {
	let scored = bensonLife
		? removeBensonDeadStones(grid, wrap, topology, graph)
		: deadStones
			? removeDeadStones(grid, wrap, topology, graph)
			: grid;
	if (semeaiDeath) {
		scored = removeSemeaiDeadStones(scored, wrap, topology, graph);
	}
	if (nakadeDeath) {
		scored = removeNakadeDeadStones(scored, wrap, topology, graph);
	}
	if (lNakadeDeath) {
		scored = removeLNakadeDeadStones(scored, wrap, topology, graph);
	}
	if (netDeath) {
		scored = removeNetDeadStones(scored, wrap, topology, graph);
	}
	if (looseNetDeath) {
		scored = removeLooseNetDeadStones(scored, wrap, topology, graph);
	}
	if (senteLadderDeath) {
		scored = removeSenteLadderDeadStones(scored, wrap, topology, graph);
	}
	if (approachNetDeath) {
		scored = removeApproachNetDeadStones(scored, wrap, topology, graph);
	}
	if (ladderDeath) {
		scored = removeLadderDeadStones(scored, wrap, topology, graph);
	}
	const neutral = sekiScoring
		? findSekiNeutralCells(scored, wrap, topology, graph)
		: undefined;
	const raw = territoryPrisoners
		? (() => {
				const t = scoreTerritory(scored, wrap, topology, graph, neutral);
				return {
					X: t.X + (prisoners.X ?? 0),
					O: t.O + (prisoners.O ?? 0)
				};
			})()
		: scoreArea(scored, wrap, topology, graph, neutral);
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
