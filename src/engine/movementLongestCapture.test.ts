import { describe, expect, it } from "vitest";
import { compileConfig } from "@/compiler";
import {
	globalMaxJumpCaptures,
	hasAnyJumpCapture,
	isMaximalJumpContinuation,
	isMaximalJumpStart,
	jumpChainLengthThrough,
	jumpDestinations,
	maxJumpChainFrom,
	type MovementConfig
} from "@/engine/movement";
import type { KernelAction } from "@/engine/kernel";
import { getCell } from "@/engine/types";
import { examplePresets } from "@/presets/registry";
import { validateConfig } from "@/engine/validateConfig";
import { replayActions } from "@/ir/gameIr";
import { zConfig } from "@/schemas/config";

const LONGEST: MovementConfig = {
	adjacency: "diagonal",
	range: 1,
	capture: "jump",
	mustCapture: true,
	mustLongestCapture: true
};

const MUST_ONLY: MovementConfig = {
	adjacency: "diagonal",
	range: 1,
	capture: "jump",
	mustCapture: true
};

describe("mustLongestCapture schema", () => {
	it("accepts mustLongestCapture with jump + mustCapture", () => {
		const cfg = examplePresets["mandatory-longest-jump-lite"].config;
		expect(validateConfig(cfg).ok).toBe(true);
		const parsed = zConfig.safeParse(cfg);
		expect(parsed.success).toBe(true);
		if (parsed.success) {
			expect(parsed.data.movement?.mustLongestCapture).toBe(true);
			expect(parsed.data.movement?.mustCapture).toBe(true);
		}
	});

	it("rejects mustLongestCapture without mustCapture", () => {
		const cfg = {
			...examplePresets["mandatory-longest-jump-lite"].config,
			movement: {
				adjacency: "diagonal" as const,
				range: 1,
				capture: "jump" as const,
				mustLongestCapture: true
			}
		};
		expect(validateConfig(cfg).ok).toBe(false);
		expect(zConfig.safeParse(cfg).success).toBe(false);
	});

	it("rejects mustLongestCapture without jump capture", () => {
		const cfg = {
			...examplePresets["mandatory-longest-jump-lite"].config,
			movement: {
				adjacency: "diagonal" as const,
				range: 1,
				capture: "none" as const,
				mustCapture: true,
				mustLongestCapture: true
			}
		};
		expect(validateConfig(cfg).ok).toBe(false);
		expect(zConfig.safeParse(cfg).success).toBe(false);
	});
});

describe("longest-chain helpers", () => {
	it("reports chain lengths: short=1, long=2, global=2", () => {
		const cfg = examplePresets["mandatory-longest-jump-lite"].config;
		const { kernel } = compileConfig(cfg);
		const state = kernel.initialState(cfg.rng.seed);
		const shortFrom = { row: 3, col: 0 };
		const longFrom = { row: 4, col: 4 };
		expect(getCell(state.grid, shortFrom)).toBe("X");
		expect(getCell(state.grid, longFrom)).toBe("X");
		expect(maxJumpChainFrom(state.grid, shortFrom, LONGEST, false, "X")).toBe(
			1
		);
		expect(maxJumpChainFrom(state.grid, longFrom, LONGEST, false, "X")).toBe(
			2
		);
		expect(globalMaxJumpCaptures(state.grid, "X", LONGEST)).toBe(2);
		expect(
			jumpChainLengthThrough(
				state.grid,
				shortFrom,
				{ row: 1, col: 2 },
				LONGEST,
				false,
				"X"
			)
		).toBe(1);
		expect(
			jumpChainLengthThrough(
				state.grid,
				longFrom,
				{ row: 2, col: 2 },
				LONGEST,
				false,
				"X"
			)
		).toBe(2);
		expect(
			isMaximalJumpStart(
				state.grid,
				shortFrom,
				{ row: 1, col: 2 },
				"X",
				LONGEST
			)
		).toBe(false);
		expect(
			isMaximalJumpStart(
				state.grid,
				longFrom,
				{ row: 2, col: 2 },
				"X",
				LONGEST
			)
		).toBe(true);
	});
});

describe("Mandatory Longest Jump Lite (mustLongestCapture)", () => {
	it("validates and compiles the preset", () => {
		const cfg = examplePresets["mandatory-longest-jump-lite"].config;
		expect(validateConfig(cfg).ok).toBe(true);
		const { kernel, gameConfig } = compileConfig(cfg);
		expect(gameConfig.movement?.capture).toBe("jump");
		expect(gameConfig.movement?.mustCapture).toBe(true);
		expect(gameConfig.movement?.mustLongestCapture).toBe(true);
		const state = kernel.initialState(cfg.rng.seed);
		expect(hasAnyJumpCapture(state.grid, "X", LONGEST)).toBe(true);
	});

	it("opening: only the 2-capture start is legal (short jump pruned)", () => {
		const cfg = examplePresets["mandatory-longest-jump-lite"].config;
		const { kernel } = compileConfig(cfg);
		const state = kernel.initialState(cfg.rng.seed);

		// Without mustLongestCapture, both jumps are legal under mustCapture.
		const mustOnlyCfg = {
			...cfg,
			movement: {
				adjacency: "diagonal" as const,
				range: 1,
				capture: "jump" as const,
				mustCapture: true
			}
		};
		const { kernel: mustKernel } = compileConfig(mustOnlyCfg);
		const mustLegal = mustKernel.legalActions(state, 0);
		expect(mustLegal).toEqual(
			expect.arrayContaining([
				{
					type: "move",
					from: { row: 3, col: 0 },
					to: { row: 1, col: 2 }
				},
				{
					type: "move",
					from: { row: 4, col: 4 },
					to: { row: 2, col: 2 }
				}
			])
		);
		expect(mustLegal).toHaveLength(2);

		const legal = kernel.legalActions(state, 0);
		expect(legal).toHaveLength(1);
		expect(legal[0]).toEqual({
			type: "move",
			from: { row: 4, col: 4 },
			to: { row: 2, col: 2 }
		});

		const short: KernelAction = {
			type: "move",
			from: { row: 3, col: 0 },
			to: { row: 1, col: 2 }
		};
		const ignored = kernel.stepSync(state, short);
		expect(ignored.events[0]?.type).toBe("ignored");
	});

	it("transcript: longest chain promotes to win row", () => {
		const cfg = examplePresets["mandatory-longest-jump-lite"].config;
		const { kernel, gameConfig } = compileConfig(cfg);
		let cur = kernel.initialState(cfg.rng.seed);

		const first: KernelAction = {
			type: "move",
			from: { row: 4, col: 4 },
			to: { row: 2, col: 2 }
		};
		const r1 = kernel.stepSync(cur, first);
		expect(r1.events.some((e) => e.type === "ignored")).toBe(false);
		expect(
			r1.events.some(
				(e) =>
					e.type === "pieceCaptured" &&
					e.position.row === 3 &&
					e.position.col === 3 &&
					e.captured === "O" &&
					e.by === "X"
			)
		).toBe(true);
		cur = r1.nextState;
		expect(cur.mustContinueFrom).toEqual({ row: 2, col: 2 });
		expect(cur.currentPlayer).toBe("X");
		expect(getCell(cur.grid, { row: 3, col: 3 })).toBeNull();
		expect(getCell(cur.grid, { row: 2, col: 2 })).toBe("X");

		const chainLegal = kernel.legalActions(cur, 0);
		expect(chainLegal).toHaveLength(1);
		expect(chainLegal[0]).toEqual({
			type: "move",
			from: { row: 2, col: 2 },
			to: { row: 0, col: 0 }
		});
		expect(
			isMaximalJumpContinuation(
				cur.grid,
				{ row: 2, col: 2 },
				{ row: 0, col: 0 },
				"X",
				LONGEST
			)
		).toBe(true);

		const second: KernelAction = {
			type: "move",
			from: { row: 2, col: 2 },
			to: { row: 0, col: 0 }
		};
		const r2 = kernel.stepSync(cur, second);
		cur = r2.nextState;
		expect(cur.status).toBe("won");
		expect(cur.winner).toBe("X");
		expect(getCell(cur.grid, { row: 0, col: 0 })).toBe("X");
		expect(getCell(cur.grid, { row: 1, col: 1 })).toBeNull();

		const actions: KernelAction[] = [first, second];
		const replayed = replayActions(gameConfig, actions, cfg.rng.seed);
		expect(replayed.finalState.status).toBe("won");
		expect(replayed.finalState.winner).toBe("X");
	});

	it("replays the winning longest-chain transcript", () => {
		const cfg = examplePresets["mandatory-longest-jump-lite"].config;
		const { gameConfig } = compileConfig(cfg);
		const actions: KernelAction[] = [
			{ type: "move", from: { row: 4, col: 4 }, to: { row: 2, col: 2 } },
			{ type: "move", from: { row: 2, col: 2 }, to: { row: 0, col: 0 } }
		];
		const final = replayActions(gameConfig, actions, cfg.rng.seed);
		expect(final.finalState.status).toBe("won");
		expect(final.finalState.winner).toBe("X");
	});

	it("lists both short and long jump destinations without longest filter", () => {
		const cfg = examplePresets["mandatory-longest-jump-lite"].config;
		const { kernel } = compileConfig(cfg);
		const state = kernel.initialState(cfg.rng.seed);
		expect(
			jumpDestinations(
				state.grid,
				{ row: 3, col: 0 },
				MUST_ONLY,
				false,
				"X"
			)
		).toEqual([{ row: 1, col: 2 }]);
		expect(
			jumpDestinations(
				state.grid,
				{ row: 4, col: 4 },
				MUST_ONLY,
				false,
				"X"
			)
		).toEqual([{ row: 2, col: 2 }]);
	});
});
