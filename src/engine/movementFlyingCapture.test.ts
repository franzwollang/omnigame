import { describe, expect, it } from "vitest";
import { compileConfig } from "@/compiler";
import {
	effectiveMovement,
	jumpDestinations,
	jumpMid,
	isJumpCapture,
	legalDestinations,
	usesFlyingCapture,
	type MovementConfig
} from "@/engine/movement";
import type { KernelAction } from "@/engine/kernel";
import { createInitialState } from "@/engine/reducer";
import { getCell, setCell, type Grid } from "@/engine/types";
import { examplePresets } from "@/presets/registry";
import { validateConfig } from "@/engine/validateConfig";
import { replayActions } from "@/ir/gameIr";
import { zConfig } from "@/schemas/config";

const FLY_CAP: MovementConfig = {
	adjacency: "diagonal",
	range: 1,
	capture: "jump",
	mustCapture: true,
	promotion: {
		targetRows: { X: 3, O: 2 },
		crownedAdjacency: "diagonal",
		crownedRange: 4,
		crownedFlyingCapture: true
	}
};

function emptyGrid(w = 6, h = 6): Grid {
	return { width: w, height: h, cells: Array(w * h).fill(null) };
}

describe("promotion.crownedFlyingCapture schema", () => {
	it("accepts crownedFlyingCapture with crownedRange >= 2", () => {
		const cfg = examplePresets["flying-capture-jump-lite"].config;
		expect(validateConfig(cfg).ok).toBe(true);
		const parsed = zConfig.safeParse(cfg);
		expect(parsed.success).toBe(true);
		if (parsed.success) {
			expect(parsed.data.movement?.promotion?.crownedFlyingCapture).toBe(
				true
			);
			expect(parsed.data.movement?.promotion?.crownedRange).toBe(4);
		}
	});

	it("rejects crownedFlyingCapture when crownedRange < 2", () => {
		const base = structuredClone(
			examplePresets["flying-capture-jump-lite"].config
		);
		base.movement = {
			...base.movement!,
			promotion: {
				...base.movement!.promotion!,
				crownedRange: 1
			}
		};
		const parsed = zConfig.safeParse(base);
		expect(parsed.success).toBe(false);
	});

	it("rejects crownedFlyingCapture without jump capture", () => {
		const base = structuredClone(
			examplePresets["flying-capture-jump-lite"].config
		);
		base.movement = {
			adjacency: "diagonal",
			range: 1,
			capture: "none",
			promotion: {
				targetRows: { X: 3, O: 2 },
				crownedAdjacency: "diagonal",
				crownedRange: 4,
				crownedFlyingCapture: true
			}
		};
		const parsed = zConfig.safeParse(base);
		expect(parsed.success).toBe(false);
	});
});

describe("crownedFlyingCapture helpers", () => {
	it("usesFlyingCapture only for crowned pieces", () => {
		expect(usesFlyingCapture(FLY_CAP, "X+")).toBe(true);
		expect(usesFlyingCapture(FLY_CAP, "X")).toBe(false);
		const noFlag: MovementConfig = {
			...FLY_CAP,
			promotion: {
				targetRows: { X: 3, O: 2 },
				crownedAdjacency: "diagonal",
				crownedRange: 4
			}
		};
		expect(usesFlyingCapture(noFlag, "X+")).toBe(false);
	});

	it("men keep adjacent-only jumps; crowned get long landings", () => {
		let grid = emptyGrid();
		grid = { ...grid, cells: setCell(grid, { row: 3, col: 5 }, "X") };
		grid = { ...grid, cells: setCell(grid, { row: 2, col: 4 }, "O") };
		const manDests = jumpDestinations(grid, { row: 3, col: 5 }, FLY_CAP);
		expect(manDests).toEqual([{ row: 1, col: 3 }]);

		grid = { ...grid, cells: setCell(grid, { row: 3, col: 5 }, "X+") };
		const kingDests = jumpDestinations(grid, { row: 3, col: 5 }, FLY_CAP);
		expect(kingDests.some((p) => p.row === 1 && p.col === 3)).toBe(true);
		expect(kingDests.some((p) => p.row === 0 && p.col === 2)).toBe(true);
	});

	it("empty approach before mid is legal for crowned", () => {
		let grid = emptyGrid();
		grid = { ...grid, cells: setCell(grid, { row: 4, col: 4 }, "X+") };
		grid = { ...grid, cells: setCell(grid, { row: 2, col: 2 }, "O") };
		const dests = jumpDestinations(grid, { row: 4, col: 4 }, FLY_CAP);
		expect(dests.some((p) => p.row === 1 && p.col === 1)).toBe(true);
		expect(dests.some((p) => p.row === 0 && p.col === 0)).toBe(true);
		expect(
			isJumpCapture(
				grid,
				{ row: 4, col: 4 },
				{ row: 0, col: 0 },
				"X",
				FLY_CAP
			)
		).toBe(true);
		const eff = effectiveMovement(FLY_CAP, "X+");
		expect(
			jumpMid(
				{ row: 4, col: 4 },
				{ row: 0, col: 0 },
				eff,
				false,
				grid
			)
		).toEqual({ row: 2, col: 2 });
	});

	it("without crownedFlyingCapture, long land is illegal", () => {
		let grid = emptyGrid();
		grid = { ...grid, cells: setCell(grid, { row: 3, col: 5 }, "X+") };
		grid = { ...grid, cells: setCell(grid, { row: 2, col: 4 }, "O") };
		const noFly: MovementConfig = {
			...FLY_CAP,
			promotion: {
				targetRows: { X: 3, O: 2 },
				crownedAdjacency: "diagonal",
				crownedRange: 4
			}
		};
		const dests = jumpDestinations(grid, { row: 3, col: 5 }, noFly);
		expect(dests).toEqual([{ row: 1, col: 3 }]);
		expect(
			isJumpCapture(
				grid,
				{ row: 3, col: 5 },
				{ row: 0, col: 2 },
				"X",
				noFly
			)
		).toBe(false);
	});

	it("quiet slide blocked by enemy; flying jump clears it", () => {
		let grid = emptyGrid();
		grid = { ...grid, cells: setCell(grid, { row: 3, col: 5 }, "X+") };
		grid = { ...grid, cells: setCell(grid, { row: 2, col: 4 }, "O") };
		const quietOnly = legalDestinations(grid, { row: 3, col: 5 }, {
			...FLY_CAP,
			capture: "none",
			mustCapture: false
		});
		expect(quietOnly.some((p) => p.row === 0 && p.col === 2)).toBe(false);
		expect(
			jumpDestinations(grid, { row: 3, col: 5 }, FLY_CAP).some(
				(p) => p.row === 0 && p.col === 2
			)
		).toBe(true);
	});
});

describe("GameIR flying capture win", () => {
	it("transcript + replay: promote then chain flying-capture win", () => {
		const cfg = examplePresets["flying-capture-jump-lite"].config;
		const { gameConfig } = compileConfig(cfg);
		const actions: KernelAction[] = [
			{ type: "move", from: { row: 5, col: 3 }, to: { row: 3, col: 5 } },
			{ type: "move", from: { row: 3, col: 5 }, to: { row: 0, col: 2 } }
		];
		const { finalState, faithful, events } = replayActions(
			gameConfig,
			actions,
			cfg.rng.seed
		);
		expect(faithful).toBe(true);
		expect(events.some((e) => e.type === "piecePromoted")).toBe(true);
		expect(
			events.filter((e) => e.type === "pieceCaptured")
		).toHaveLength(2);
		expect(getCell(finalState.grid, { row: 0, col: 2 })).toBe("X+");
		expect(getCell(finalState.grid, { row: 2, col: 4 })).toBe(null);
		expect(finalState.status).toBe("won");
		expect(finalState.winner).toBe("X");
	});
});

describe("Flying Capture Jump Lite preset", () => {
	it("opening jump promotes; chain flying capture wins", () => {
		const cfg = examplePresets["flying-capture-jump-lite"].config;
		expect(validateConfig(cfg).ok).toBe(true);
		const { kernel, gameConfig } = compileConfig(cfg);
		expect(gameConfig.movement?.promotion?.crownedFlyingCapture).toBe(true);
		expect(gameConfig.movement?.promotion?.crownedRange).toBe(4);
		expect(gameConfig.objectiveMode).toBe("reach_row");

		let state = createInitialState(gameConfig);
		expect(getCell(state.grid, { row: 5, col: 3 })).toBe("X");
		const opening = kernel.legalActions(state, 0);
		expect(opening).toEqual([
			{ type: "move", from: { row: 5, col: 3 }, to: { row: 3, col: 5 } }
		]);
		let result = kernel.stepSync(state, opening[0]!);
		expect(getCell(result.nextState.grid, { row: 3, col: 5 })).toBe("X+");
		expect(result.events.some((e) => e.type === "piecePromoted")).toBe(
			true
		);
		expect(result.nextState.mustContinueFrom).toEqual({
			row: 3,
			col: 5
		});
		state = result.nextState;

		const chainLegal = kernel.legalActions(state, 0);
		expect(
			chainLegal.some(
				(a) =>
					a.type === "move" &&
					a.from.row === 3 &&
					a.from.col === 5 &&
					a.to.row === 0 &&
					a.to.col === 2
			)
		).toBe(true);
		expect(
			chainLegal.some(
				(a) =>
					a.type === "move" &&
					a.from.row === 3 &&
					a.from.col === 5 &&
					a.to.row === 1 &&
					a.to.col === 3
			)
		).toBe(true);

		// Contrast: without crownedFlyingCapture only adjacent land is legal.
		expect(
			jumpDestinations(state.grid, { row: 3, col: 5 }, {
				...FLY_CAP,
				promotion: {
					targetRows: { X: 3, O: 2 },
					crownedAdjacency: "diagonal",
					crownedRange: 4
				}
			})
		).toEqual([{ row: 1, col: 3 }]);

		result = kernel.stepSync(state, {
			type: "move",
			from: { row: 3, col: 5 },
			to: { row: 0, col: 2 }
		});
		expect(getCell(result.nextState.grid, { row: 0, col: 2 })).toBe("X+");
		expect(getCell(result.nextState.grid, { row: 2, col: 4 })).toBe(null);
		expect(result.nextState.status).toBe("won");
		expect(result.nextState.winner).toBe("X");
	});
});
