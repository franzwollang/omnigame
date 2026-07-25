import { describe, expect, it } from "vitest";
import { normalizePos, step } from "@/engine/adjacency";
import { neighbors } from "@/engine/topology";
import { checkWinner } from "@/engine/rules";
import { applyLifeStep, countAliveNeighbors } from "@/engine/scheduler";
import { createInitialState, reduce, type GameConfig } from "@/engine/reducer";
import { getCell, setCell, type Grid } from "@/engine/types";
import { zConfig } from "@/schemas/config";
import { examplePresets } from "@/presets/registry";
import { compileConfig } from "@/compiler";

const adjacencyAll = {
	mode: "linear" as const,
	horizontal: true,
	vertical: true,
	backDiagonal: true,
	forwardDiagonal: true
};

function emptyGrid(width: number, height: number): Grid {
	return {
		width,
		height,
		cells: Array(width * height).fill(null)
	};
}

describe("adjacency wrap helpers", () => {
	const grid = emptyGrid(3, 3);

	it("normalizePos wraps modularly", () => {
		expect(normalizePos(grid, { row: -1, col: 0 }, true)).toEqual({
			row: 2,
			col: 0
		});
		expect(normalizePos(grid, { row: 0, col: 3 }, true)).toEqual({
			row: 0,
			col: 0
		});
		expect(normalizePos(grid, { row: -1, col: 0 }, false)).toBeNull();
	});

	it("step wraps across edges", () => {
		expect(step(grid, { row: 0, col: 0 }, { row: -1, col: 0 }, true)).toEqual({
			row: 2,
			col: 0
		});
		expect(step(grid, { row: 0, col: 0 }, { row: 0, col: -1 }, true)).toEqual({
			row: 0,
			col: 2
		});
		expect(step(grid, { row: 0, col: 0 }, { row: -1, col: 0 }, false)).toBeNull();
	});

	it("rectangle neighbors include wrap-around corners", () => {
		const corner = neighbors(
			grid,
			{ row: 0, col: 0 },
			"rectangle",
			undefined,
			true
		);
		expect(corner).toHaveLength(8);
		expect(corner).toContainEqual({ row: 2, col: 2 });
		expect(corner).toContainEqual({ row: 0, col: 2 });
		expect(corner).toContainEqual({ row: 2, col: 0 });
	});
});

describe("schema: grid.wrap", () => {
	it("accepts wrap on rectangle and rejects on hex", () => {
		const base = examplePresets["tic-tac-toe"].config;
		expect(
			zConfig.safeParse({
				...base,
				grid: { ...base.grid, wrap: true }
			}).success
		).toBe(true);
		expect(
			zConfig.safeParse({
				...base,
				grid: { ...base.grid, topology: "hex_offset", wrap: true }
			}).success
		).toBe(false);
	});

	it("accepts toroidal-ttt preset", () => {
		const parsed = zConfig.safeParse(examplePresets["toroidal-ttt"].config);
		expect(parsed.success).toBe(true);
		expect(parsed.success && parsed.data.grid.wrap).toBe(true);
	});
});

describe("wrap win detection", () => {
	it("detects horizontal win across the east/west seam", () => {
		let grid = emptyGrid(4, 3);
		grid = { ...grid, cells: setCell(grid, { row: 1, col: 3 }, "X") };
		grid = { ...grid, cells: setCell(grid, { row: 1, col: 0 }, "X") };
		grid = { ...grid, cells: setCell(grid, { row: 1, col: 1 }, "X") };
		expect(
			checkWinner(grid, "X", 3, adjacencyAll, "rectangle", undefined, false)
		).toBe(false);
		expect(
			checkWinner(grid, "X", 3, adjacencyAll, "rectangle", undefined, true)
		).toBe(true);
	});
});

describe("transcript: Toroidal TTT wrap win", () => {
	const config: GameConfig = {
		gridWidth: 4,
		gridHeight: 3,
		gridWrap: true,
		winLength: 3,
		adjacency: adjacencyAll,
		inputMode: "cell",
		placementMode: "direct"
	};

	it("wins by wrapping across the horizontal seam", () => {
		let state = createInitialState(config);
		state = reduce(state, { type: "place", position: { row: 1, col: 3 } }, config);
		state = reduce(state, { type: "place", position: { row: 0, col: 0 } }, config);
		state = reduce(state, { type: "place", position: { row: 1, col: 0 } }, config);
		state = reduce(state, { type: "place", position: { row: 0, col: 1 } }, config);
		state = reduce(state, { type: "place", position: { row: 1, col: 1 } }, config);
		expect(state.status).toBe("won");
		expect(state.winner).toBe("X");
		expect(getCell(state.grid, { row: 1, col: 3 })).toBe("X");
		expect(getCell(state.grid, { row: 1, col: 0 })).toBe("X");
		expect(getCell(state.grid, { row: 1, col: 1 })).toBe("X");
	});

	it("kernel path plays toroidal-ttt preset", () => {
		const { kernel, gameConfig } = compileConfig(
			examplePresets["toroidal-ttt"].config
		);
		expect(gameConfig.gridWrap).toBe(true);
		let state = kernel.initialState();
		const places = [
			{ row: 0, col: 0 },
			{ row: 0, col: 1 },
			{ row: 1, col: 1 },
			{ row: 0, col: 2 },
			{ row: 2, col: 2 }
		];
		for (const position of places) {
			state = kernel.stepSync(state, { type: "place", position }).nextState;
		}
		expect(state.status).toBe("won");
		expect(state.winner).toBe("X");
	});
});

describe("wrap Life scheduler", () => {
	it("counts Moore neighbors across edges", () => {
		let grid = emptyGrid(3, 3);
		grid = { ...grid, cells: setCell(grid, { row: 0, col: 0 }, "X") };
		grid = { ...grid, cells: setCell(grid, { row: 0, col: 2 }, "X") };
		grid = { ...grid, cells: setCell(grid, { row: 2, col: 0 }, "X") };
		expect(countAliveNeighbors(grid, 0, 0, true)).toBe(2);
		expect(countAliveNeighbors(grid, 0, 0, false)).toBe(0);
	});

	it("rotates a blinker that straddles the wrap seam", () => {
		let grid = emptyGrid(5, 5);
		grid = { ...grid, cells: setCell(grid, { row: 4, col: 0 }, "X") };
		grid = { ...grid, cells: setCell(grid, { row: 0, col: 0 }, "X") };
		grid = { ...grid, cells: setCell(grid, { row: 1, col: 0 }, "X") };

		const next = applyLifeStep(grid, "life_b3s23", true);
		expect(isAliveish(next, { row: 0, col: 4 })).toBe(true);
		expect(isAliveish(next, { row: 0, col: 0 })).toBe(true);
		expect(isAliveish(next, { row: 0, col: 1 })).toBe(true);
		expect(isAliveish(next, { row: 4, col: 0 })).toBe(false);
		expect(isAliveish(next, { row: 1, col: 0 })).toBe(false);
	});
});

function isAliveish(grid: Grid, pos: { row: number; col: number }): boolean {
	const v = getCell(grid, pos);
	return v === "X" || v === "O";
}
