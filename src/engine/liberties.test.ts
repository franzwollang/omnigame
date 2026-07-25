import { describe, expect, it } from "vitest";
import { compileConfig } from "@/compiler";
import {
	applyLibertyCapture,
	countLiberties,
	findGroup,
	isLegalLibertyPlace,
	orthogonalNeighbors,
	scoreArea
} from "@/engine/liberties";
import { createInitialState, type GameConfig } from "@/engine/reducer";
import { getCell, setCell, type Grid } from "@/engine/types";
import { playerIdOf, type KernelAction } from "@/engine/kernel";
import { examplePresets } from "@/presets/registry";
import { validateConfig } from "@/engine/validateConfig";
import { replayActions } from "@/ir/gameIr";

function gridOf(width: number, height: number, cells: (string | null)[]): Grid {
	return {
		width,
		height,
		cells: cells.map((c) => (c === "X" || c === "O" ? c : null))
	};
}

describe("liberties helpers", () => {
	it("lists orthogonal neighbors only", () => {
		const g = gridOf(3, 3, Array(9).fill(null));
		expect(orthogonalNeighbors(g, { row: 1, col: 1 })).toHaveLength(4);
		expect(orthogonalNeighbors(g, { row: 0, col: 0 })).toEqual([
			{ row: 1, col: 0 },
			{ row: 0, col: 1 }
		]);
	});

	it("counts liberties for a single stone", () => {
		let cells = Array(9).fill(null);
		const base = gridOf(3, 3, cells);
		cells = setCell(base, { row: 1, col: 1 }, "X");
		const g = { ...base, cells };
		const group = findGroup(g, { row: 1, col: 1 });
		expect(group).toHaveLength(1);
		expect(countLiberties(g, group)).toBe(4);
	});

	it("captures a surrounded single stone", () => {
		// O at center, X on three sides; place X on fourth → capture O
		const cells = Array(9).fill(null);
		let g = gridOf(3, 3, cells);
		g = { ...g, cells: setCell(g, { row: 1, col: 1 }, "O") };
		g = { ...g, cells: setCell(g, { row: 0, col: 1 }, "X") };
		g = { ...g, cells: setCell(g, { row: 1, col: 0 }, "X") };
		g = { ...g, cells: setCell(g, { row: 1, col: 2 }, "X") };
		const placed = { row: 2, col: 1 };
		expect(isLegalLibertyPlace(g, placed, "X")).toBe(true);
		const afterPlace = setCell(g, placed, "X");
		const after = applyLibertyCapture({ ...g, cells: afterPlace }, placed, "X");
		expect(getCell({ ...g, cells: after }, { row: 1, col: 1 })).toBe(null);
		expect(getCell({ ...g, cells: after }, placed)).toBe("X");
	});

	it("rejects suicide (no liberty after place)", () => {
		// Fill all liberties of empty center with O; X cannot place there
		let g = gridOf(3, 3, Array(9).fill(null));
		for (const p of [
			{ row: 0, col: 1 },
			{ row: 1, col: 0 },
			{ row: 1, col: 2 },
			{ row: 2, col: 1 }
		]) {
			g = { ...g, cells: setCell(g, p, "O") };
		}
		expect(isLegalLibertyPlace(g, { row: 1, col: 1 }, "X")).toBe(false);
	});

	it("scores stones plus enclosed territory", () => {
		// X owns left column + enclosed empties on left of a wall
		let g = gridOf(3, 2, Array(6).fill(null));
		g = { ...g, cells: setCell(g, { row: 0, col: 1 }, "X") };
		g = { ...g, cells: setCell(g, { row: 1, col: 1 }, "X") };
		// empties at (0,0)(1,0) bordered only by X → territory; (0,2)(1,2) open to edge with X border only from left
		const score = scoreArea(g);
		expect(score.X).toBeGreaterThanOrEqual(2);
		expect(score.O).toBe(0);
	});
});

describe("Go Lite (liberties + area_control)", () => {
	it("validates and compiles the go-lite preset", () => {
		const cfg = examplePresets["go-lite"].config;
		expect(validateConfig(cfg).ok).toBe(true);
		const { kernel, gameConfig } = compileConfig(cfg);
		expect(gameConfig.captureEnabled).toBe(true);
		expect(gameConfig.captureMode).toBe("liberties");
		expect(gameConfig.objectiveMode).toBe("area_control");
		const state = kernel.initialState(cfg.rng.seed);
		const legal = kernel.legalActions(state, 0);
		expect(legal.some((a) => a.type === "pass")).toBe(true);
		expect(legal.some((a) => a.type === "place")).toBe(true);
	});

	it("rejects unpaired liberties / area_control", () => {
		const bad = structuredClone(examplePresets["go-lite"].config);
		bad.objective.mode = "n_in_a_row";
		bad.win = {
			length: 3,
			adjacency: {
				mode: "linear",
				horizontal: true,
				vertical: true,
				backDiagonal: false,
				forwardDiagonal: false
			}
		};
		expect(validateConfig(bad).ok).toBe(false);
	});

	it("captures via liberties then scores after two passes (compiler→kernel)", () => {
		const cfg = examplePresets["go-lite"].config;
		const { kernel, gameConfig } = compileConfig(cfg);

		// Script surrounds O at (2,2) on a 5×5 and captures, then both pass.
		// X places N/W/E first; O places elsewhere; X closes south.
		const script: KernelAction[] = [
			{ type: "place", position: { row: 1, col: 2 } }, // X north of center
			{ type: "place", position: { row: 0, col: 0 } }, // O corner
			{ type: "place", position: { row: 2, col: 1 } }, // X west
			{ type: "place", position: { row: 2, col: 2 } }, // O center (target)
			{ type: "place", position: { row: 2, col: 3 } }, // X east
			{ type: "place", position: { row: 0, col: 4 } }, // O far
			{ type: "place", position: { row: 3, col: 2 } }, // X south → capture O
			{ type: "pass" }, // O
			{ type: "pass" } // X — end
		];

		let state = kernel.initialState(cfg.rng.seed);
		for (const action of script) {
			const player = playerIdOf(state.currentPlayer);
			expect(
				kernel.legalActions(state, player).some((a) => {
					if (a.type !== action.type) return false;
					if (a.type === "place" && action.type === "place") {
						return (
							a.position.row === action.position.row &&
							a.position.col === action.position.col
						);
					}
					return a.type === "pass" && action.type === "pass";
				})
			).toBe(true);
			const result = kernel.stepSync(state, action);
			expect(result.events[0]?.type).toBe("actionApplied");
			state = result.nextState;
		}

		expect(getCell(state.grid, { row: 2, col: 2 })).toBe(null);
		expect(state.status).not.toBe("playing");
		expect(state.winner).toBe("X");

		const replay = replayActions(gameConfig, script, cfg.rng.seed);
		expect(replay.faithful).toBe(true);
		expect(replay.finalState.status).toBe(state.status);
		expect(replay.finalState.winner).toBe("X");
	});

	it("ignores pass outside area_control", () => {
		const { kernel } = compileConfig(examplePresets["tic-tac-toe"].config);
		const state = kernel.initialState();
		const result = kernel.stepSync(state, { type: "pass" });
		expect(result.events[0]?.type).toBe("ignored");
		expect(result.nextState).toBe(state);
	});
});

describe("createInitialState consecutivePasses", () => {
	it("seeds consecutivePasses at 0", () => {
		const config: GameConfig = {
			gridWidth: 5,
			gridHeight: 5,
			winLength: 3,
			adjacency: {
				mode: "linear",
				horizontal: true,
				vertical: true,
				backDiagonal: false,
				forwardDiagonal: false
			},
			captureEnabled: true,
			captureMode: "liberties",
			objectiveMode: "area_control"
		};
		expect(createInitialState(config).consecutivePasses).toBe(0);
	});
});
