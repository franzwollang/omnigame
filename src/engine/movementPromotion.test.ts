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
		targetRows: { X: 0, O: 4 },
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
				X: 0,
				O: 4
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
				targetRows: { X: 0, O: 4 },
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
				targetRows: { X: 0, O: 4 },
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
				targetRows: { X: 0, O: 4 },
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
					targetRows: { X: 0, O: 4 },
					crownedAdjacency: "king"
				}
			},
			initial: [
				{ row: 1, col: 2, player: "X", visibility: "public" },
				{ row: 4, col: 4, player: "O", visibility: "public" }
			]
		});
		expect(gameConfig.movement?.promotion?.targetRows.X).toBe(0);
		const state = kernel.initialState(42);
		expect(getCell(state.grid, { row: 1, col: 2 })).toBe("X");
		const quiet: KernelAction = {
			type: "move",
			from: { row: 1, col: 2 },
			to: { row: 0, col: 1 }
		};
		const result = kernel.stepSync(state, quiet);
		expect(result.events.some((e) => e.type === "ignored")).toBe(false);
		expect(getCell(result.nextState.grid, { row: 0, col: 1 })).toBe("X+");
		expect(
			result.events.some(
				(e) =>
					e.type === "piecePromoted" &&
					e.player === "X" &&
					e.at.row === 0 &&
					e.at.col === 1
			)
		).toBe(true);
		expect(result.nextState.status).toBe("won");
		expect(result.nextState.winner).toBe("X");
	});

	it("jump land on promotion row promotes", () => {
		const cfg = examplePresets["crowned-jump-race"].config;
		const { kernel } = compileConfig(cfg);
		const state = kernel.initialState(cfg.rng.seed);
		const jump: KernelAction = {
			type: "move",
			from: { row: 2, col: 2 },
			to: { row: 0, col: 0 }
		};
		const result = kernel.stepSync(state, jump);
		expect(result.events.some((e) => e.type === "ignored")).toBe(false);
		expect(getCell(result.nextState.grid, { row: 0, col: 0 })).toBe("X+");
		expect(getCell(result.nextState.grid, { row: 1, col: 1 })).toBeNull();
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
					e.at.row === 0 &&
					e.at.col === 0
			)
		).toBe(true);
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

describe("GameIR promote sequence", () => {
	it("transcript + replay for promote jump", () => {
		const cfg = examplePresets["crowned-jump-race"].config;
		const { gameConfig } = compileConfig(cfg);
		const actions: KernelAction[] = [
			{ type: "move", from: { row: 2, col: 2 }, to: { row: 0, col: 0 } }
		];
		const { finalState, faithful, events } = replayActions(
			gameConfig,
			actions,
			cfg.rng.seed
		);
		expect(faithful).toBe(true);
		expect(getCell(finalState.grid, { row: 0, col: 0 })).toBe("X+");
		expect(events.some((e) => e.type === "piecePromoted")).toBe(true);
		expect(finalState.status).toBe("won");
	});
});

describe("Crowned Kings Jump Lite preset", () => {
	it("loads and demonstrates promotion on opening jump", () => {
		const cfg = examplePresets["crowned-jump-race"].config;
		expect(validateConfig(cfg).ok).toBe(true);
		const { kernel, gameConfig } = compileConfig(cfg);
		expect(gameConfig.movement?.promotion?.crownedAdjacency).toBe("king");
		const state = createInitialState(gameConfig);
		expect(getCell(state.grid, { row: 2, col: 2 })).toBe("X");
		const legal = kernel.legalActions(state, 0);
		// mustCapture: only the promoting jump
		expect(legal).toEqual([
			{ type: "move", from: { row: 2, col: 2 }, to: { row: 0, col: 0 } }
		]);
		const result = kernel.stepSync(state, legal[0]!);
		expect(getCell(result.nextState.grid, { row: 0, col: 0 })).toBe("X+");
		expect(result.events.some((e) => e.type === "piecePromoted")).toBe(
			true
		);
	});
});
