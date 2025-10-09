// Win detection with decomposed adjacency

import type { Grid, Player, Position } from "./types";
import { getEnabledDirections } from "@/engine/adjacency";
import { getCell } from "./types";

export type AdjacencyConfig = {
	mode: "linear" | "composite";
	horizontal: boolean;
	vertical: boolean;
	backDiagonal: boolean;
	forwardDiagonal: boolean;
};

type AdjFunc = (pos: Position) => Position[];

// Adjacency functions (return neighbors in given direction)
const dirToAdjFunc =
	(d: Position): AdjFunc =>
	({ row, col }) =>
		[{ row: row + d.row, col: col + d.col }];

function getActiveAdjFuncs(config: AdjacencyConfig): AdjFunc[] {
	return getEnabledDirections(config).map(dirToAdjFunc);
}

function isInBounds(pos: Position, grid: Grid): boolean {
	return (
		pos.row >= 0 &&
		pos.row < grid.height &&
		pos.col >= 0 &&
		pos.col < grid.width
	);
}

function posKey(pos: Position): string {
	return `${pos.row},${pos.col}`;
}

// Recursive check from reference: expand from a starting position to find winLength consecutive cells
function recursiveCheck(
	grid: Grid,
	player: Player,
	pos: Position,
	adjFunc: AdjFunc,
	winLength: number,
	currentLength: number = 1,
	memo: Set<string> = new Set()
): boolean {
	if (currentLength >= winLength) return true;

	const key = posKey(pos);
	memo.add(key);

	const adjacents = adjFunc(pos)
		.filter((adj) => !memo.has(posKey(adj)))
		.filter((adj) => isInBounds(adj, grid))
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

// Check if player has won with given config
export function checkWinner(
	grid: Grid,
	player: Player,
	winLength: number,
	adjacencyConfig: AdjacencyConfig
): boolean {
	const adjFuncs = getActiveAdjFuncs(adjacencyConfig);
	if (adjFuncs.length === 0) return false;

	// Find all cells with this player's mark
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
		// Linear: check each adjacency direction independently
		for (const adjFunc of adjFuncs) {
			for (const startPos of playerCells) {
				if (recursiveCheck(grid, player, startPos, adjFunc, winLength)) {
					return true;
				}
			}
		}
		return false;
	} else {
		// Composite: combine all adjacency functions into one
		const compositeAdj: AdjFunc = (pos) => {
			return adjFuncs.flatMap((f) => f(pos));
		};
		for (const startPos of playerCells) {
			if (recursiveCheck(grid, player, startPos, compositeAdj, winLength)) {
				return true;
			}
		}
		return false;
	}
}
