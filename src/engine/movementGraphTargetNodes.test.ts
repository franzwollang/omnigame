import { describe, expect, it } from "vitest";
import { compileConfig } from "@/compiler";
import {
	effectiveMovement,
	landsOnPromotionTarget,
	legalDestinations,
	type MovementConfig
} from "@/engine/movement";
import type { KernelAction } from "@/engine/kernel";
import { createInitialState } from "@/engine/reducer";
import { getCell, setCell } from "@/engine/types";
import { examplePresets } from "@/presets/registry";
import { validateConfig } from "@/engine/validateConfig";
import { replayActions } from "@/ir/gameIr";
import { zConfig } from "@/schemas/config";

const HUB_PROMO: MovementConfig = {
	adjacency: "orthogonal",
	range: 1,
	capture: "jump",
	mustCapture: true,
	promotion: {
		targetNodes: { X: "2,1", O: "2,0" },
		crownedAdjacency: "orthogonal",
		crownedRange: 2
	}
};

describe("graph movement.promotion.targetNodes schema", () => {
	it("accepts hub promotion with jump on graph", () => {
		const cfg = examplePresets["graph-hub-crowned-jump-lite"].config;
		expect(validateConfig(cfg).ok).toBe(true);
		const parsed = zConfig.safeParse(cfg);
		expect(parsed.success).toBe(true);
		if (parsed.success) {
			expect(parsed.data.grid.topology).toBe("graph");
			expect(parsed.data.movement?.promotion?.targetNodes).toEqual({
				X: "2,1",
				O: "2,0"
			});
			expect(parsed.data.movement?.promotion?.targetRows).toBeUndefined();
			expect(parsed.data.movement?.promotion?.crownedAdjacency).toBe(
				"orthogonal"
			);
			expect(parsed.data.movement?.promotion?.crownedRange).toBe(2);
		}
	});

	it("rejects promotion with both targetRows and targetNodes", () => {
		const base = structuredClone(
			examplePresets["graph-hub-crowned-jump-lite"].config
		);
		base.movement = {
			...base.movement!,
			promotion: {
				...base.movement!.promotion!,
				targetRows: { X: 2, O: 2 }
			}
		};
		const parsed = zConfig.safeParse(base);
		expect(parsed.success).toBe(false);
	});

	it("rejects promotion with neither targetRows nor targetNodes", () => {
		const base = structuredClone(
			examplePresets["graph-hub-crowned-jump-lite"].config
		);
		const promo = { ...base.movement!.promotion! };
		delete (promo as { targetNodes?: unknown }).targetNodes;
		base.movement = { ...base.movement!, promotion: promo };
		const parsed = zConfig.safeParse(base);
		expect(parsed.success).toBe(false);
	});

	it("rejects targetNodes on rectangle", () => {
		const base = structuredClone(
			examplePresets["crowned-jump-race"].config
		);
		base.movement = {
			...base.movement!,
			promotion: {
				targetNodes: { X: "1,1", O: "3,1" },
				crownedAdjacency: "king"
			}
		};
		const parsed = zConfig.safeParse(base);
		expect(parsed.success).toBe(false);
	});

	it("rejects targetNodes key that is not an active graph node", () => {
		const base = structuredClone(
			examplePresets["graph-hub-crowned-jump-lite"].config
		);
		base.movement = {
			...base.movement!,
			promotion: {
				...base.movement!.promotion!,
				targetNodes: { X: "9,9", O: "2,0" }
			}
		};
		const parsed = zConfig.safeParse(base);
		expect(parsed.success).toBe(false);
	});

	it("landsOnPromotionTarget distinguishes hub vs same-row decoy", () => {
		const promo = HUB_PROMO.promotion!;
		expect(
			landsOnPromotionTarget(promo, "X", { row: 2, col: 1 })
		).toBe(true);
		expect(
			landsOnPromotionTarget(promo, "X", { row: 2, col: 0 })
		).toBe(false);
		expect(
			landsOnPromotionTarget(promo, "O", { row: 2, col: 0 })
		).toBe(true);
	});
});

describe("graph hub crowned movement via effectiveMovement", () => {
	it("crowned pieces use crownedRange on hub graph; men keep range 1", () => {
		expect(effectiveMovement(HUB_PROMO, "X").range).toBe(1);
		expect(effectiveMovement(HUB_PROMO, "X+").range).toBe(2);
		expect(effectiveMovement(HUB_PROMO, "X+").adjacency).toBe(
			"orthogonal"
		);
	});

	it("from hub, men cannot quiet-reach win; crownedRange 2 can", () => {
		const { gameConfig } = compileConfig(
			examplePresets["graph-hub-crowned-jump-lite"].config
		);
		const board = {
			topology: "graph" as const,
			graph: gameConfig.graph,
			wrap: false
		};
		let grid = createInitialState(gameConfig).grid;
		grid = {
			...grid,
			cells: Array(grid.width * grid.height).fill(null)
		};
		grid = { ...grid, cells: setCell(grid, { row: 2, col: 1 }, "X") };
		const manDests = legalDestinations(
			grid,
			{ row: 2, col: 1 },
			{ ...HUB_PROMO, mustCapture: false },
			board
		);
		expect(manDests.some((p) => p.row === 0 && p.col === 1)).toBe(false);
		expect(manDests.some((p) => p.row === 1 && p.col === 1)).toBe(true);
		expect(manDests.some((p) => p.row === 2 && p.col === 0)).toBe(true);

		grid = { ...grid, cells: setCell(grid, { row: 2, col: 1 }, "X+") };
		const crownedDests = legalDestinations(
			grid,
			{ row: 2, col: 1 },
			{ ...HUB_PROMO, mustCapture: false },
			board
		);
		expect(crownedDests.some((p) => p.row === 0 && p.col === 1)).toBe(true);
		expect(crownedDests.some((p) => p.row === 1 && p.col === 1)).toBe(true);
	});
});

describe("GameIR graph hub targetNodes promote + win", () => {
	it("transcript + replay: hub promote then crownedRange-2 chain-walk win", () => {
		const cfg = examplePresets["graph-hub-crowned-jump-lite"].config;
		const { gameConfig } = compileConfig(cfg);
		const actions: KernelAction[] = [
			{ type: "move", from: { row: 4, col: 0 }, to: { row: 2, col: 1 } },
			{ type: "move", from: { row: 4, col: 2 }, to: { row: 3, col: 2 } },
			{ type: "move", from: { row: 2, col: 1 }, to: { row: 0, col: 1 } }
		];
		const { finalState, faithful, events } = replayActions(
			gameConfig,
			actions,
			cfg.rng.seed
		);
		expect(faithful).toBe(true);
		expect(events.some((e) => e.type === "piecePromoted")).toBe(true);
		expect(getCell(finalState.grid, { row: 0, col: 1 })).toBe("X+");
		expect(finalState.status).toBe("won");
		expect(finalState.winner).toBe("X");
	});

	it("quiet land on same-row decoy does not promote under targetNodes", () => {
		const base = structuredClone(
			examplePresets["graph-hub-crowned-jump-lite"].config
		);
		base.movement = {
			...base.movement!,
			mustCapture: false
		};
		base.initial = [
			{ row: 2, col: 1, player: "X", visibility: "public" },
			{ row: 4, col: 2, player: "O", visibility: "public" }
		];
		const { gameConfig } = compileConfig(base);
		const actions: KernelAction[] = [
			{ type: "move", from: { row: 2, col: 1 }, to: { row: 2, col: 0 } }
		];
		const { finalState, faithful, events } = replayActions(
			gameConfig,
			actions,
			base.rng.seed
		);
		expect(faithful).toBe(true);
		expect(events.some((e) => e.type === "piecePromoted")).toBe(false);
		expect(getCell(finalState.grid, { row: 2, col: 0 })).toBe("X");
	});

	it("targetRows on same hub graph would promote at decoy (contrast)", () => {
		const base = structuredClone(
			examplePresets["graph-hub-crowned-jump-lite"].config
		);
		base.movement = {
			...base.movement!,
			mustCapture: false,
			promotion: {
				targetRows: { X: 2, O: 2 },
				crownedAdjacency: "orthogonal",
				crownedRange: 2
			}
		};
		base.initial = [
			{ row: 2, col: 1, player: "X", visibility: "public" },
			{ row: 4, col: 2, player: "O", visibility: "public" }
		];
		expect(validateConfig(base).ok).toBe(true);
		const { gameConfig } = compileConfig(base);
		const actions: KernelAction[] = [
			{ type: "move", from: { row: 2, col: 1 }, to: { row: 2, col: 0 } }
		];
		const { finalState, faithful, events } = replayActions(
			gameConfig,
			actions,
			base.rng.seed
		);
		expect(faithful).toBe(true);
		expect(events.some((e) => e.type === "piecePromoted")).toBe(true);
		expect(getCell(finalState.grid, { row: 2, col: 0 })).toBe("X+");
	});
});
