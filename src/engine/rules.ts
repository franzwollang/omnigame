// Win detection with decomposed adjacency (rectangle, hex_offset, or graph)

import type { Grid, Player, Position } from "./types";
import { inBounds } from "@/engine/adjacency";
import {
	allActivePositions,
	getWinAdjFuncs,
	type GraphTopologyData,
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
				new Set(memo)
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
	topology: GridTopology = "rectangle",
	graph?: GraphTopologyData
): boolean {
	const adjFuncs = getWinAdjFuncs(adjacencyConfig, topology, graph);
	if (adjFuncs.length === 0) return false;

	const playerCells: Position[] = [];
	for (const pos of allActivePositions(grid, topology, graph)) {
		if (getCell(grid, pos) === player) {
			playerCells.push(pos);
		}
	}

	if (adjacencyConfig.mode === "linear" && topology !== "graph") {
		for (const adjFunc of adjFuncs) {
			for (const startPos of playerCells) {
				if (recursiveCheck(grid, player, startPos, adjFunc, winLength)) {
					return true;
				}
			}
		}
		return false;
	}

	// composite (and all graph wins): any path through neighbor edges
	const compositeAdj: WinAdjFunc = (pos) => adjFuncs.flatMap((f) => f(pos));
	for (const startPos of playerCells) {
		if (recursiveCheck(grid, player, startPos, compositeAdj, winLength)) {
			return true;
		}
	}
	return false;
}
