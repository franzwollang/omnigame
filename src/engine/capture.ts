import type { Grid, Player, Position, CellValue } from "@/engine/types";
import type { AdjacencyConfig } from "@/engine/rules";
import { getEnabledDirections, inBounds } from "@/engine/adjacency";
import { getCell, setCell } from "@/engine/types";

// Reversi-style capture: from placed position, in each direction, collect opponent tokens until a friendly token closes the line; flip collected.
export function applyCaptureIfAny(
	grid: Grid,
	placed: Position,
	currentPlayer: Player,
	adjacency: AdjacencyConfig
): CellValue[] {
	const opponent: Player = currentPlayer === "X" ? "O" : "X";
	let cells = grid.cells;

	const dirs = getEnabledDirections(adjacency);

	if (adjacency.mode === "linear") {
		for (const d of dirs) {
			const captured: Position[] = [];
			let cur: Position = { row: placed.row + d.row, col: placed.col + d.col };
			let foundEnd = false;
			while (inBounds(grid, cur)) {
				const val = getCell({ ...grid, cells }, cur);
				if (val === opponent) {
					captured.push(cur);
					cur = { row: cur.row + d.row, col: cur.col + d.col };
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
			const start: Position = {
				row: placed.row + d.row,
				col: placed.col + d.col
			};
			if (
				!inBounds(grid, start) ||
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
					const nxt: Position = { row: at.row + nd.row, col: at.col + nd.col };
					if (!inBounds(grid, nxt)) continue;
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
