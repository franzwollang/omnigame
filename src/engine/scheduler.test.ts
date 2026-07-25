import { describe, expect, it } from "vitest";
import { compileConfig } from "@/compiler";
import {
	applyLifeStep,
	countAliveNeighbors,
	isAlive
} from "@/engine/scheduler";
import { createInitialState, type GameConfig } from "@/engine/reducer";
import { getCell, type Grid } from "@/engine/types";
import { examplePresets } from "@/presets/registry";
import { validateConfig } from "@/engine/validateConfig";
import { replayActions } from "@/ir/gameIr";
import { playerIdOf, type KernelAction } from "@/engine/kernel";

function gridFrom(
	width: number,
	height: number,
	alive: Array<[number, number]>
): Grid {
	const cells = Array(width * height).fill(null);
	for (const [row, col] of alive) {
		cells[row * width + col] = "X";
	}
	return { width, height, cells };
}

describe("scheduler / Life helpers", () => {
	it("counts Moore neighbors", () => {
		const grid = gridFrom(3, 3, [
			[0, 0],
			[0, 1],
			[1, 0]
		]);
		expect(countAliveNeighbors(grid, 1, 1)).toBe(3);
		expect(isAlive(getCell(grid, { row: 0, col: 0 }))).toBe(true);
		expect(isAlive(null)).toBe(false);
	});

	it("blinker oscillates period 2 (horizontal ↔ vertical)", () => {
		const horizontal = gridFrom(5, 5, [
			[2, 1],
			[2, 2],
			[2, 3]
		]);
		const vertical = applyLifeStep(horizontal, "life_b3s23");
		expect(getCell(vertical, { row: 1, col: 2 })).toBe("X");
		expect(getCell(vertical, { row: 2, col: 2 })).toBe("X");
		expect(getCell(vertical, { row: 3, col: 2 })).toBe("X");
		expect(getCell(vertical, { row: 2, col: 1 })).toBeNull();
		expect(getCell(vertical, { row: 2, col: 3 })).toBeNull();

		const back = applyLifeStep(vertical, "life_b3s23");
		expect(getCell(back, { row: 2, col: 1 })).toBe("X");
		expect(getCell(back, { row: 2, col: 2 })).toBe("X");
		expect(getCell(back, { row: 2, col: 3 })).toBe("X");
		expect(getCell(back, { row: 1, col: 2 })).toBeNull();
		expect(getCell(back, { row: 3, col: 2 })).toBeNull();
	});

	it("2×2 block is still life", () => {
		const block = gridFrom(4, 4, [
			[1, 1],
			[1, 2],
			[2, 1],
			[2, 2]
		]);
		const next = applyLifeStep(block, "life_b3s23");
		expect(next.cells).toEqual(block.cells);
	});
});

describe("Life Lite (manual_tick scheduler)", () => {
	it("validates and compiles the life-lite preset", () => {
		const cfg = examplePresets["life-lite"].config;
		expect(validateConfig(cfg).ok).toBe(true);
		const { kernel, gameConfig } = compileConfig(cfg);
		expect(gameConfig.turnSchedule).toBe("manual_tick");
		expect(gameConfig.scheduler?.rules).toBe("life_b3s23");
		expect(gameConfig.objectiveMode).toBe("none");
		const state = kernel.initialState(cfg.rng.seed);
		expect(getCell(state.grid, { row: 2, col: 2 })).toBe("X");
		const legal = kernel.legalActions(state, 0);
		expect(legal.some((a) => a.type === "tick")).toBe(true);
		expect(legal.some((a) => a.type === "place")).toBe(true);
	});

	it("tick advances blinker via compiler→kernel; replay faithful", () => {
		const cfg = examplePresets["life-lite"].config;
		const { kernel } = compileConfig(cfg);
		const script: KernelAction[] = [{ type: "tick" }, { type: "tick" }];

		let state = kernel.initialState(cfg.rng.seed);
		const first = kernel.stepSync(state, { type: "tick" });
		expect(first.events.some((e) => e.type === "tickApplied")).toBe(true);
		expect(getCell(first.nextState.grid, { row: 1, col: 2 })).toBe("X");
		expect(getCell(first.nextState.grid, { row: 2, col: 1 })).toBeNull();
		expect(first.nextState.currentPlayer).toBe("X");
		state = first.nextState;

		const second = kernel.stepSync(state, { type: "tick" });
		expect(getCell(second.nextState.grid, { row: 2, col: 1 })).toBe("X");
		expect(getCell(second.nextState.grid, { row: 2, col: 2 })).toBe("X");
		expect(getCell(second.nextState.grid, { row: 2, col: 3 })).toBe("X");
		state = second.nextState;
		expect(state.moveCount).toBe(2);
		expect(state.status).toBe("playing");

		const replay = replayActions(
			compileConfig(cfg).gameConfig,
			script,
			cfg.rng.seed
		);
		expect(replay.faithful).toBe(true);
		expect(replay.finalState.grid.cells).toEqual(state.grid.cells);
	});

	it("ignores tick when schedule is alternating (TTT unchanged)", () => {
		const cfg = examplePresets["tic-tac-toe"].config;
		const { kernel } = compileConfig(cfg);
		let state = kernel.initialState();
		const ignored = kernel.stepSync(state, { type: "tick" });
		expect(ignored.events[0]?.type).toBe("ignored");
		expect(ignored.nextState).toBe(state);
		expect(
			kernel.legalActions(state, playerIdOf(state.currentPlayer)).some(
				(a) => a.type === "tick"
			)
		).toBe(false);
	});

	it("rejects manual_tick without scheduler", () => {
		const { scheduler: _drop, ...rest } = examplePresets["life-lite"].config;
		const result = validateConfig(rest);
		expect(result.ok).toBe(false);
	});
});

describe("createInitialState + life seeds", () => {
	it("seeds blinker on public initial cells", () => {
		const { gameConfig } = compileConfig(examplePresets["life-lite"].config);
		const state = createInitialState(gameConfig as GameConfig);
		expect(getCell(state.grid, { row: 2, col: 1 })).toBe("X");
		expect(getCell(state.grid, { row: 2, col: 2 })).toBe("X");
		expect(getCell(state.grid, { row: 2, col: 3 })).toBe("X");
	});
});
