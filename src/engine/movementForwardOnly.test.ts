import { describe, expect, it } from "vitest";
import { compileConfig } from "@/compiler";
import {
	isForwardRowDelta,
	jumpDestinations,
	legalDestinations,
	manForwardRowSign,
	pieceAdjacencyDeltas,
	type MovementConfig
} from "@/engine/movement";
import type { KernelAction } from "@/engine/kernel";
import { createInitialState } from "@/engine/reducer";
import { getCell, setCell, type Grid } from "@/engine/types";
import { examplePresets } from "@/presets/registry";
import { validateConfig } from "@/engine/validateConfig";
import { replayActions } from "@/ir/gameIr";
import { zConfig } from "@/schemas/config";

const FORWARD: MovementConfig = {
	adjacency: "diagonal",
	range: 1,
	capture: "jump",
	mustCapture: true,
	promotion: {
		targetRows: { X: 1, O: 3 },
		crownedAdjacency: "king",
		menForwardOnly: true
	}
};

function emptyGrid(w = 5, h = 5): Grid {
	return { width: w, height: h, cells: Array(w * h).fill(null) };
}

describe("promotion.menForwardOnly schema", () => {
	it("accepts menForwardOnly with jump promotion on rectangle", () => {
		const cfg = examplePresets["forward-men-jump-lite"].config;
		expect(validateConfig(cfg).ok).toBe(true);
		const parsed = zConfig.safeParse(cfg);
		expect(parsed.success).toBe(true);
		if (parsed.success) {
			expect(parsed.data.movement?.promotion?.menForwardOnly).toBe(true);
		}
	});

	it("parses menForwardOnly false / omitted as not restricting", () => {
		const base = structuredClone(
			examplePresets["crowned-jump-race"].config
		);
		const parsed = zConfig.safeParse(base);
		expect(parsed.success).toBe(true);
		if (parsed.success) {
			expect(parsed.data.movement?.promotion?.menForwardOnly).toBeUndefined();
		}
	});
});

describe("manForwardRowSign helpers", () => {
	it("derives X−1 / O+1 when X promo row is above O", () => {
		expect(manForwardRowSign("X", { X: 1, O: 3 })).toBe(-1);
		expect(manForwardRowSign("O", { X: 1, O: 3 })).toBe(1);
		expect(isForwardRowDelta(-1, "X", { X: 1, O: 3 })).toBe(true);
		expect(isForwardRowDelta(1, "X", { X: 1, O: 3 })).toBe(false);
		expect(isForwardRowDelta(0, "X", { X: 1, O: 3 })).toBe(false);
	});

	it("flips signs when promo rows are inverted", () => {
		expect(manForwardRowSign("X", { X: 3, O: 1 })).toBe(1);
		expect(manForwardRowSign("O", { X: 3, O: 1 })).toBe(-1);
	});
});

describe("menForwardOnly legality", () => {
	it("uncrowned man: only forward quiet diagonals", () => {
		const grid = emptyGrid();
		grid.cells = setCell(grid, { row: 2, col: 2 }, "X");
		const dests = legalDestinations(grid, { row: 2, col: 2 }, {
			...FORWARD,
			mustCapture: false
		});
		expect(dests).toEqual(
			expect.arrayContaining([
				{ row: 1, col: 1 },
				{ row: 1, col: 3 }
			])
		);
		expect(dests.some((p) => p.row === 3)).toBe(false);
		expect(dests).toHaveLength(2);
	});

	it("uncrowned man: forward jump ok, backward jump illegal", () => {
		const forwardBoard = emptyGrid();
		forwardBoard.cells = setCell(forwardBoard, { row: 3, col: 2 }, "X");
		forwardBoard.cells = setCell(forwardBoard, { row: 2, col: 1 }, "O");
		const fwd = jumpDestinations(
			forwardBoard,
			{ row: 3, col: 2 },
			FORWARD,
			false,
			"X"
		);
		expect(fwd).toEqual([{ row: 1, col: 0 }]);

		const backBoard = emptyGrid();
		backBoard.cells = setCell(backBoard, { row: 1, col: 1 }, "X");
		backBoard.cells = setCell(backBoard, { row: 2, col: 2 }, "O");
		const back = jumpDestinations(
			backBoard,
			{ row: 1, col: 1 },
			FORWARD,
			false,
			"X"
		);
		expect(back).toEqual([]);
		// Without menForwardOnly the same geometry yields a backward leap
		const optional = {
			...FORWARD,
			promotion: {
				targetRows: { X: 1, O: 3 },
				crownedAdjacency: "king" as const
			}
		};
		expect(
			jumpDestinations(backBoard, { row: 1, col: 1 }, optional, false, "X")
		).toEqual([{ row: 3, col: 3 }]);
	});

	it("crowned piece ignores menForwardOnly (retreat legal)", () => {
		const grid = emptyGrid();
		grid.cells = setCell(grid, { row: 2, col: 2 }, "X+");
		const deltas = pieceAdjacencyDeltas(FORWARD, "X+");
		expect(deltas.length).toBe(8); // king adjacency
		const dests = legalDestinations(grid, { row: 2, col: 2 }, {
			...FORWARD,
			mustCapture: false
		});
		expect(dests.some((p) => p.row === 3 && p.col === 2)).toBe(true);
		expect(dests.some((p) => p.row === 1 && p.col === 2)).toBe(true);
		expect(dests.some((p) => p.row === 3 && p.col === 3)).toBe(true);
	});
});

describe("Forward Men Jump Lite transcript + replay", () => {
	it("opening forward jump promotes; crowned walks to win; replay matches", () => {
		const { gameConfig, kernel } = compileConfig(
			examplePresets["forward-men-jump-lite"].config
		);
		expect(gameConfig.movement?.promotion?.menForwardOnly).toBe(true);
		let state = createInitialState(gameConfig);

		// Opening: only the forward jump (mustCapture + menForwardOnly)
		const opening = kernel.legalActions(state, 0);
		expect(opening).toEqual([
			{ type: "move", from: { row: 3, col: 2 }, to: { row: 1, col: 0 } }
		]);
		// Sanity: backward quiet from opening square is not among dests
		expect(
			legalDestinations(
				state.grid,
				{ row: 3, col: 2 },
				{ ...FORWARD, mustCapture: false }
			).some((p) => p.row > 3)
		).toBe(false);

		let result = kernel.stepSync(state, opening[0]!);
		expect(getCell(result.nextState.grid, { row: 1, col: 0 })).toBe("X+");
		expect(result.events.some((e) => e.type === "piecePromoted")).toBe(
			true
		);
		expect(result.nextState.status).toBe("playing");
		state = result.nextState;

		// O forward reply (men advance toward promo row 3)
		result = kernel.stepSync(state, {
			type: "move",
			from: { row: 2, col: 4 },
			to: { row: 3, col: 3 }
		});
		state = result.nextState;

		// Crowned X+ can step to win row; retreat also among legal (ignored filter)
		const crownedLegal = kernel.legalActions(state, 0) as KernelAction[];
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
		expect(
			crownedLegal.some(
				(a) =>
					a.type === "move" &&
					a.from.row === 1 &&
					a.from.col === 0 &&
					a.to.row === 2 &&
					a.to.col === 0
			)
		).toBe(true);

		result = kernel.stepSync(state, {
			type: "move",
			from: { row: 1, col: 0 },
			to: { row: 0, col: 0 }
		});
		expect(result.nextState.status).toBe("won");
		expect(result.nextState.winner).toBe("X");

		const actions: KernelAction[] = [
			{ type: "move", from: { row: 3, col: 2 }, to: { row: 1, col: 0 } },
			{ type: "move", from: { row: 2, col: 4 }, to: { row: 3, col: 3 } },
			{ type: "move", from: { row: 1, col: 0 }, to: { row: 0, col: 0 } }
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
