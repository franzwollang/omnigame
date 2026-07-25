import type { Grid, Player, Position, CellValue } from "@/engine/types";
import type { AdjacencyConfig } from "@/engine/rules";
import { getEnabledDirections, step } from "@/engine/adjacency";
import { getCell, setCell } from "@/engine/types";

// Reversi-style capture: from placed position, in each direction, collect opponent tokens until a friendly token closes the line; flip collected.
export function applyCaptureIfAny(
	grid: Grid,
	placed: Position,
	currentPlayer: Player,
	adjacency: AdjacencyConfig,
	wrap: boolean = false
): CellValue[] {
	const opponent: Player = currentPlayer === "X" ? "O" : "X";
	let cells = grid.cells;

	const dirs = getEnabledDirections(adjacency);

	if (adjacency.mode === "linear") {
		for (const d of dirs) {
			const captured: Position[] = [];
			let cur = step(grid, placed, d, wrap);
			let foundEnd = false;
			const seen = new Set<string>();
			while (cur) {
				const k = `${cur.row},${cur.col}`;
				if (seen.has(k)) break; // full wrap lap with no closer
				seen.add(k);
				const val = getCell({ ...grid, cells }, cur);
				if (val === opponent) {
					captured.push(cur);
					cur = step(grid, cur, d, wrap);
					continue;
				}
				if (val === currentPlayer) {
					foundEnd = captured.length > 0;
				}
				break;
			}
			if (foundEnd && captured.length > 0) {
				for (const p of captured) {
					cells = setCell({ ...grid, cells }, p, currentPlayer);
				}
			}
		}
	} else {
		// composite: allow bending along enabled directions
		const flipped = new Set<string>();
		const key = (p: Position) => `${p.row},${p.col}`;
		for (const d of dirs) {
			const start = step(grid, placed, d, wrap);
			if (
				!start ||
				getCell({ ...grid, cells }, start) !== opponent
			)
				continue;
			// DFS paths
			const stack: { path: Position[]; at: Position }[] = [
				{ path: [start], at: start }
			];
			while (stack.length) {
				const { path, at } = stack.pop()!;
				for (const nd of dirs) {
					const nxt = step(grid, at, nd, wrap);
					if (!nxt) continue;
					const val = getCell({ ...grid, cells }, nxt);
					if (
						val === opponent &&
						!path.some((p) => p.row === nxt.row && p.col === nxt.col)
					) {
						stack.push({ path: [...path, nxt], at: nxt });
						continue;
					}
					if (val === currentPlayer && path.length > 0) {
						for (const p of path) flipped.add(key(p));
					}
				}
			}
		}
		if (flipped.size > 0) {
			flipped.forEach((id) => {
				const parts = id.split(",");
				const r = parseInt(parts[0], 10);
				const c = parseInt(parts[1], 10);
				cells = setCell({ ...grid, cells }, { row: r, col: c }, currentPlayer);
			});
		}
	}

	return cells;
}
