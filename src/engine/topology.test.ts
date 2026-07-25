import { describe, expect, it } from "vitest";
import { compileConfig } from "@/compiler";
import {
	allActivePositions,
	buildGraphTopologyData,
	cubeToOffset,
	hexOffsetCenter,
	isActivePosition,
	neighbors,
	offsetToCube
} from "@/engine/topology";
import { checkWinner } from "@/engine/rules";
import { playerIdOf, type KernelAction } from "@/engine/kernel";
import { getCell, setCell, type Grid } from "@/engine/types";
import { examplePresets } from "@/presets/registry";
import { validateConfig } from "@/engine/validateConfig";
import { replayActions } from "@/ir/gameIr";

function makeGrid(width: number, height: number): Grid {
	return {
		width,
		height,
		cells: Array(width * height).fill(null)
	};
}

function place(grid: Grid, pos: { row: number; col: number }, player: "X" | "O"): Grid {
	return { ...grid, cells: setCell(grid, pos, player) };
}

describe("hex topology helpers", () => {
	it("round-trips odd-r offset ↔ cube", () => {
		for (const row of [0, 1, 2, 3]) {
			for (const col of [0, 1, 2, 3]) {
				const pos = { row, col };
				expect(cubeToOffset(offsetToCube(pos))).toEqual(pos);
			}
		}
	});

	it("gives six in-bounds neighbors in the middle of a hex board", () => {
		const grid = makeGrid(5, 5);
		const mid = { row: 2, col: 2 };
		expect(neighbors(grid, mid, "hex_offset")).toHaveLength(6);
		expect(
			neighbors(grid, { row: 0, col: 0 }, "hex_offset").length
		).toBeLessThan(6);
	});

	it("detects horizontal hex n-in-a-row via cube axes", () => {
		let grid = makeGrid(5, 5);
		for (const col of [0, 1, 2, 3]) {
			grid = place(grid, { row: 2, col }, "X");
		}
		const adj = {
			mode: "linear" as const,
			horizontal: true,
			vertical: false,
			backDiagonal: false,
			forwardDiagonal: false
		};
		expect(checkWinner(grid, "X", 4, adj, "hex_offset")).toBe(true);
		expect(checkWinner(grid, "X", 4, adj, "rectangle")).toBe(true);
	});

	it("detects a hex-axis line that is not a rectangle column", () => {
		// Cube axis (0,-1,+1): walk from an in-bounds start
		let grid = makeGrid(5, 5);
		let pos = { row: 3, col: 1 };
		const marks: { row: number; col: number }[] = [];
		for (let i = 0; i < 4; i++) {
			marks.push(pos);
			const c = offsetToCube(pos);
			pos = cubeToOffset({ q: c.q + 0, r: c.r - 1 });
		}
		for (const m of marks) {
			grid = place(grid, m, "X");
		}
		const hexOnlyAdj = {
			mode: "linear" as const,
			horizontal: false,
			vertical: true,
			backDiagonal: false,
			forwardDiagonal: false
		};
		expect(checkWinner(grid, "X", 4, hexOnlyAdj, "hex_offset")).toBe(true);
		const sameCol = marks.every((m) => m.col === marks[0].col);
		expect(sameCol).toBe(false);
		expect(checkWinner(grid, "X", 4, hexOnlyAdj, "rectangle")).toBe(false);
	});

	it("computes hex layout centers", () => {
		const a = hexOffsetCenter(0, 0, 1);
		const b = hexOffsetCenter(0, 1, 1);
		expect(b.x - a.x).toBeCloseTo(Math.sqrt(3));
		const c = hexOffsetCenter(1, 0, 1);
		expect(c.y - a.y).toBeCloseTo(1.5);
		expect(c.x - a.x).toBeCloseTo(Math.sqrt(3) * 0.5);
	});
});

describe("Hex Connect Lite (hex_offset topology)", () => {
	it("validates and compiles the hex-connect-lite preset", () => {
		const cfg = examplePresets["hex-connect-lite"].config;
		expect(validateConfig(cfg).ok).toBe(true);
		const { kernel, gameConfig } = compileConfig(cfg);
		expect(gameConfig.topology).toBe("hex_offset");
		expect(gameConfig.winLength).toBe(4);
		const state = kernel.initialState(cfg.rng.seed);
		expect(kernel.legalActions(state, 0).length).toBe(25);
	});

	it("rejects hex + gravity compositions", () => {
		const result = validateConfig({
			metadata: { name: "bad-hex", version: 1 },
			grid: { width: 5, height: 5, topology: "hex_offset", wrap: false },
			turn: { mode: "turn" },
			rng: { seed: 1 },
			input: { mode: "column" },
			placement: { mode: "gravity", overflow: "reject" },
			objective: { mode: "n_in_a_row" },
			win: {
				length: 4,
				adjacency: {
					mode: "linear",
					horizontal: true,
					vertical: true,
					backDiagonal: true,
					forwardDiagonal: true
				}
			}
		});
		expect(result.ok).toBe(false);
	});

	it("X wins with four in a hex line (compiler→kernel transcript)", () => {
		const cfg = examplePresets["hex-connect-lite"].config;
		const { kernel, gameConfig } = compileConfig(cfg);
		const script: Extract<KernelAction, { type: "place" }>[] = [
			{ type: "place", position: { row: 2, col: 0 } }, // X
			{ type: "place", position: { row: 0, col: 0 } }, // O
			{ type: "place", position: { row: 2, col: 1 } }, // X
			{ type: "place", position: { row: 0, col: 1 } }, // O
			{ type: "place", position: { row: 2, col: 2 } }, // X
			{ type: "place", position: { row: 0, col: 2 } }, // O
			{ type: "place", position: { row: 2, col: 3 } } // X wins
		];
		let state = kernel.initialState(cfg.rng.seed);
		for (const action of script) {
			const step = kernel.stepSync(state, action, cfg.rng.seed);
			state = step.nextState;
		}
		expect(state.status).toBe("won");
		expect(state.winner).toBe("X");
		expect(getCell(state.grid, { row: 2, col: 3 })).toBe("X");

		const replay = replayActions(gameConfig, script, cfg.rng.seed);
		expect(replay.faithful).toBe(true);
		expect(replay.finalState.status).toBe("won");
		expect(replay.finalState.winner).toBe("X");
		expect(playerIdOf("X")).toBe(0);
	});
});

describe("graph topology helpers", () => {
	const bridge = buildGraphTopologyData(
		[
			{ row: 0, col: 0 },
			{ row: 0, col: 1 },
			{ row: 0, col: 2 },
			{ row: 1, col: 1 },
			{ row: 2, col: 0 },
			{ row: 2, col: 2 }
		],
		[
			["0,0", "0,1"],
			["0,1", "0,2"],
			["0,1", "1,1"],
			["1,1", "2,0"],
			["1,1", "2,2"],
			["2,0", "2,2"]
		]
	);

	it("exposes only declared undirected neighbors", () => {
		const grid = makeGrid(3, 3);
		const hub = neighbors(grid, { row: 1, col: 1 }, "graph", bridge);
		expect(hub).toHaveLength(3);
		expect(hub).toEqual(
			expect.arrayContaining([
				{ row: 0, col: 1 },
				{ row: 2, col: 0 },
				{ row: 2, col: 2 }
			])
		);
		// Corner (0,0) is NOT a lattice neighbor of hub
		expect(hub.some((p) => p.row === 0 && p.col === 0)).toBe(false);
		expect(neighbors(grid, { row: 0, col: 0 }, "graph", bridge)).toEqual([
			{ row: 0, col: 1 }
		]);
	});

	it("detects a path win that is not a rectangle line", () => {
		let grid = makeGrid(3, 3);
		// Bottom triangle path: (2,0)-(1,1)-(2,2) — not collinear on a rectangle axis
		grid = place(grid, { row: 2, col: 0 }, "X");
		grid = place(grid, { row: 1, col: 1 }, "X");
		grid = place(grid, { row: 2, col: 2 }, "X");
		const adj = {
			mode: "composite" as const,
			horizontal: false,
			vertical: false,
			backDiagonal: false,
			forwardDiagonal: false
		};
		expect(checkWinner(grid, "X", 3, adj, "graph", bridge)).toBe(true);
		expect(checkWinner(grid, "X", 3, adj, "rectangle")).toBe(false);
	});

	it("ignores inactive embedding cells for active-position helpers", () => {
		const grid = makeGrid(3, 3);
		expect(isActivePosition({ row: 1, col: 0 }, "graph", bridge)).toBe(false);
		expect(allActivePositions(grid, "graph", bridge)).toHaveLength(6);
	});
});

describe("Graph Connect Lite (graph topology)", () => {
	it("validates and compiles the graph-connect-lite preset", () => {
		const cfg = examplePresets["graph-connect-lite"].config;
		expect(validateConfig(cfg).ok).toBe(true);
		const { kernel, gameConfig } = compileConfig(cfg);
		expect(gameConfig.topology).toBe("graph");
		expect(gameConfig.graph?.active).toHaveLength(6);
		expect(gameConfig.winLength).toBe(3);
		const state = kernel.initialState(cfg.rng.seed);
		expect(kernel.legalActions(state, 0).length).toBe(6);
	});

	it("rejects graph + gravity compositions", () => {
		const result = validateConfig({
			metadata: { name: "bad-graph", version: 1 },
			grid: {
				width: 3,
				height: 3,
				topology: "graph",
				wrap: false,
				nodes: [
					{ row: 0, col: 0 },
					{ row: 0, col: 1 }
				],
				edges: [["0,0", "0,1"]]
			},
			turn: { mode: "turn" },
			rng: { seed: 1 },
			input: { mode: "column" },
			placement: { mode: "gravity", overflow: "reject" },
			objective: { mode: "n_in_a_row" },
			win: {
				length: 2,
				adjacency: {
					mode: "composite",
					horizontal: false,
					vertical: false,
					backDiagonal: false,
					forwardDiagonal: false
				}
			}
		});
		expect(result.ok).toBe(false);
	});

	it("X wins along a graph path (compiler→kernel transcript)", () => {
		const cfg = examplePresets["graph-connect-lite"].config;
		const { kernel, gameConfig } = compileConfig(cfg);
		const script: Extract<KernelAction, { type: "place" }>[] = [
			{ type: "place", position: { row: 2, col: 0 } }, // X
			{ type: "place", position: { row: 0, col: 0 } }, // O
			{ type: "place", position: { row: 1, col: 1 } }, // X
			{ type: "place", position: { row: 0, col: 2 } }, // O
			{ type: "place", position: { row: 2, col: 2 } } // X wins via triangle path
		];
		let state = kernel.initialState(cfg.rng.seed);
		for (const action of script) {
			const step = kernel.stepSync(state, action, cfg.rng.seed);
			state = step.nextState;
		}
		expect(state.status).toBe("won");
		expect(state.winner).toBe("X");
		expect(getCell(state.grid, { row: 2, col: 2 })).toBe("X");
		// Inactive embedding cell never became playable
		expect(getCell(state.grid, { row: 1, col: 0 })).toBe(null);

		const replay = replayActions(gameConfig, script, cfg.rng.seed);
		expect(replay.faithful).toBe(true);
		expect(replay.finalState.status).toBe("won");
		expect(replay.finalState.winner).toBe("X");
		expect(playerIdOf("X")).toBe(0);
	});

	it("does not treat inactive cells as legal places", () => {
		const cfg = examplePresets["graph-connect-lite"].config;
		const { kernel } = compileConfig(cfg);
		let state = kernel.initialState(cfg.rng.seed);
		const step = kernel.stepSync(
			state,
			{ type: "place", position: { row: 1, col: 0 } },
			cfg.rng.seed
		);
		expect(step.events.some((e) => e.type === "ignored")).toBe(true);
		expect(step.nextState.moveCount).toBe(0);
	});
});
