import { describe, expect, it } from "vitest";
import { compileConfig } from "@/compiler";
import {
	effectiveMovement,
	jumpDestinations,
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

const FLYING: MovementConfig = {
	adjacency: "diagonal",
	range: 1,
	capture: "jump",
	mustCapture: true,
	promotion: {
		targetRows: { X: 2, O: 3 },
		crownedAdjacency: "diagonal",
		crownedRange: 2
	}
};

function emptyGrid(w = 6, h = 6): Grid {
	return { width: w, height: h, cells: Array(w * h).fill(null) };
}

describe("promotion.crownedRange schema", () => {
	it("accepts crownedRange with jump promotion", () => {
		const cfg = examplePresets["flying-kings-jump-lite"].config;
		expect(validateConfig(cfg).ok).toBe(true);
		const parsed = zConfig.safeParse(cfg);
		expect(parsed.success).toBe(true);
		if (parsed.success) {
			expect(parsed.data.movement?.promotion?.crownedRange).toBe(2);
			expect(parsed.data.movement?.promotion?.crownedAdjacency).toBe(
				"diagonal"
			);
			expect(parsed.data.movement?.range).toBe(1);
		}
	});

	it("rejects movement.range > 1 even with crownedRange", () => {
		const base = structuredClone(
			examplePresets["flying-kings-jump-lite"].config
		);
		base.movement = {
			...base.movement!,
			range: 2
		};
		const parsed = zConfig.safeParse(base);
		expect(parsed.success).toBe(false);
	});

	it("rejects crownedRange without jump capture", () => {
		const base = structuredClone(
			examplePresets["flying-kings-jump-lite"].config
		);
		base.movement = {
			adjacency: "diagonal",
			range: 1,
			capture: "none",
			promotion: {
				targetRows: { X: 2, O: 3 },
				crownedAdjacency: "diagonal",
				crownedRange: 2
			}
		};
		const parsed = zConfig.safeParse(base);
		expect(parsed.success).toBe(false);
	});
});

describe("crownedRange via effectiveMovement", () => {
	it("crowned pieces use crownedRange; men keep range 1", () => {
		expect(effectiveMovement(FLYING, "X+").range).toBe(2);
		expect(effectiveMovement(FLYING, "X+").adjacency).toBe("diagonal");
		expect(effectiveMovement(FLYING, "X").range).toBe(1);
		expect(effectiveMovement(FLYING, "X").adjacency).toBe("diagonal");
	});

	it("defaults crownedRange to men range when omitted", () => {
		const noFly: MovementConfig = {
			...FLYING,
			promotion: {
				targetRows: { X: 2, O: 3 },
				crownedAdjacency: "diagonal"
			}
		};
		expect(effectiveMovement(noFly, "X+").range).toBe(1);
	});

	it("uncrowned max quiet distance = 1; crowned = crownedRange", () => {
		let grid = emptyGrid();
		grid = { ...grid, cells: setCell(grid, { row: 2, col: 4 }, "X") };
		const manDests = legalDestinations(
			grid,
			{ row: 2, col: 4 },
			{ ...FLYING, mustCapture: false }
		);
		expect(manDests.some((p) => p.row === 0 && p.col === 2)).toBe(false);
		expect(manDests.some((p) => p.row === 1 && p.col === 3)).toBe(true);

		grid = { ...grid, cells: setCell(grid, { row: 2, col: 4 }, "X+") };
		const kingDests = legalDestinations(
			grid,
			{ row: 2, col: 4 },
			{ ...FLYING, mustCapture: false }
		);
		expect(kingDests.some((p) => p.row === 0 && p.col === 2)).toBe(true);
		expect(kingDests.some((p) => p.row === 1 && p.col === 3)).toBe(true);
	});

	it("jump destinations unchanged with crownedRange", () => {
		let grid = emptyGrid();
		grid = { ...grid, cells: setCell(grid, { row: 4, col: 2 }, "X+") };
		grid = { ...grid, cells: setCell(grid, { row: 3, col: 3 }, "O") };
		const withFly = jumpDestinations(grid, { row: 4, col: 2 }, FLYING);
		const noFlyCfg: MovementConfig = {
			...FLYING,
			promotion: {
				targetRows: { X: 2, O: 3 },
				crownedAdjacency: "diagonal"
			}
		};
		const withoutFly = jumpDestinations(
			grid,
			{ row: 4, col: 2 },
			noFlyCfg
		);
		expect(withFly).toEqual(withoutFly);
		expect(withFly).toEqual([{ row: 2, col: 4 }]);
	});
});

describe("GameIR flying crowned quiet win", () => {
	it("transcript + replay: promote then crownedRange-2 diagonal win", () => {
		const cfg = examplePresets["flying-kings-jump-lite"].config;
		const { gameConfig } = compileConfig(cfg);
		const actions: KernelAction[] = [
			{ type: "move", from: { row: 4, col: 2 }, to: { row: 2, col: 4 } },
			{ type: "move", from: { row: 5, col: 5 }, to: { row: 4, col: 4 } },
			{ type: "move", from: { row: 2, col: 4 }, to: { row: 0, col: 2 } }
		];
		const { finalState, faithful, events } = replayActions(
			gameConfig,
			actions,
			cfg.rng.seed
		);
		expect(faithful).toBe(true);
		expect(events.some((e) => e.type === "piecePromoted")).toBe(true);
		expect(getCell(finalState.grid, { row: 0, col: 2 })).toBe("X+");
		expect(finalState.status).toBe("won");
		expect(finalState.winner).toBe("X");
	});
});

describe("Flying Kings Jump Lite preset", () => {
	it("opening jump promotes; crownedRange-2 quiet then wins", () => {
		const cfg = examplePresets["flying-kings-jump-lite"].config;
		expect(validateConfig(cfg).ok).toBe(true);
		const { kernel, gameConfig } = compileConfig(cfg);
		expect(gameConfig.movement?.promotion?.crownedRange).toBe(2);
		expect(gameConfig.movement?.promotion?.crownedAdjacency).toBe(
			"diagonal"
		);
		expect(gameConfig.movement?.range).toBe(1);
		expect(gameConfig.objectiveMode).toBe("reach_row");
		expect(gameConfig.targetRows).toEqual({ X: 0, O: 5 });

		let state = createInitialState(gameConfig);
		expect(getCell(state.grid, { row: 4, col: 2 })).toBe("X");
		const opening = kernel.legalActions(state, 0);
		expect(opening).toEqual([
			{ type: "move", from: { row: 4, col: 2 }, to: { row: 2, col: 4 } }
		]);
		let result = kernel.stepSync(state, opening[0]!);
		expect(getCell(result.nextState.grid, { row: 2, col: 4 })).toBe("X+");
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
					a.to.col === 4
			)
		).toBe(true);
		result = kernel.stepSync(state, {
			type: "move",
			from: { row: 5, col: 5 },
			to: { row: 4, col: 4 }
		});
		state = result.nextState;

		const crownedLegal = kernel.legalActions(state, 0);
		expect(
			crownedLegal.some(
				(a) =>
					a.type === "move" &&
					a.from.row === 2 &&
					a.from.col === 4 &&
					a.to.row === 0 &&
					a.to.col === 2
			)
		).toBe(true);

		// Contrast: same board with uncrowned / crownedRange omitted cannot
		// reach win row 0 in one quiet from (2,4).
		expect(
			legalDestinations(
				{
					...state.grid,
					cells: setCell(state.grid, { row: 2, col: 4 }, "X")
				},
				{ row: 2, col: 4 },
				{ ...FLYING, mustCapture: false }
			).some((p) => p.row === 0 && p.col === 2)
		).toBe(false);
		expect(
			legalDestinations(
				state.grid,
				{ row: 2, col: 4 },
				{
					...FLYING,
					mustCapture: false,
					promotion: {
						targetRows: { X: 2, O: 3 },
						crownedAdjacency: "diagonal"
					}
				}
			).some((p) => p.row === 0 && p.col === 2)
		).toBe(false);

		result = kernel.stepSync(state, {
			type: "move",
			from: { row: 2, col: 4 },
			to: { row: 0, col: 2 }
		});
		expect(getCell(result.nextState.grid, { row: 0, col: 2 })).toBe("X+");
		expect(result.nextState.status).toBe("won");
		expect(result.nextState.winner).toBe("X");
	});
});
