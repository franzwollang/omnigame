// Win detection with decomposed adjacency (rectangle or hex_offset)

import type { Grid, Player, Position } from "./types";
import { inBounds } from "@/engine/adjacency";
import {
	getWinAdjFuncs,
	type GridTopology,
	type WinAdjFunc
} from "@/engine/topology";
import { getCell } from "./types";

export type AdjacencyConfig = {
	mode: "linear" | "composite";
	horizontal: boolean;
	vertical: boolean;
	backDiagonal: boolean;
	forwardDiagonal: boolean;
};

function posKey(pos: Position): string {
	return `${pos.row},${pos.col}`;
}

/** Expand along one directional adj func to find winLength consecutive cells. */
function recursiveCheck(
	grid: Grid,
	player: Player,
	pos: Position,
	adjFunc: WinAdjFunc,
	winLength: number,
	currentLength: number = 1,
	memo: Set<string> = new Set()
): boolean {
	if (currentLength >= winLength) return true;

	const key = posKey(pos);
	memo.add(key);

	const adjacents = adjFunc(pos)
		.filter((adj) => !memo.has(posKey(adj)))
		.filter((adj) => inBounds(grid, adj))
		.filter((adj) => getCell(grid, adj) === player);

	for (const adj of adjacents) {
		if (
			recursiveCheck(
				grid,
				player,
				adj,
				adjFunc,
				winLength,
				currentLength + 1,
				memo
			)
		) {
			return true;
		}
	}

	return false;
}

/** Check if player has won with given config (topology-aware directions). */
export function checkWinner(
	grid: Grid,
	player: Player,
	winLength: number,
	adjacencyConfig: AdjacencyConfig,
	topology: GridTopology = "rectangle"
): boolean {
	const adjFuncs = getWinAdjFuncs(adjacencyConfig, topology);
	if (adjFuncs.length === 0) return false;

	const playerCells: Position[] = [];
	for (let row = 0; row < grid.height; row++) {
		for (let col = 0; col < grid.width; col++) {
			const pos = { row, col };
			if (getCell(grid, pos) === player) {
				playerCells.push(pos);
			}
		}
	}

	if (adjacencyConfig.mode === "linear") {
		for (const adjFunc of adjFuncs) {
			for (const startPos of playerCells) {
				if (recursiveCheck(grid, player, startPos, adjFunc, winLength)) {
					return true;
				}
			}
		}
		return false;
	}

	const compositeAdj: WinAdjFunc = (pos) => adjFuncs.flatMap((f) => f(pos));
	for (const startPos of playerCells) {
		if (recursiveCheck(grid, player, startPos, compositeAdj, winLength)) {
			return true;
		}
	}
	return false;
}
