import { describe, expect, it } from "vitest";
import { compileConfig } from "@/compiler";
import {
	isForwardRowDelta,
	jumpDestinations,
	legalDestinations,
	manForwardRowSign,
	type MovementConfig
} from "@/engine/movement";
import type { KernelAction } from "@/engine/kernel";
import { createInitialState } from "@/engine/reducer";
import { getCell, setCell, type Grid } from "@/engine/types";
import { examplePresets } from "@/presets/registry";
import { validateConfig } from "@/engine/validateConfig";
import { replayActions } from "@/ir/gameIr";
import { zConfig } from "@/schemas/config";

const HEX_FORWARD: MovementConfig = {
	adjacency: "orthogonal",
	range: 1,
	capture: "jump",
	mustCapture: true,
	promotion: {
		targetRows: { X: 2, O: 4 },
		crownedAdjacency: "orthogonal",
		crownedRange: 2,
		menForwardOnly: true
	}
};

function emptyHexGrid(w = 6, h = 6): Grid {
	return { width: w, height: h, cells: Array(w * h).fill(null) };
}

const hexBoard = {
	wrap: false,
	topology: "hex_offset" as const
};

describe("hex promotion.menForwardOnly schema", () => {
	it("accepts menForwardOnly with jump promotion on hex_offset", () => {
		const cfg = examplePresets["hex-forward-men-jump-lite"].config;
		expect(validateConfig(cfg).ok).toBe(true);
		const parsed = zConfig.safeParse(cfg);
		expect(parsed.success).toBe(true);
		if (parsed.success) {
			expect(parsed.data.grid.topology).toBe("hex_offset");
			expect(parsed.data.movement?.promotion?.menForwardOnly).toBe(true);
			expect(parsed.data.movement?.promotion?.targetRows).toEqual({
				X: 2,
				O: 4
			});
		}
	});

	it("accepts graph promotion with menForwardOnly + targetRows", () => {
		const base = structuredClone(
			examplePresets["graph-crowned-jump-lite"].config
		);
		base.movement = {
			...base.movement!,
			promotion: {
				...base.movement!.promotion!,
				menForwardOnly: true
			}
		};
		const parsed = zConfig.safeParse(base);
		expect(parsed.success).toBe(true);
	});

	it("still rejects graph targetNodes + menForwardOnly", () => {
		const base = structuredClone(
			examplePresets["graph-hub-crowned-jump-lite"].config
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
});

describe("hex menForwardOnly legality", () => {
	it("uncrowned man: only forward cube quiet steps (row toward promo)", () => {
		const grid = emptyHexGrid();
		grid.cells = setCell(grid, { row: 4, col: 2 }, "X");
		const dests = legalDestinations(
			grid,
			{ row: 4, col: 2 },
			{ ...HEX_FORWARD, mustCapture: false },
			hexBoard
		);
		expect(dests).toEqual(
			expect.arrayContaining([
				{ row: 3, col: 2 },
				{ row: 3, col: 1 }
			])
		);
		expect(dests.some((p) => p.row === 5)).toBe(false);
		expect(dests.some((p) => p.row === 4)).toBe(false);
		expect(dests).toHaveLength(2);
		expect(manForwardRowSign("X", { X: 2, O: 4 })).toBe(-1);
		expect(isForwardRowDelta(-1, "X", { X: 2, O: 4 })).toBe(true);
	});

	it("uncrowned man: forward jump ok, backward jump illegal", () => {
		const forwardBoard = emptyHexGrid();
		forwardBoard.cells = setCell(forwardBoard, { row: 4, col: 2 }, "X");
		forwardBoard.cells = setCell(forwardBoard, { row: 3, col: 1 }, "O");
		const fwd = jumpDestinations(
			forwardBoard,
			{ row: 4, col: 2 },
			HEX_FORWARD,
			hexBoard,
			"X"
		);
		expect(fwd).toEqual([{ row: 2, col: 1 }]);

		const backBoard = emptyHexGrid();
		backBoard.cells = setCell(backBoard, { row: 2, col: 1 }, "X");
		backBoard.cells = setCell(backBoard, { row: 3, col: 1 }, "O");
		const back = jumpDestinations(
			backBoard,
			{ row: 2, col: 1 },
			HEX_FORWARD,
			hexBoard,
			"X"
		);
		expect(back).toEqual([]);
		// Without menForwardOnly the same geometry yields a backward leap
		const optional = {
			...HEX_FORWARD,
			promotion: {
				targetRows: { X: 2, O: 4 },
				crownedAdjacency: "orthogonal" as const,
				crownedRange: 2
			}
		};
		expect(
			jumpDestinations(
				backBoard,
				{ row: 2, col: 1 },
				optional,
				hexBoard,
				"X"
			).some((p) => p.row > 2)
		).toBe(true);
	});

	it("crowned piece ignores menForwardOnly (retreat legal)", () => {
		const grid = emptyHexGrid();
		grid.cells = setCell(grid, { row: 2, col: 1 }, "X+");
		const dests = legalDestinations(
			grid,
			{ row: 2, col: 1 },
			{ ...HEX_FORWARD, mustCapture: false },
			hexBoard
		);
		expect(dests.some((p) => p.row === 0 && p.col === 0)).toBe(true);
		expect(dests.some((p) => p.row === 3)).toBe(true);
		expect(dests.some((p) => p.row === 4)).toBe(true);
	});
});

describe("Hex Forward Men Jump Lite transcript + replay", () => {
	it("opening forward jump promotes; crowned walks to win; replay matches", () => {
		const { gameConfig, kernel } = compileConfig(
			examplePresets["hex-forward-men-jump-lite"].config
		);
		expect(gameConfig.movement?.promotion?.menForwardOnly).toBe(true);
		expect(gameConfig.topology).toBe("hex_offset");
		let state = createInitialState(gameConfig);

		const opening = kernel.legalActions(state, 0);
		expect(opening).toEqual([
			{ type: "move", from: { row: 4, col: 2 }, to: { row: 2, col: 1 } }
		]);
		expect(
			legalDestinations(
				state.grid,
				{ row: 4, col: 2 },
				{ ...HEX_FORWARD, mustCapture: false },
				hexBoard
			).some((p) => p.row > 4)
		).toBe(false);

		let result = kernel.stepSync(state, opening[0]!);
		expect(getCell(result.nextState.grid, { row: 2, col: 1 })).toBe("X+");
		expect(result.events.some((e) => e.type === "piecePromoted")).toBe(
			true
		);
		expect(result.nextState.status).toBe("playing");
		state = result.nextState;

		// O forward reply toward promo row 4 (player id 1)
		const oLegal = kernel.legalActions(state, 1) as KernelAction[];
		expect(
			oLegal.some(
				(a) =>
					a.type === "move" &&
					a.from.row === 3 &&
					a.from.col === 4 &&
					a.to.row === 4
			)
		).toBe(true);
		result = kernel.stepSync(state, {
			type: "move",
			from: { row: 3, col: 4 },
			to: { row: 4, col: 4 }
		});
		state = result.nextState;

		// Crowned X+ can slide to win row; retreat also among legal
		const crownedLegal = kernel.legalActions(state, 0) as KernelAction[];
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
		expect(
			crownedLegal.some(
				(a) =>
					a.type === "move" &&
					a.from.row === 2 &&
					a.from.col === 1 &&
					a.to.row === 4 &&
					a.to.col === 2
			)
		).toBe(true);

		result = kernel.stepSync(state, {
			type: "move",
			from: { row: 2, col: 1 },
			to: { row: 0, col: 0 }
		});
		expect(result.nextState.status).toBe("won");
		expect(result.nextState.winner).toBe("X");

		const actions: KernelAction[] = [
			{ type: "move", from: { row: 4, col: 2 }, to: { row: 2, col: 1 } },
			{ type: "move", from: { row: 3, col: 4 }, to: { row: 4, col: 4 } },
			{ type: "move", from: { row: 2, col: 1 }, to: { row: 0, col: 0 } }
		];
		const { finalState, faithful, events } = replayActions(
			gameConfig,
			actions,
			gameConfig.seed
		);
		expect(faithful).toBe(true);
		expect(events.some((e) => e.type === "piecePromoted")).toBe(true);
		expect(finalState.status).toBe("won");
		expect(finalState.winner).toBe("X");
		expect(getCell(finalState.grid, { row: 0, col: 0 })).toBe("X+");
	});
});
