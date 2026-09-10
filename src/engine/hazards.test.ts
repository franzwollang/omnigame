import { describe, expect, it } from "vitest";
import { compileConfig } from "@/compiler";
import {
	adjacentHazardCount,
	allSafeRevealed,
	floodRevealRegion,
	isMineAt,
	mineCount,
	placeHazards
} from "@/engine/hazards";
import type { KernelAction } from "@/engine/kernel";
import { createGameKernel } from "@/engine/kernel";
import { createInitialState } from "@/engine/reducer";
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
