import { describe, expect, it } from "vitest";
import { compileConfig } from "@/compiler";
import {
	effectiveMovement,
	hasAnyJumpCapture,
	jumpDestinations,
	legalDestinations,
	type MovementConfig
} from "@/engine/movement";
import { cellOwner, isCrowned, promote } from "@/engine/pieces";
import type { KernelAction } from "@/engine/kernel";
import { createInitialState } from "@/engine/reducer";
import { getCell, setCell, type Grid } from "@/engine/types";
import { examplePresets } from "@/presets/registry";
import { validateConfig } from "@/engine/validateConfig";
import { replayActions } from "@/ir/gameIr";
import { zConfig } from "@/schemas/config";

const PROMO: MovementConfig = {
	adjacency: "diagonal",
	range: 1,
	capture: "jump",
	mustCapture: true,
	promotion: {
		targetRows: { X: 1, O: 3 },
		crownedAdjacency: "king"
	}
};

function emptyGrid(w = 5, h = 5): Grid {
	return { width: w, height: h, cells: Array(w * h).fill(null) };
}

describe("movement.promotion schema", () => {
	it("accepts promotion with jump on rectangle", () => {
		const cfg = examplePresets["crowned-jump-race"].config;
		expect(validateConfig(cfg).ok).toBe(true);
		const parsed = zConfig.safeParse(cfg);
		expect(parsed.success).toBe(true);
		if (parsed.success) {
			expect(parsed.data.movement?.promotion?.targetRows).toEqual({
				X: 1,
				O: 3
			});
			expect(parsed.data.movement?.promotion?.crownedAdjacency).toBe(
				"king"
			);
		}
	});

	it("rejects promotion without jump", () => {
		const base = structuredClone(examplePresets["crowned-jump-race"].config);
		base.movement = {
			adjacency: "diagonal",
			range: 1,
			capture: "none",
			promotion: {
				targetRows: { X: 1, O: 3 },
				crownedAdjacency: "king"
			}
		};
		const parsed = zConfig.safeParse(base);
		expect(parsed.success).toBe(false);
	});

	it("rejects promotion on hex_offset", () => {
		const base = structuredClone(examplePresets["hex-jump-race"].config);
		base.movement = {
			adjacency: "orthogonal",
			range: 1,
			capture: "jump",
			promotion: {
				targetRows: { X: 1, O: 3 },
				crownedAdjacency: "king"
			}
		};
		const parsed = zConfig.safeParse(base);
		expect(parsed.success).toBe(false);
	});

	it("rejects promotion on graph", () => {
		const base = structuredClone(examplePresets["graph-jump-race"].config);
		base.movement = {
			adjacency: "orthogonal",
			range: 1,
			capture: "jump",
			promotion: {
				targetRows: { X: 1, O: 3 },
				crownedAdjacency: "king"
			}
		};
		const parsed = zConfig.safeParse(base);
		expect(parsed.success).toBe(false);
	});
});

describe("piece helpers", () => {
	it("cellOwner / isCrowned / promote", () => {
		expect(cellOwner("X")).toBe("X");
		expect(cellOwner("X+")).toBe("X");
		expect(cellOwner("O+")).toBe("O");
		expect(cellOwner(null)).toBeNull();
		expect(isCrowned("X")).toBe(false);
		expect(isCrowned("X+")).toBe(true);
		expect(promote("X")).toBe("X+");
		expect(promote("X+")).toBe("X+");
		expect(promote(null)).toBeNull();
	});
});

describe("promotion apply + events", () => {
	it("quiet land on promotion row → X+ + piecePromoted", () => {
		const { gameConfig, kernel } = compileConfig({
			...examplePresets["crowned-jump-race"].config,
			movement: {
				adjacency: "diagonal",
				range: 1,
				capture: "jump",
				promotion: {
					targetRows: { X: 1, O: 3 },
					crownedAdjacency: "king"
				}
			},
			initial: [
				{ row: 2, col: 2, player: "X", visibility: "public" },
				{ row: 4, col: 4, player: "O", visibility: "public" }
			]
		});
		expect(gameConfig.movement?.promotion?.targetRows.X).toBe(1);
		const state = kernel.initialState(42);
		expect(getCell(state.grid, { row: 2, col: 2 })).toBe("X");
		const quiet: KernelAction = {
			type: "move",
			from: { row: 2, col: 2 },
			to: { row: 1, col: 1 }
		};
		const result = kernel.stepSync(state, quiet);
		expect(result.events.some((e) => e.type === "ignored")).toBe(false);
		expect(getCell(result.nextState.grid, { row: 1, col: 1 })).toBe("X+");
		expect(
			result.events.some(
				(e) =>
					e.type === "piecePromoted" &&
					e.player === "X" &&
					e.at.row === 1 &&
					e.at.col === 1
			)
		).toBe(true);
		// Promo row ≠ win row → still playing after quiet promote.
		expect(result.nextState.status).toBe("playing");
	});

	it("jump land on promotion row promotes without winning", () => {
		const cfg = examplePresets["crowned-jump-race"].config;
		const { kernel } = compileConfig(cfg);
		const state = kernel.initialState(cfg.rng.seed);
		const jump: KernelAction = {
			type: "move",
			from: { row: 3, col: 2 },
			to: { row: 1, col: 0 }
		};
		const result = kernel.stepSync(state, jump);
		expect(result.events.some((e) => e.type === "ignored")).toBe(false);
		expect(getCell(result.nextState.grid, { row: 1, col: 0 })).toBe("X+");
		expect(getCell(result.nextState.grid, { row: 2, col: 1 })).toBeNull();
		expect(
			result.events.some(
				(e) =>
					e.type === "pieceCaptured" &&
					e.captured === "O" &&
					e.by === "X"
			)
		).toBe(true);
		expect(
			result.events.some(
				(e) =>
					e.type === "piecePromoted" &&
					e.player === "X" &&
					e.at.row === 1 &&
					e.at.col === 0
			)
		).toBe(true);
		expect(result.nextState.status).toBe("playing");
		expect(result.nextState.currentPlayer).toBe("O");
	});
});

describe("crowned adjacency via effectiveMovement", () => {
	it("crowned piece has king quiet destinations; uncrowned diagonal does not", () => {
		let grid = emptyGrid();
		grid = { ...grid, cells: setCell(grid, { row: 2, col: 2 }, "X+") };
		const crownedDests = legalDestinations(grid, { row: 2, col: 2 }, PROMO);
		// King: orthogonal (1,2)/(3,2)/(2,1)/(2,3) + diagonals
		expect(crownedDests).toEqual(
			expect.arrayContaining([
				{ row: 1, col: 2 },
				{ row: 3, col: 2 },
				{ row: 2, col: 1 },
				{ row: 2, col: 3 },
				{ row: 1, col: 1 },
				{ row: 1, col: 3 },
				{ row: 3, col: 1 },
				{ row: 3, col: 3 }
			])
		);
		expect(crownedDests).toHaveLength(8);
		expect(effectiveMovement(PROMO, "X+").adjacency).toBe("king");

		grid = { ...grid, cells: setCell(grid, { row: 2, col: 2 }, "X") };
		const manDests = legalDestinations(grid, { row: 2, col: 2 }, PROMO);
		expect(manDests).toEqual(
			expect.arrayContaining([
				{ row: 1, col: 1 },
				{ row: 1, col: 3 },
				{ row: 3, col: 1 },
				{ row: 3, col: 3 }
			])
		);
		expect(manDests).toHaveLength(4);
		expect(manDests.some((p) => p.row === 1 && p.col === 2)).toBe(false);
		expect(effectiveMovement(PROMO, "X").adjacency).toBe("diagonal");
	});
});

describe("mustCapture with crowned marks", () => {
	it("treats crowned enemies/movers for jump + mustCapture", () => {
		let grid = emptyGrid();
		// X+ can jump over O+ diagonally to empty
		grid = { ...grid, cells: setCell(grid, { row: 4, col: 0 }, "X+") };
		grid = { ...grid, cells: setCell(grid, { row: 3, col: 1 }, "O+") };
		expect(hasAnyJumpCapture(grid, "X", PROMO)).toBe(true);
		expect(jumpDestinations(grid, { row: 4, col: 0 }, PROMO, false, "X")).toEqual([
			{ row: 2, col: 2 }
		]);
		// Quiet also exists for king, but mustCapture is enforced in reducer/kernel.
		const quietAlso = legalDestinations(grid, { row: 4, col: 0 }, PROMO);
		expect(quietAlso.some((p) => p.row === 3 && p.col === 0)).toBe(true);
	});
});

describe("GameIR promote + crowned win sequence", () => {
	it("transcript + replay: promote then crowned orthogonal win", () => {
		const cfg = examplePresets["crowned-jump-race"].config;
		const { gameConfig } = compileConfig(cfg);
		const actions: KernelAction[] = [
			{ type: "move", from: { row: 3, col: 2 }, to: { row: 1, col: 0 } },
			{ type: "move", from: { row: 4, col: 4 }, to: { row: 3, col: 3 } },
			{ type: "move", from: { row: 1, col: 0 }, to: { row: 0, col: 0 } }
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

describe("Crowned Kings Jump Lite preset", () => {
	it("opening jump promotes; crowned orthogonal then wins", () => {
		const cfg = examplePresets["crowned-jump-race"].config;
		expect(validateConfig(cfg).ok).toBe(true);
		const { kernel, gameConfig } = compileConfig(cfg);
		expect(gameConfig.movement?.promotion?.crownedAdjacency).toBe("king");
		expect(gameConfig.movement?.promotion?.targetRows).toEqual({
			X: 1,
			O: 3
		});
		expect(gameConfig.objectiveMode).toBe("reach_row");
		expect(gameConfig.targetRows).toEqual({ X: 0, O: 4 });

		let state = createInitialState(gameConfig);
		expect(getCell(state.grid, { row: 3, col: 2 })).toBe("X");
		const opening = kernel.legalActions(state, 0);
		// mustCapture: only the promoting jump to row 1
		expect(opening).toEqual([
			{ type: "move", from: { row: 3, col: 2 }, to: { row: 1, col: 0 } }
		]);
		let result = kernel.stepSync(state, opening[0]!);
		expect(getCell(result.nextState.grid, { row: 1, col: 0 })).toBe("X+");
		expect(result.events.some((e) => e.type === "piecePromoted")).toBe(
			true
		);
		expect(result.nextState.status).toBe("playing");
		state = result.nextState;

		// O replies with a quiet diagonal step
		const oLegal = kernel.legalActions(state, 1);
		expect(
			oLegal.some(
				(a) =>
					a.type === "move" &&
					a.from.row === 4 &&
					a.from.col === 4 &&
					a.to.row === 3 &&
					a.to.col === 3
			)
		).toBe(true);
		result = kernel.stepSync(state, {
			type: "move",
			from: { row: 4, col: 4 },
			to: { row: 3, col: 3 }
		});
		state = result.nextState;

		// Crowned X+ at (1,0): orthogonal (0,0) is legal; men would not have it
		const crownedLegal = kernel.legalActions(state, 0);
		expect(
			crownedLegal.some(
				(a) =>
					a.type === "move" &&
					a.from.row === 1 &&
					a.from.col === 0 &&
					a.to.row === 0 &&
					a.to.col === 0
			)
		).toBe(true);
		// Sanity: uncrowned diagonal from (1,0) cannot step to (0,0)
		expect(
			legalDestinations(
				{ ...state.grid, cells: setCell(state.grid, { row: 1, col: 0 }, "X") },
				{ row: 1, col: 0 },
				{ ...PROMO, mustCapture: false }
			).some((p) => p.row === 0 && p.col === 0)
		).toBe(false);

		result = kernel.stepSync(state, {
			type: "move",
			from: { row: 1, col: 0 },
			to: { row: 0, col: 0 }
		});
		expect(getCell(result.nextState.grid, { row: 0, col: 0 })).toBe("X+");
		expect(result.nextState.status).toBe("won");
		expect(result.nextState.winner).toBe("X");
	});
});
