import { describe, expect, it } from "vitest";
import { compileConfig } from "@/compiler";
import {
	effectiveMovement,
	legalDestinations,
	type MovementConfig
} from "@/engine/movement";
import type { KernelAction } from "@/engine/kernel";
import { createInitialState } from "@/engine/reducer";
import { getCell, setCell, type Grid } from "@/engine/types";
import { examplePresets } from "@/presets/registry";
import { validateConfig } from "@/engine/validateConfig";
import { replayActions } from "@/ir/gameIr";
import { zConfig } from "@/schemas/config";

const HEX_PROMO: MovementConfig = {
	adjacency: "orthogonal",
	range: 1,
	capture: "jump",
	mustCapture: true,
	promotion: {
		targetRows: { X: 2, O: 3 },
		crownedAdjacency: "orthogonal",
		crownedRange: 2
	}
};

function emptyHexGrid(w = 6, h = 6): Grid {
	return { width: w, height: h, cells: Array(w * h).fill(null) };
}

describe("hex movement.promotion schema", () => {
	it("accepts promotion with jump on hex_offset", () => {
		const cfg = examplePresets["hex-crowned-jump-lite"].config;
		expect(validateConfig(cfg).ok).toBe(true);
		const parsed = zConfig.safeParse(cfg);
		expect(parsed.success).toBe(true);
		if (parsed.success) {
			expect(parsed.data.grid.topology).toBe("hex_offset");
			expect(parsed.data.movement?.promotion?.targetRows).toEqual({
				X: 2,
				O: 3
			});
			expect(parsed.data.movement?.promotion?.crownedAdjacency).toBe(
				"orthogonal"
			);
			expect(parsed.data.movement?.promotion?.crownedRange).toBe(2);
		}
	});

	it("rejects hex promotion with menForwardOnly", () => {
		const base = structuredClone(
			examplePresets["hex-crowned-jump-lite"].config
		);
		base.movement = {
			...base.movement!,
			promotion: {
				...base.movement!.promotion!,
				menForwardOnly: true
			}
		};
		const parsed = zConfig.safeParse(base);
		expect(parsed.success).toBe(false);
	});

	it("rejects hex promotion with crownedFlyingCapture", () => {
		const base = structuredClone(
			examplePresets["hex-crowned-jump-lite"].config
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

	it("rejects hex promotion when crownedAdjacency omitted (defaults king)", () => {
		const base = structuredClone(
			examplePresets["hex-crowned-jump-lite"].config
		);
		const promo = { ...base.movement!.promotion! };
		delete (promo as { crownedAdjacency?: string }).crownedAdjacency;
		base.movement = {
			...base.movement!,
			promotion: promo
		};
		const parsed = zConfig.safeParse(base);
		// Zod defaults omitted crownedAdjacency to king → hex refine rejects.
		expect(parsed.success).toBe(false);
	});
});

describe("hex crowned movement via effectiveMovement", () => {
	it("crowned pieces use crownedRange on hex; men keep range 1", () => {
		expect(effectiveMovement(HEX_PROMO, "X").range).toBe(1);
		expect(effectiveMovement(HEX_PROMO, "X+").range).toBe(2);
		expect(effectiveMovement(HEX_PROMO, "X+").adjacency).toBe("orthogonal");
	});

	it("crowned king adjacency yields no hex destinations (schema gap)", () => {
		let grid = emptyHexGrid();
		grid = { ...grid, cells: setCell(grid, { row: 2, col: 2 }, "X+") };
		const broken: MovementConfig = {
			...HEX_PROMO,
			promotion: {
				targetRows: { X: 2, O: 3 },
				crownedAdjacency: "king",
				crownedRange: 2
			}
		};
		expect(
			legalDestinations(grid, { row: 2, col: 2 }, broken, {
				topology: "hex_offset"
			})
		).toEqual([]);
	});

	it("uncrowned max quiet distance = 1; crowned = crownedRange on hex", () => {
		let grid = emptyHexGrid();
		grid = { ...grid, cells: setCell(grid, { row: 2, col: 1 }, "X") };
		const manDests = legalDestinations(grid, { row: 2, col: 1 }, HEX_PROMO, {
			topology: "hex_offset"
		});
		expect(manDests.some((p) => p.row === 0)).toBe(false);

		grid = { ...grid, cells: setCell(grid, { row: 2, col: 1 }, "X+") };
		const crownedDests = legalDestinations(
			grid,
			{ row: 2, col: 1 },
			{ ...HEX_PROMO, mustCapture: false },
			{ topology: "hex_offset" }
		);
		expect(
			crownedDests.some((p) => p.row === 0 && p.col === 0)
		).toBe(true);
		expect(
			crownedDests.some((p) => p.row === 0 && p.col === 2)
		).toBe(true);
	});
});

describe("GameIR hex crowned quiet win", () => {
	it("transcript + replay: promote then crownedRange-2 cube-axis win", () => {
		const cfg = examplePresets["hex-crowned-jump-lite"].config;
		const { gameConfig } = compileConfig(cfg);
		const actions: KernelAction[] = [
			{ type: "move", from: { row: 4, col: 2 }, to: { row: 2, col: 1 } },
			{ type: "move", from: { row: 5, col: 5 }, to: { row: 4, col: 5 } },
			{ type: "move", from: { row: 2, col: 1 }, to: { row: 0, col: 0 } }
		];
		const { finalState, faithful, events } = replayActions(
			gameConfig,
			actions,
			cfg.rng.seed
		);
		expect(faithful).toBe(true);
		expect(events.some((e) => e.type === "piecePromoted")).toBe(true);
		expect(getCell(finalState.grid, { row: 0, col: 0 })).toBe("X+");
		expect(finalState.status).toBe("won");
		expect(finalState.winner).toBe("X");
	});
});

describe("Hex Crowned Jump Lite preset", () => {
	it("opening jump promotes; crownedRange-2 quiet then wins", () => {
		const cfg = examplePresets["hex-crowned-jump-lite"].config;
		expect(validateConfig(cfg).ok).toBe(true);
		const { kernel, gameConfig } = compileConfig(cfg);
		expect(gameConfig.topology).toBe("hex_offset");
		expect(gameConfig.movement?.promotion?.crownedRange).toBe(2);
		expect(gameConfig.movement?.promotion?.crownedAdjacency).toBe(
			"orthogonal"
		);
		expect(gameConfig.movement?.range).toBe(1);
		expect(gameConfig.objectiveMode).toBe("reach_row");
		expect(gameConfig.targetRows).toEqual({ X: 0, O: 5 });

		let state = createInitialState(gameConfig);
		expect(getCell(state.grid, { row: 4, col: 2 })).toBe("X");
		const opening = kernel.legalActions(state, 0);
		expect(opening).toEqual([
			{ type: "move", from: { row: 4, col: 2 }, to: { row: 2, col: 1 } }
		]);
		let result = kernel.stepSync(state, opening[0]!);
		expect(getCell(result.nextState.grid, { row: 2, col: 1 })).toBe("X+");
		expect(getCell(result.nextState.grid, { row: 3, col: 1 })).toBeNull();
		expect(result.events.some((e) => e.type === "piecePromoted")).toBe(
			true
		);
		expect(result.nextState.status).toBe("playing");
		state = result.nextState;

		const oLegal = kernel.legalActions(state, 1);
		expect(
			oLegal.some(
				(a) =>
					a.type === "move" &&
					a.from.row === 5 &&
					a.from.col === 5 &&
					a.to.row === 4 &&
					a.to.col === 5
			)
		).toBe(true);
		result = kernel.stepSync(state, {
			type: "move",
			from: { row: 5, col: 5 },
			to: { row: 4, col: 5 }
		});
		state = result.nextState;

		const crownedLegal = kernel.legalActions(state, 0);
		expect(
			crownedLegal.some(
				(a) =>
					a.type === "move" &&
					a.from.row === 2 &&
					a.from.col === 1 &&
					a.to.row === 0 &&
					a.to.col === 0
			)
		).toBe(true);

		// Contrast: uncrowned / crownedRange omitted cannot reach win row 0.
		expect(
			legalDestinations(
				{
					...state.grid,
					cells: setCell(state.grid, { row: 2, col: 1 }, "X")
				},
				{ row: 2, col: 1 },
				{ ...HEX_PROMO, mustCapture: false },
				{ topology: "hex_offset" }
			).some((p) => p.row === 0)
		).toBe(false);
		expect(
			legalDestinations(
				state.grid,
				{ row: 2, col: 1 },
				{
					...HEX_PROMO,
					mustCapture: false,
					promotion: {
						targetRows: { X: 2, O: 3 },
						crownedAdjacency: "orthogonal"
					}
				},
				{ topology: "hex_offset" }
			).some((p) => p.row === 0)
		).toBe(false);

		result = kernel.stepSync(state, {
			type: "move",
			from: { row: 2, col: 1 },
			to: { row: 0, col: 0 }
		});
		expect(getCell(result.nextState.grid, { row: 0, col: 0 })).toBe("X+");
		expect(result.nextState.status).toBe("won");
		expect(result.nextState.winner).toBe("X");
	});
});
