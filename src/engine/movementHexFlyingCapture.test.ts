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

const HEX_BOARD = { topology: "hex_offset" as const };

const HEX_FLY_CAP: MovementConfig = {
	adjacency: "orthogonal",
	range: 1,
	capture: "jump",
	mustCapture: true,
	promotion: {
		targetRows: { X: 3, O: 2 },
		crownedAdjacency: "orthogonal",
		crownedRange: 4,
		crownedFlyingCapture: true
	}
};

function emptyHexGrid(w = 6, h = 6): Grid {
	return { width: w, height: h, cells: Array(w * h).fill(null) };
}

describe("hex promotion.crownedFlyingCapture schema", () => {
	it("accepts crownedFlyingCapture on hex_offset with crownedRange >= 2", () => {
		const cfg = examplePresets["hex-flying-capture-jump-lite"].config;
		expect(validateConfig(cfg).ok).toBe(true);
		const parsed = zConfig.safeParse(cfg);
		expect(parsed.success).toBe(true);
		if (parsed.success) {
			expect(parsed.data.grid.topology).toBe("hex_offset");
			expect(parsed.data.movement?.promotion?.crownedFlyingCapture).toBe(
				true
			);
			expect(parsed.data.movement?.promotion?.crownedRange).toBe(4);
		}
	});

	it("rejects hex crownedFlyingCapture when crownedRange < 2", () => {
		const base = structuredClone(
			examplePresets["hex-flying-capture-jump-lite"].config
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

	it("still rejects graph crownedFlyingCapture", () => {
		const base = structuredClone(
			examplePresets["graph-crowned-jump-lite"].config
		);
		base.movement = {
			...base.movement!,
			promotion: {
				...base.movement!.promotion!,
				crownedFlyingCapture: true,
				crownedRange: 4
			}
		};
		const parsed = zConfig.safeParse(base);
		expect(parsed.success).toBe(false);
	});
});

describe("hex crownedFlyingCapture helpers", () => {
	it("usesFlyingCapture only for crowned pieces", () => {
		expect(usesFlyingCapture(HEX_FLY_CAP, "X+")).toBe(true);
		expect(usesFlyingCapture(HEX_FLY_CAP, "X")).toBe(false);
	});

	it("men keep adjacent-only hex jumps; crowned get long landings", () => {
		let grid = emptyHexGrid();
		grid = { ...grid, cells: setCell(grid, { row: 3, col: 2 }, "X") };
		grid = { ...grid, cells: setCell(grid, { row: 2, col: 2 }, "O") };
		const manDests = jumpDestinations(
			grid,
			{ row: 3, col: 2 },
			HEX_FLY_CAP,
			HEX_BOARD
		);
		expect(manDests).toEqual([{ row: 1, col: 1 }]);

		grid = { ...grid, cells: setCell(grid, { row: 3, col: 2 }, "X+") };
		const kingDests = jumpDestinations(
			grid,
			{ row: 3, col: 2 },
			HEX_FLY_CAP,
			HEX_BOARD
		);
		expect(kingDests.some((p) => p.row === 1 && p.col === 1)).toBe(true);
		expect(kingDests.some((p) => p.row === 0 && p.col === 1)).toBe(true);
	});

	it("empty approach before mid is legal for crowned on hex", () => {
		let grid = emptyHexGrid();
		// From (4,3) along d={q:0,r:-1}: (3,2) empty → (2,2) O → lands (1,1)/(0,1)
		grid = { ...grid, cells: setCell(grid, { row: 4, col: 3 }, "X+") };
		grid = { ...grid, cells: setCell(grid, { row: 2, col: 2 }, "O") };
		const dests = jumpDestinations(
			grid,
			{ row: 4, col: 3 },
			HEX_FLY_CAP,
			HEX_BOARD
		);
		expect(dests.some((p) => p.row === 1 && p.col === 1)).toBe(true);
		expect(dests.some((p) => p.row === 0 && p.col === 1)).toBe(true);
		expect(
			isJumpCapture(
				grid,
				{ row: 4, col: 3 },
				{ row: 0, col: 1 },
				"X",
				HEX_FLY_CAP,
				HEX_BOARD
			)
		).toBe(true);
		const eff = effectiveMovement(HEX_FLY_CAP, "X+");
		expect(
			jumpMid(
				{ row: 4, col: 3 },
				{ row: 0, col: 1 },
				eff,
				HEX_BOARD,
				grid
			)
		).toEqual({ row: 2, col: 2 });
	});

	it("without crownedFlyingCapture, long hex land is illegal", () => {
		let grid = emptyHexGrid();
		grid = { ...grid, cells: setCell(grid, { row: 3, col: 2 }, "X+") };
		grid = { ...grid, cells: setCell(grid, { row: 2, col: 2 }, "O") };
		const noFly: MovementConfig = {
			...HEX_FLY_CAP,
			promotion: {
				targetRows: { X: 3, O: 2 },
				crownedAdjacency: "orthogonal",
				crownedRange: 4
			}
		};
		const dests = jumpDestinations(
			grid,
			{ row: 3, col: 2 },
			noFly,
			HEX_BOARD
		);
		expect(dests).toEqual([{ row: 1, col: 1 }]);
		expect(
			isJumpCapture(
				grid,
				{ row: 3, col: 2 },
				{ row: 0, col: 1 },
				"X",
				noFly,
				HEX_BOARD
			)
		).toBe(false);
	});

	it("quiet hex slide blocked by enemy; flying jump clears it", () => {
		let grid = emptyHexGrid();
		grid = { ...grid, cells: setCell(grid, { row: 3, col: 2 }, "X+") };
		grid = { ...grid, cells: setCell(grid, { row: 2, col: 2 }, "O") };
		const quietOnly = legalDestinations(
			grid,
			{ row: 3, col: 2 },
			{
				...HEX_FLY_CAP,
				capture: "none",
				mustCapture: false
			},
			HEX_BOARD
		);
		expect(quietOnly.some((p) => p.row === 0 && p.col === 1)).toBe(false);
		expect(
			jumpDestinations(grid, { row: 3, col: 2 }, HEX_FLY_CAP, HEX_BOARD).some(
				(p) => p.row === 0 && p.col === 1
			)
		).toBe(true);
	});
});

describe("GameIR hex flying capture win", () => {
	it("transcript + replay: promote then chain flying-capture win", () => {
		const cfg = examplePresets["hex-flying-capture-jump-lite"].config;
		const { gameConfig } = compileConfig(cfg);
		const actions: KernelAction[] = [
			{ type: "move", from: { row: 5, col: 3 }, to: { row: 3, col: 2 } },
			{ type: "move", from: { row: 3, col: 2 }, to: { row: 0, col: 1 } }
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
		expect(getCell(finalState.grid, { row: 0, col: 1 })).toBe("X+");
		expect(getCell(finalState.grid, { row: 2, col: 2 })).toBe(null);
		expect(finalState.status).toBe("won");
		expect(finalState.winner).toBe("X");
	});
});

describe("Hex Flying Capture Jump Lite preset", () => {
	it("opening jump promotes; chain flying capture wins", () => {
		const cfg = examplePresets["hex-flying-capture-jump-lite"].config;
		expect(validateConfig(cfg).ok).toBe(true);
		const { kernel, gameConfig } = compileConfig(cfg);
		expect(gameConfig.topology).toBe("hex_offset");
		expect(gameConfig.movement?.promotion?.crownedFlyingCapture).toBe(true);
		expect(gameConfig.movement?.promotion?.crownedRange).toBe(4);
		expect(gameConfig.objectiveMode).toBe("reach_row");

		let state = createInitialState(gameConfig);
		expect(getCell(state.grid, { row: 5, col: 3 })).toBe("X");
		const opening = kernel.legalActions(state, 0);
		expect(opening).toEqual([
			{ type: "move", from: { row: 5, col: 3 }, to: { row: 3, col: 2 } }
		]);
		let result = kernel.stepSync(state, opening[0]!);
		expect(getCell(result.nextState.grid, { row: 3, col: 2 })).toBe("X+");
		expect(result.events.some((e) => e.type === "piecePromoted")).toBe(
			true
		);
		expect(result.nextState.mustContinueFrom).toEqual({
			row: 3,
			col: 2
		});
		state = result.nextState;

		const chainLegal = kernel.legalActions(state, 0);
		expect(
			chainLegal.some(
				(a) =>
					a.type === "move" &&
					a.from.row === 3 &&
					a.from.col === 2 &&
					a.to.row === 0 &&
					a.to.col === 1
			)
		).toBe(true);
		expect(
			chainLegal.some(
				(a) =>
					a.type === "move" &&
					a.from.row === 3 &&
					a.from.col === 2 &&
					a.to.row === 1 &&
					a.to.col === 1
			)
		).toBe(true);

		// Contrast: without crownedFlyingCapture only adjacent land is legal.
		expect(
			jumpDestinations(
				state.grid,
				{ row: 3, col: 2 },
				{
					...HEX_FLY_CAP,
					promotion: {
						targetRows: { X: 3, O: 2 },
						crownedAdjacency: "orthogonal",
						crownedRange: 4
					}
				},
				HEX_BOARD
			)
		).toEqual([{ row: 1, col: 1 }]);

		result = kernel.stepSync(state, {
			type: "move",
			from: { row: 3, col: 2 },
			to: { row: 0, col: 1 }
		});
		expect(getCell(result.nextState.grid, { row: 0, col: 1 })).toBe("X+");
		expect(getCell(result.nextState.grid, { row: 2, col: 2 })).toBe(null);
		expect(result.nextState.status).toBe("won");
		expect(result.nextState.winner).toBe("X");
	});
});
