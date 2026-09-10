import { describe, expect, it } from "vitest";
import { compileConfig } from "@/compiler";
import {
	adjacentHazardCount,
	allSafeRevealed,
	floodRevealRegion,
	hazardNeighbors,
	isMineAt,
	mineCount,
	placeHazards
} from "@/engine/hazards";
import type { KernelAction } from "@/engine/kernel";
import { createGameKernel } from "@/engine/kernel";
import { createInitialState } from "@/engine/reducer";
import { buildGraphTopologyData } from "@/engine/topology";
import { getCell, toIndex } from "@/engine/types";
import { examplePresets } from "@/presets/registry";
import { validateConfig } from "@/engine/validateConfig";
import { replayActions } from "@/ir/gameIr";
import { zConfig } from "@/schemas/config";

describe("hazard helpers", () => {
	it("placeHazards is deterministic for a fixed seed", () => {
		const a = placeHazards(5, 5, 5, 42);
		const b = placeHazards(5, 5, 5, 42);
		expect(a).toEqual(b);
		expect(a.filter((c) => c === "mine")).toHaveLength(5);
	});

	it("placeHazards respects exclude (first-reveal-safe)", () => {
		const exclude = { row: 2, col: 2 };
		const cells = placeHazards(5, 5, 10, 7, [exclude]);
		expect(cells[toIndex(exclude, 5)]).toBeNull();
		expect(cells.filter((c) => c === "mine")).toHaveLength(10);
	});

	it("adjacentHazardCount counts 8-neighbors", () => {
		const cells = Array(9).fill(null) as (null | "mine")[];
		cells[0] = "mine"; // (0,0)
		cells[2] = "mine"; // (0,2)
		const hidden = { width: 3, height: 3, cells };
		expect(adjacentHazardCount(hidden, { row: 1, col: 1 })).toBe(2);
		expect(adjacentHazardCount(hidden, { row: 0, col: 1 })).toBe(2);
	});

	it("hex hazardNeighbors uses cube-axis-6, not Chebyshev-8", () => {
		const mid = { row: 1, col: 1 };
		const rect = hazardNeighbors(mid, 3, 3, "rectangle");
		const hex = hazardNeighbors(mid, 3, 3, "hex_offset");
		expect(rect).toHaveLength(8);
		expect(hex).toHaveLength(6);
		// A Chebyshev corner that is not cube-adjacent must not count on hex
		const rectOnly = rect.filter(
			(p) => !hex.some((h) => h.row === p.row && h.col === p.col)
		);
		expect(rectOnly.length).toBe(2);
		const cells = Array(9).fill(null) as (null | "mine")[];
		for (const p of rectOnly) {
			cells[toIndex(p, 3)] = "mine";
		}
		const hidden = { width: 3, height: 3, cells };
		expect(adjacentHazardCount(hidden, mid, "rectangle")).toBe(2);
		expect(adjacentHazardCount(hidden, mid, "hex_offset")).toBe(0);
	});

	it("hex floodRevealRegion expands on cube neighbors only", () => {
		const cells = Array(9).fill(null);
		cells[0] = "mine"; // (0,0)
		const hidden = { width: 3, height: 3, cells };
		const pub = { width: 3, height: 3, cells: Array(9).fill(null) };
		const flood = floodRevealRegion(
			hidden,
			pub,
			{ row: 2, col: 2 },
			"hex_offset"
		);
		expect(flood.positions.length).toBeGreaterThan(0);
		expect(
			flood.positions.some((p) => p.row === 0 && p.col === 0)
		).toBe(false);
		for (let i = 0; i < flood.positions.length; i++) {
			expect(flood.counts[i]).toBe(
				adjacentHazardCount(hidden, flood.positions[i]!, "hex_offset")
			);
			expect(flood.counts[i]!).toBeLessThanOrEqual(6);
		}
	});

	it("floodRevealRegion expands through zeros and stops at numbered frontier", () => {
		// 3x3 with one mine at corner (0,0)
		const cells = Array(9).fill(null);
		cells[0] = "mine";
		const hidden = { width: 3, height: 3, cells };
		const pub = { width: 3, height: 3, cells: Array(9).fill(null) };
		const flood = floodRevealRegion(hidden, pub, { row: 2, col: 2 });
		expect(flood.positions.length).toBeGreaterThan(1);
		const startIdx = flood.positions.findIndex(
			(p) => p.row === 2 && p.col === 2
		);
		expect(flood.counts[startIdx]).toBe(0);
		// Mine itself never revealed
		expect(
			flood.positions.some((p) => p.row === 0 && p.col === 0)
		).toBe(false);
		// Frontier adjacent to mine should appear with count > 0
		expect(
			flood.positions.some(
				(p) => p.row === 1 && p.col === 1 && flood.counts[flood.positions.indexOf(p)]! > 0
			) ||
				flood.positions.some((p) => adjacentHazardCount(hidden, p) > 0)
		).toBe(true);
	});
});

describe("Hex Minesweeper Lite (flood_reveal on hex_offset)", () => {
	it("validates and compiles the hex-minesweeper-lite preset", () => {
		const cfg = examplePresets["hex-minesweeper-lite"].config;
		expect(validateConfig(cfg).ok).toBe(true);
		const { gameConfig } = compileConfig(cfg);
		expect(gameConfig.observationMode).toBe("flood_reveal");
		expect(gameConfig.objectiveMode).toBe("clear_hazards");
		expect(gameConfig.topology).toBe("hex_offset");
		expect(gameConfig.hazards?.count).toBe(8);
		expect(gameConfig.hazards?.firstRevealSafe).toBe(true);
	});

	it("schema accepts hex flood_reveal and graph flood_reveal", () => {
		const hexOk = {
			...examplePresets["hex-minesweeper-lite"].config
		};
		expect(zConfig.safeParse(hexOk).success).toBe(true);

		const graphOk = {
			...examplePresets["graph-minesweeper-lite"].config
		};
		expect(zConfig.safeParse(graphOk).success).toBe(true);
	});

	it("mine hit on hex ends with opponent winner", () => {
		const cfg = zConfig.parse({
			metadata: { name: "Hex Mine Hit", version: 1 },
			grid: { width: 3, height: 3, topology: "hex_offset", wrap: false },
			turn: { mode: "turn" },
			rng: { seed: 2 },
			input: { mode: "cell" },
			placement: { mode: "direct", overflow: "reject" },
			observation: { mode: "flood_reveal" },
			hazards: { count: 1, firstRevealSafe: false },
			objective: { mode: "clear_hazards" },
			tokens: [],
			placements: [],
			initial: []
		});
		const { gameConfig } = compileConfig(cfg);
		const state = createInitialState(gameConfig);
		let minePos = { row: 0, col: 0 };
		for (let r = 0; r < 3; r++) {
			for (let c = 0; c < 3; c++) {
				if (isMineAt(state.hidden!, { row: r, col: c })) {
					minePos = { row: r, col: c };
				}
			}
		}
		const kernel = createGameKernel(gameConfig);
		const step = kernel.stepSync(state, { type: "reveal", position: minePos });
		expect(step.events.some((e) => e.type === "mineHit")).toBe(true);
		expect(step.nextState.status).toBe("won");
		expect(step.nextState.winner).toBe("O");
		expect(getCell(step.nextState.grid, minePos)).toBe("mine");
	});

	it("hex flood uses topology-aware counts in cellsRevealed", () => {
		const cfg = zConfig.parse({
			metadata: { name: "Hex Flood", version: 1 },
			grid: { width: 5, height: 5, topology: "hex_offset", wrap: false },
			turn: { mode: "turn" },
			rng: { seed: 1 },
			input: { mode: "cell" },
			placement: { mode: "direct", overflow: "reject" },
			observation: { mode: "flood_reveal" },
			hazards: { count: 4, firstRevealSafe: false },
			objective: { mode: "clear_hazards" },
			tokens: [],
			placements: [],
			initial: []
		});
		const { gameConfig } = compileConfig(cfg);
		const state = createInitialState(gameConfig);
		let start = { row: 0, col: 0 };
		let found = false;
		for (let r = 0; r < 5 && !found; r++) {
			for (let c = 0; c < 5 && !found; c++) {
				const p = { row: r, col: c };
				if (
					!isMineAt(state.hidden!, p) &&
					adjacentHazardCount(state.hidden!, p, "hex_offset") === 0
				) {
					start = p;
					found = true;
				}
			}
		}
		expect(found).toBe(true);
		const kernel = createGameKernel(gameConfig);
		const step = kernel.stepSync(state, { type: "reveal", position: start });
		const revealed = step.events.find((e) => e.type === "cellsRevealed");
		expect(revealed).toBeDefined();
		if (revealed && revealed.type === "cellsRevealed") {
			expect(revealed.positions.length).toBeGreaterThan(1);
			for (let i = 0; i < revealed.positions.length; i++) {
				expect(revealed.counts[i]).toBe(
					adjacentHazardCount(
						step.nextState.hidden!,
						revealed.positions[i]!,
						"hex_offset"
					)
				);
			}
		}
	});

	it("GameIR replay matches transcript for hex-minesweeper-lite", () => {
		const cfg = examplePresets["hex-minesweeper-lite"].config;
		const { gameConfig, kernel } = compileConfig(cfg);
		const actions: KernelAction[] = [
			{ type: "reveal", position: { row: 0, col: 0 } },
			{ type: "reveal", position: { row: 5, col: 5 } }
		];
		let state = kernel.initialState(cfg.rng.seed);
		for (const action of actions) {
			const step = kernel.stepSync(state, action);
			state = step.nextState;
		}
		const replayed = replayActions(gameConfig, actions, cfg.rng.seed);
		expect(replayed.finalState.grid.cells).toEqual(state.grid.cells);
		expect(replayed.finalState.hidden?.cells).toEqual(state.hidden?.cells);
		expect(replayed.finalState.moveCount).toBe(state.moveCount);
	});
});

describe("Graph Minesweeper Lite (flood_reveal on graph)", () => {
	const bridgeGraph = {
		width: 3,
		height: 3,
		topology: "graph" as const,
		wrap: false,
		nodes: [
			{ row: 0, col: 0 },
			{ row: 0, col: 1 },
			{ row: 0, col: 2 },
			{ row: 1, col: 1 },
			{ row: 2, col: 0 },
			{ row: 2, col: 2 }
		],
		edges: [
			["0,0", "0,1"],
			["0,1", "0,2"],
			["0,1", "1,1"],
			["1,1", "2,0"],
			["1,1", "2,2"],
			["2,0", "2,2"]
		] as [string, string][]
	};

	it("validates and compiles the graph-minesweeper-lite preset", () => {
		const cfg = examplePresets["graph-minesweeper-lite"].config;
		expect(validateConfig(cfg).ok).toBe(true);
		const { gameConfig } = compileConfig(cfg);
		expect(gameConfig.observationMode).toBe("flood_reveal");
		expect(gameConfig.objectiveMode).toBe("clear_hazards");
		expect(gameConfig.topology).toBe("graph");
		expect(gameConfig.graph?.active).toHaveLength(10);
		expect(gameConfig.hazards?.count).toBe(3);
		expect(gameConfig.hazards?.firstRevealSafe).toBe(true);
	});

	it("schema accepts graph flood and rejects degree > 8", () => {
		const ok = {
			metadata: { name: "Graph Flood Ok", version: 1 },
			grid: bridgeGraph,
			turn: { mode: "turn" as const },
			rng: { seed: 1 },
			input: { mode: "cell" as const },
			placement: { mode: "direct" as const, overflow: "reject" as const },
			observation: { mode: "flood_reveal" as const },
			hazards: { count: 2, firstRevealSafe: false },
			objective: { mode: "clear_hazards" as const },
			tokens: [],
			placements: [],
			initial: []
		};
		expect(zConfig.safeParse(ok).success).toBe(true);

		// Star with 9 leaves → center degree 9 > 8
		const hub = { row: 1, col: 1 };
		const leaves = [
			{ row: 0, col: 0 },
			{ row: 0, col: 1 },
			{ row: 0, col: 2 },
			{ row: 1, col: 0 },
			{ row: 1, col: 2 },
			{ row: 2, col: 0 },
			{ row: 2, col: 1 },
			{ row: 2, col: 2 },
			{ row: 0, col: 3 }
		];
		const degreeBad = {
			...ok,
			grid: {
				width: 4,
				height: 3,
				topology: "graph" as const,
				wrap: false,
				nodes: [hub, ...leaves],
				edges: leaves.map(
					(p) =>
						[`1,1`, `${p.row},${p.col}`] as [string, string]
				)
			},
			hazards: { count: 2, firstRevealSafe: false }
		};
		expect(zConfig.safeParse(degreeBad).success).toBe(false);
	});

	it("graph hazardNeighbors follows edges, not Chebyshev", () => {
		const graph = buildGraphTopologyData(bridgeGraph.nodes, bridgeGraph.edges);
		const mid = { row: 1, col: 1 };
		const graphNbs = hazardNeighbors(mid, 3, 3, "graph", graph);
		expect(graphNbs).toHaveLength(3); // 0,1 / 2,0 / 2,2
		const rectNbs = hazardNeighbors(mid, 3, 3, "rectangle");
		expect(rectNbs).toHaveLength(8);
		// Chebyshev neighbor (0,0) is NOT an edge neighbor of (1,1)
		expect(
			graphNbs.some((p) => p.row === 0 && p.col === 0)
		).toBe(false);
		expect(
			rectNbs.some((p) => p.row === 0 && p.col === 0)
		).toBe(true);

		const cells = Array(9).fill(null) as (null | "mine")[];
		cells[toIndex({ row: 0, col: 0 }, 3)] = "mine";
		const hidden = { width: 3, height: 3, cells };
		expect(adjacentHazardCount(hidden, mid, "rectangle")).toBe(1);
		expect(adjacentHazardCount(hidden, mid, "graph", graph)).toBe(0);
	});

	it("placeHazards on active nodes only", () => {
		const graph = buildGraphTopologyData(bridgeGraph.nodes, bridgeGraph.edges);
		const cells = placeHazards(3, 3, 6, 11, [], graph.active);
		expect(cells.filter((c) => c === "mine")).toHaveLength(6);
		for (let r = 0; r < 3; r++) {
			for (let c = 0; c < 3; c++) {
				const active = graph.active.some(
					(p) => p.row === r && p.col === c
				);
				if (!active) {
					expect(cells[toIndex({ row: r, col: c }, 3)]).toBeNull();
				}
			}
		}
	});

	it("mine hit on graph ends with opponent winner", () => {
		const cfg = zConfig.parse({
			metadata: { name: "Graph Mine Hit", version: 1 },
			grid: bridgeGraph,
			turn: { mode: "turn" },
			rng: { seed: 2 },
			input: { mode: "cell" },
			placement: { mode: "direct", overflow: "reject" },
			observation: { mode: "flood_reveal" },
			hazards: { count: 1, firstRevealSafe: false },
			objective: { mode: "clear_hazards" },
			tokens: [],
			placements: [],
			initial: []
		});
		const { gameConfig } = compileConfig(cfg);
		const state = createInitialState(gameConfig);
		let minePos = { row: 0, col: 0 };
		for (const p of gameConfig.graph!.active) {
			if (isMineAt(state.hidden!, p)) minePos = p;
		}
		const kernel = createGameKernel(gameConfig);
		const step = kernel.stepSync(state, {
			type: "reveal",
			position: minePos
		});
		expect(step.events.some((e) => e.type === "mineHit")).toBe(true);
		expect(step.nextState.status).toBe("won");
		expect(step.nextState.winner).toBe("O");
		expect(getCell(step.nextState.grid, minePos)).toBe("mine");
	});

	it("graph flood uses edge-aware counts in cellsRevealed", () => {
		const cfg = zConfig.parse({
			metadata: { name: "Graph Flood", version: 1 },
			grid: bridgeGraph,
			turn: { mode: "turn" },
			rng: { seed: 1 },
			input: { mode: "cell" },
			placement: { mode: "direct", overflow: "reject" },
			observation: { mode: "flood_reveal" },
			hazards: { count: 2, firstRevealSafe: false },
			objective: { mode: "clear_hazards" },
			tokens: [],
			placements: [],
			initial: []
		});
		const { gameConfig } = compileConfig(cfg);
		const state = createInitialState(gameConfig);
		const graph = gameConfig.graph!;
		let start = graph.active[0]!;
		let found = false;
		for (const p of graph.active) {
			if (!isMineAt(state.hidden!, p)) {
				start = p;
				found = true;
				// Prefer a zero-count open if one exists
				if (
					adjacentHazardCount(state.hidden!, p, "graph", graph) === 0
				) {
					break;
				}
			}
		}
		expect(found).toBe(true);
		const kernel = createGameKernel(gameConfig);
		const step = kernel.stepSync(state, { type: "reveal", position: start });
		const revealed = step.events.find((e) => e.type === "cellsRevealed");
		expect(revealed).toBeDefined();
		if (revealed && revealed.type === "cellsRevealed") {
			expect(revealed.positions.length).toBeGreaterThan(0);
			for (let i = 0; i < revealed.positions.length; i++) {
				expect(revealed.counts[i]).toBe(
					adjacentHazardCount(
						step.nextState.hidden!,
						revealed.positions[i]!,
						"graph",
						graph
					)
				);
			}
		}
	});

	it("inactive cells are ignored for clear_hazards draw", () => {
		const cfg = zConfig.parse({
			metadata: { name: "Graph Clear", version: 1 },
			grid: bridgeGraph,
			turn: { mode: "turn" },
			rng: { seed: 3 },
			input: { mode: "cell" },
			placement: { mode: "direct", overflow: "reject" },
			observation: { mode: "flood_reveal" },
			hazards: { count: 1, firstRevealSafe: false },
			objective: { mode: "clear_hazards" },
			tokens: [],
			placements: [],
			initial: []
		});
		const { gameConfig } = compileConfig(cfg);
		let state = createInitialState(gameConfig);
		const kernel = createGameKernel(gameConfig);
		const graph = gameConfig.graph!;
		// Reveal every safe active node
		for (const p of graph.active) {
			if (state.status !== "playing") break;
			if (getCell(state.grid, p) !== null) continue;
			if (isMineAt(state.hidden!, p)) continue;
			const step = kernel.stepSync(state, { type: "reveal", position: p });
			state = step.nextState;
		}
		expect(state.status).toBe("draw");
		expect(
			allSafeRevealed(state.hidden!, state.grid, "graph", graph)
		).toBe(true);
	});

	it("GameIR replay matches transcript for graph-minesweeper-lite", () => {
		const cfg = examplePresets["graph-minesweeper-lite"].config;
		const { gameConfig, kernel } = compileConfig(cfg);
		const actions: KernelAction[] = [
			{ type: "reveal", position: { row: 0, col: 0 } },
			{ type: "reveal", position: { row: 2, col: 3 } }
		];
		let state = kernel.initialState(cfg.rng.seed);
		for (const action of actions) {
			const step = kernel.stepSync(state, action);
			state = step.nextState;
		}
		const replayed = replayActions(gameConfig, actions, cfg.rng.seed);
		expect(replayed.finalState.grid.cells).toEqual(state.grid.cells);
		expect(replayed.finalState.hidden?.cells).toEqual(state.hidden?.cells);
		expect(replayed.finalState.moveCount).toBe(state.moveCount);
	});
});

describe("Minesweeper Lite (flood_reveal)", () => {
	it("validates and compiles the minesweeper-lite preset", () => {
		const cfg = examplePresets["minesweeper-lite"].config;
		expect(validateConfig(cfg).ok).toBe(true);
		const { gameConfig } = compileConfig(cfg);
		expect(gameConfig.observationMode).toBe("flood_reveal");
		expect(gameConfig.objectiveMode).toBe("clear_hazards");
		expect(gameConfig.hazards?.count).toBe(10);
		expect(gameConfig.hazards?.firstRevealSafe).toBe(true);
	});

	it("schema rejects flood_reveal without hazards / with hit_miss combos", () => {
		const base = {
			...examplePresets["minesweeper-lite"].config,
			hazards: undefined
		};
		expect(zConfig.safeParse(base).success).toBe(false);

		const withFleet = {
			...examplePresets["minesweeper-lite"].config,
			fleet: { ships: [2] }
		};
		expect(zConfig.safeParse(withFleet).success).toBe(false);

		const withFog = {
			metadata: { name: "bad", version: 1 },
			grid: { width: 5, height: 5, topology: "rectangle" as const },
			turn: { mode: "turn" as const },
			rng: { seed: 1 },
			input: { mode: "cell" as const },
			placement: { mode: "direct" as const, overflow: "reject" as const },
			observation: { mode: "flood_reveal" as const },
			hazards: { count: 3 },
			objective: { mode: "n_in_a_row" as const },
			win: {
				length: 3,
				adjacency: {
					mode: "linear" as const,
					horizontal: true,
					vertical: true,
					backDiagonal: true,
					forwardDiagonal: true
				}
			},
			tokens: [],
			placements: [],
			initial: []
		};
		expect(zConfig.safeParse(withFog).success).toBe(false);
	});

	it("defers mines until first reveal when firstRevealSafe", () => {
		const { gameConfig } = compileConfig(
			examplePresets["minesweeper-lite"].config
		);
		const state = createInitialState(gameConfig);
		expect(state.hidden).toBeDefined();
		expect(mineCount(state.hidden!)).toBe(0);
		const kernel = createGameKernel(gameConfig);
		const step = kernel.stepSync(state, {
			type: "reveal",
			position: { row: 0, col: 0 }
		});
		expect(step.events.some((e) => e.type === "ignored")).toBe(false);
		expect(isMineAt(step.nextState.hidden!, { row: 0, col: 0 })).toBe(false);
		expect(mineCount(step.nextState.hidden!)).toBe(10);
		expect(getCell(step.nextState.grid, { row: 0, col: 0 })).not.toBeNull();
	});

	it("flood reveal emits cellsRevealed and opens a region on zero cells", () => {
		const cfg = zConfig.parse({
			metadata: { name: "Flood Demo", version: 1 },
			grid: { width: 5, height: 5, topology: "rectangle", wrap: false },
			turn: { mode: "turn" },
			rng: { seed: 1 },
			input: { mode: "cell" },
			placement: { mode: "direct", overflow: "reject" },
			observation: { mode: "flood_reveal" },
			hazards: { count: 3, firstRevealSafe: false },
			objective: { mode: "clear_hazards" },
			tokens: [
				{ id: "x", label: "X", players: ["X"] },
				{ id: "o", label: "O", players: ["O"] }
			],
			placements: [],
			initial: []
		});
		const { gameConfig } = compileConfig(cfg);
		const state = createInitialState(gameConfig);
		expect(mineCount(state.hidden!)).toBe(3);
		// Find a zero-count safe cell
		let start = { row: 0, col: 0 };
		let found = false;
		for (let r = 0; r < 5 && !found; r++) {
			for (let c = 0; c < 5 && !found; c++) {
				const p = { row: r, col: c };
				if (!isMineAt(state.hidden!, p) && adjacentHazardCount(state.hidden!, p) === 0) {
					start = p;
					found = true;
				}
			}
		}
		expect(found).toBe(true);
		const kernel = createGameKernel(gameConfig);
		const step = kernel.stepSync(state, { type: "reveal", position: start });
		const revealed = step.events.find((e) => e.type === "cellsRevealed");
		expect(revealed).toBeDefined();
		if (revealed && revealed.type === "cellsRevealed") {
			expect(revealed.positions.length).toBeGreaterThan(1);
		}
		expect(step.nextState.currentPlayer).toBe("O");
	});

	it("reveal on a numbered cell opens exactly one cell", () => {
		const cfg = zConfig.parse({
			metadata: { name: "Numbered", version: 1 },
			grid: { width: 4, height: 4, topology: "rectangle", wrap: false },
			turn: { mode: "turn" },
			rng: { seed: 99 },
			input: { mode: "cell" },
			placement: { mode: "direct", overflow: "reject" },
			observation: { mode: "flood_reveal" },
			hazards: { count: 5, firstRevealSafe: false },
			objective: { mode: "clear_hazards" },
			tokens: [],
			placements: [],
			initial: []
		});
		const { gameConfig } = compileConfig(cfg);
		const state = createInitialState(gameConfig);
		let start = { row: 0, col: 0 };
		let found = false;
		for (let r = 0; r < 4 && !found; r++) {
			for (let c = 0; c < 4 && !found; c++) {
				const p = { row: r, col: c };
				if (
					!isMineAt(state.hidden!, p) &&
					adjacentHazardCount(state.hidden!, p) > 0
				) {
					start = p;
					found = true;
				}
			}
		}
		expect(found).toBe(true);
		const kernel = createGameKernel(gameConfig);
		const step = kernel.stepSync(state, { type: "reveal", position: start });
		const revealed = step.events.find((e) => e.type === "cellsRevealed");
		expect(revealed).toBeDefined();
		if (revealed && revealed.type === "cellsRevealed") {
			expect(revealed.positions).toHaveLength(1);
			expect(revealed.counts[0]).toBeGreaterThan(0);
		}
	});

	it("mine hit ends the game with opponent as winner", () => {
		const cfg = zConfig.parse({
			metadata: { name: "Mine Hit", version: 1 },
			grid: { width: 3, height: 3, topology: "rectangle", wrap: false },
			turn: { mode: "turn" },
			rng: { seed: 2 },
			input: { mode: "cell" },
			placement: { mode: "direct", overflow: "reject" },
			observation: { mode: "flood_reveal" },
			hazards: { count: 1, firstRevealSafe: false },
			objective: { mode: "clear_hazards" },
			tokens: [],
			placements: [],
			initial: []
		});
		const { gameConfig } = compileConfig(cfg);
		const state = createInitialState(gameConfig);
		let minePos = { row: 0, col: 0 };
		for (let r = 0; r < 3; r++) {
			for (let c = 0; c < 3; c++) {
				if (isMineAt(state.hidden!, { row: r, col: c })) {
					minePos = { row: r, col: c };
				}
			}
		}
		const kernel = createGameKernel(gameConfig);
		const step = kernel.stepSync(state, { type: "reveal", position: minePos });
		expect(step.events.some((e) => e.type === "mineHit")).toBe(true);
		expect(step.nextState.status).toBe("won");
		expect(step.nextState.winner).toBe("O"); // X hit mine
		expect(getCell(step.nextState.grid, minePos)).toBe("mine");
	});

	it("clearing all safe cells draws", () => {
		// 2x2 with 1 mine — reveal the 3 safe cells
		const cfg = zConfig.parse({
			metadata: { name: "Clear", version: 1 },
			grid: { width: 2, height: 2, topology: "rectangle", wrap: false },
			turn: { mode: "turn" },
			rng: { seed: 0 },
			input: { mode: "cell" },
			placement: { mode: "direct", overflow: "reject" },
			observation: { mode: "flood_reveal" },
			hazards: { count: 1, firstRevealSafe: false },
			objective: { mode: "clear_hazards" },
			tokens: [],
			placements: [],
			initial: []
		});
		const { gameConfig } = compileConfig(cfg);
		let state = createInitialState(gameConfig);
		const kernel = createGameKernel(gameConfig);
		const safe: { row: number; col: number }[] = [];
		for (let r = 0; r < 2; r++) {
			for (let c = 0; c < 2; c++) {
				if (!isMineAt(state.hidden!, { row: r, col: c })) {
					safe.push({ row: r, col: c });
				}
			}
		}
		expect(safe).toHaveLength(3);
		for (const pos of safe) {
			if (state.status !== "playing") break;
			if (getCell(state.grid, pos) !== null) continue;
			const step = kernel.stepSync(state, { type: "reveal", position: pos });
			state = step.nextState;
		}
		expect(allSafeRevealed(state.hidden!, state.grid)).toBe(true);
		expect(state.status).toBe("draw");
		expect(state.winner).toBeNull();
	});

	it("observe hides mines; already-revealed reveal is ignored", () => {
		const { gameConfig } = compileConfig(
			examplePresets["minesweeper-lite"].config
		);
		const kernel = createGameKernel(gameConfig);
		let state = createInitialState(gameConfig);
		const step1 = kernel.stepSync(state, {
			type: "reveal",
			position: { row: 3, col: 3 }
		});
		state = step1.nextState;
		const obs = kernel.observe(state, 0);
		expect(obs.cells.some((c) => c === "mine")).toBe(false);
		const revealed = obs.cells.filter((c) => typeof c === "number");
		expect(revealed.length).toBeGreaterThan(0);

		const again = kernel.stepSync(state, {
			type: "reveal",
			position: { row: 3, col: 3 }
		});
		expect(again.events.some((e) => e.type === "ignored")).toBe(true);
	});

	it("GameIR replay matches transcript for a short reveal sequence", () => {
		const cfg = examplePresets["minesweeper-lite"].config;
		const { gameConfig, kernel } = compileConfig(cfg);
		const actions: KernelAction[] = [
			{ type: "reveal", position: { row: 0, col: 0 } },
			{ type: "reveal", position: { row: 7, col: 7 } }
		];
		let state = kernel.initialState(cfg.rng.seed);
		for (const action of actions) {
			const step = kernel.stepSync(state, action);
			state = step.nextState;
		}
		const replayed = replayActions(gameConfig, actions, cfg.rng.seed);
		expect(replayed.finalState.grid.cells).toEqual(state.grid.cells);
		expect(replayed.finalState.hidden?.cells).toEqual(state.hidden?.cells);
		expect(replayed.finalState.moveCount).toBe(state.moveCount);
	});
});
