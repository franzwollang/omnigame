/**
 * Hit/miss observation-aware fire agent.
 *
 * Uses `kernel.observe` only (never the hidden fleet layer): after hits, hunt
 * orthogonal neighbors / line extensions; otherwise checkerboard parity search.
 * Full-info configs fall back to uniform random among legal actions.
 */
import type { CellValue, GameState, Position } from "@/engine/types";
import type {
	GameKernel,
	KernelAction,
	PlayerId,
	Seed
} from "@/engine/kernel";
import { mulberry32 } from "@/engine/rng";
import type { Agent } from "@/agents/types";

const ORTHO: ReadonlyArray<readonly [number, number]> = [
	[-1, 0],
	[1, 0],
	[0, -1],
	[0, 1]
];

function posKey(pos: Position): string {
	return `${pos.row},${pos.col}`;
}

function pickOne<T>(items: readonly T[], next: () => number): T {
	return items[Math.min(Math.floor(next() * items.length), items.length - 1)]!;
}

function fireActions(legal: readonly KernelAction[]): Array<
	Extract<KernelAction, { type: "fire" }>
> {
	const out: Array<Extract<KernelAction, { type: "fire" }>> = [];
	for (const a of legal) {
		if (a.type === "fire") out.push(a);
	}
	return out;
}

/**
 * Choose a fire action from observation cells (hits / misses / own ships).
 * Prefers: line extension > adjacent-to-hit > parity search > any legal fire.
 */
export function pickHuntFireAction(
	cells: readonly CellValue[],
	width: number,
	height: number,
	legal: readonly KernelAction[],
	next: () => number
): KernelAction | null {
	const fires = fireActions(legal);
	if (fires.length === 0) return null;

	const legalKeys = new Set(fires.map((a) => posKey(a.position)));
	const byKey = new Map(fires.map((a) => [posKey(a.position), a]));

	const hits: Position[] = [];
	for (let row = 0; row < height; row++) {
		for (let col = 0; col < width; col++) {
			if (cells[row * width + col] === "hit") {
				hits.push({ row, col });
			}
		}
	}

	const lineExtensions: Array<Extract<KernelAction, { type: "fire" }>> = [];
	const adjacentTargets: Array<Extract<KernelAction, { type: "fire" }>> = [];
	const seenAdj = new Set<string>();
	const seenExt = new Set<string>();

	for (const hit of hits) {
		for (const [dr, dc] of ORTHO) {
			const target = { row: hit.row + dr, col: hit.col + dc };
			const key = posKey(target);
			if (!legalKeys.has(key)) continue;
			const action = byKey.get(key)!;
			const back = { row: hit.row - dr, col: hit.col - dc };
			const backInBounds =
				back.row >= 0 &&
				back.col >= 0 &&
				back.row < height &&
				back.col < width;
			const extendsLine =
				backInBounds && cells[back.row * width + back.col] === "hit";
			if (extendsLine) {
				if (!seenExt.has(key)) {
					seenExt.add(key);
					lineExtensions.push(action);
				}
			} else if (!seenAdj.has(key)) {
				seenAdj.add(key);
				adjacentTargets.push(action);
			}
		}
	}

	if (lineExtensions.length > 0) return pickOne(lineExtensions, next);
	if (adjacentTargets.length > 0) return pickOne(adjacentTargets, next);

	// Checkerboard parity search among remaining unknown cells.
	const parity0 = fires.filter(
		(a) => (a.position.row + a.position.col) % 2 === 0
	);
	const parity1 = fires.filter(
		(a) => (a.position.row + a.position.col) % 2 === 1
	);
	const preferred =
		parity0.length >= parity1.length
			? parity0
			: parity1.length > 0
				? parity1
				: fires;
	return pickOne(preferred.length > 0 ? preferred : fires, next);
}

/** Observation-aware hunter for hit/miss; random otherwise. */
export function createHuntAgent(seed: Seed = 0): Agent {
	let next = mulberry32(seed >>> 0);

	return {
		kind: "hunt",
		reset(s: Seed) {
			next = mulberry32(s >>> 0);
		},
		act(
			kernel: GameKernel,
			state: GameState,
			player: PlayerId
		): KernelAction | null {
			const legal = kernel.legalActions(state, player);
			if (legal.length === 0) return null;

			if ((kernel.config.observationMode ?? "full") !== "hit_miss") {
				return pickOne(legal, next);
			}

			const observation = kernel.observe(state, player);
			const picked = pickHuntFireAction(
				observation.cells,
				state.grid.width,
				state.grid.height,
				legal,
				next
			);
			return picked ?? pickOne(legal, next);
		}
	};
}
