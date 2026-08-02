import { describe, expect, it } from "vitest";
import { compileConfig } from "@/compiler";
import {
	canMove,
	hasAnyJumpCapture,
	isJumpCapture,
	jumpDestinations,
	jumpMid,
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

const JUMP: MovementConfig = {
	adjacency: "diagonal",
	range: 1,
	capture: "jump"
};

describe("jump capture helpers", () => {
	it("lists leap landings over an adjacent enemy", () => {
		const { gameConfig } = compileConfig(examplePresets["jump-race"].config);
		const state = createInitialState(gameConfig);
		const from = { row: 4, col: 0 };
		expect(getCell(state.grid, from)).toBe("X");
		expect(getCell(state.grid, { row: 3, col: 1 })).toBe("O");
		const dests = jumpDestinations(state.grid, from, JUMP, false, "X");
		expect(dests).toEqual([{ row: 2, col: 2 }]);
		expect(jumpMid(from, { row: 2, col: 2 }, JUMP)).toEqual({
			row: 3,
			col: 1
		});
		expect(
			isJumpCapture(state.grid, from, { row: 2, col: 2 }, "X", JUMP)
		).toBe(true);
	});

	it("unions quiet adjacent empties with jump landings", () => {
		const { gameConfig } = compileConfig(examplePresets["jump-race"].config);
		const state = createInitialState(gameConfig);
		const from = { row: 4, col: 0 };
		// Corner: only diagonal quiet would be OOB or onto O — jump is the sole legal.
		const dests = legalDestinations(state.grid, from, JUMP);
		expect(dests).toEqual([{ row: 2, col: 2 }]);
		expect(
			canMove(state.grid, from, { row: 2, col: 2 }, "X", JUMP)
		).toBe(true);
		// Cannot land on the enemy (replace-style).
		expect(
			canMove(state.grid, from, { row: 3, col: 1 }, "X", JUMP)
		).toBe(false);
	});

	it("rejects jumping over empty or own piece", () => {
		const { gameConfig } = compileConfig(examplePresets["jump-race"].config);
		const state = createInitialState(gameConfig);
		const from = { row: 4, col: 0 };
		// Empty mid toward (2,0) path: mid (3,0) empty — not a jump.
		expect(
			isJumpCapture(state.grid, from, { row: 2, col: 0 }, "X", JUMP)
		).toBe(false);
		const withOwn = {
			...state.grid,
			cells: setCell(state.grid, { row: 3, col: 1 }, "X")
		};
		expect(
			isJumpCapture(withOwn, from, { row: 2, col: 2 }, "X", JUMP)
		).toBe(false);
	});
});

describe("Jump Race (movement.capture = jump)", () => {
	it("validates and compiles the jump-race preset", () => {
		const cfg = examplePresets["jump-race"].config;
		expect(validateConfig(cfg).ok).toBe(true);
		const parsed = zConfig.safeParse(cfg);
		expect(parsed.success).toBe(true);
		const { kernel, gameConfig } = compileConfig(cfg);
		expect(gameConfig.inputMode).toBe("move");
		expect(gameConfig.movement?.capture).toBe("jump");
		expect(gameConfig.objectiveMode).toBe("reach_row");
		const state = kernel.initialState(cfg.rng.seed);
		expect(getCell(state.grid, { row: 4, col: 0 })).toBe("X");
		expect(getCell(state.grid, { row: 3, col: 1 })).toBe("O");
		const legal = kernel.legalActions(state, 0);
		expect(
			legal.some(
				(a) =>
					a.type === "move" &&
					a.from.row === 4 &&
					a.from.col === 0 &&
					a.to.row === 2 &&
					a.to.col === 2
			)
		).toBe(true);
	});

	it("single jump clears mid, emits pieceCaptured, continues chain", () => {
		const cfg = examplePresets["jump-race"].config;
		const { kernel } = compileConfig(cfg);
		const state = kernel.initialState(cfg.rng.seed);
		const jump: KernelAction = {
			type: "move",
			from: { row: 4, col: 0 },
			to: { row: 2, col: 2 }
		};
		const result = kernel.stepSync(state, jump);
		expect(result.events.some((e) => e.type === "ignored")).toBe(false);
		expect(
			result.events.some(
				(e) =>
					e.type === "pieceCaptured" &&
					e.position.row === 3 &&
					e.position.col === 1 &&
					e.captured === "O" &&
					e.by === "X"
			)
		).toBe(true);
		expect(getCell(result.nextState.grid, { row: 4, col: 0 })).toBe(null);
		expect(getCell(result.nextState.grid, { row: 3, col: 1 })).toBe(null);
		expect(getCell(result.nextState.grid, { row: 2, col: 2 })).toBe("X");
		expect(result.nextState.currentPlayer).toBe("X");
		expect(result.nextState.mustContinueFrom).toEqual({ row: 2, col: 2 });
		const chainLegal = kernel.legalActions(result.nextState, 0);
		expect(chainLegal.every((a) => a.type === "move")).toBe(true);
		expect(
			chainLegal.every(
				(a) =>
					a.type === "move" &&
					a.from.row === 2 &&
					a.from.col === 2
			)
		).toBe(true);
		expect(
			chainLegal.some(
				(a) =>
					a.type === "move" && a.to.row === 0 && a.to.col === 4
			)
		).toBe(true);
		// Quiet move from chain piece is illegal while mustContinueFrom is set.
		const quiet: KernelAction = {
			type: "move",
			from: { row: 2, col: 2 },
			to: { row: 1, col: 1 }
		};
		const ignored = kernel.stepSync(result.nextState, quiet);
		expect(ignored.events[0]?.type).toBe("ignored");
	});

	it("chain second jump wins reach_row (transcript + replay)", () => {
		const cfg = examplePresets["jump-race"].config;
		const { kernel, gameConfig } = compileConfig(cfg);
		const state = kernel.initialState(cfg.rng.seed);
		const actions: KernelAction[] = [
			{ type: "move", from: { row: 4, col: 0 }, to: { row: 2, col: 2 } },
			{ type: "move", from: { row: 2, col: 2 }, to: { row: 0, col: 4 } }
		];
		let cur = state;
		const events: Array<{ type: string }> = [];
		for (const action of actions) {
			const step = kernel.stepSync(cur, action);
			events.push(...step.events);
			cur = step.nextState;
		}
		expect(cur.status).toBe("won");
		expect(cur.winner).toBe("X");
		expect(cur.mustContinueFrom).toBeUndefined();
		expect(
			events.filter((e) => e.type === "pieceCaptured")
		).toHaveLength(2);
		expect(getCell(cur.grid, { row: 0, col: 4 })).toBe("X");
		expect(getCell(cur.grid, { row: 1, col: 3 })).toBe(null);

		const replayed = replayActions(gameConfig, actions, cfg.rng.seed);
		expect(replayed.finalState.status).toBe("won");
		expect(replayed.finalState.winner).toBe("X");
		expect(getCell(replayed.finalState.grid, { row: 0, col: 4 })).toBe("X");
	});

	it("non-chain jump hands off when no further leaps", () => {
		const base = examplePresets["jump-race"].config;
		const cfg = {
			...base,
			initial: [
				// Land at (1,3) — not X's target row 0 — so game continues.
				{ row: 3, col: 1, player: "X" as const, visibility: "public" as const },
				{ row: 2, col: 2, player: "O" as const, visibility: "public" as const },
				{ row: 4, col: 4, player: "O" as const, visibility: "public" as const }
			]
		};
		expect(validateConfig(cfg).ok).toBe(true);
		const { kernel } = compileConfig(cfg);
		const state = kernel.initialState(cfg.rng.seed);
		const jump: KernelAction = {
			type: "move",
			from: { row: 3, col: 1 },
			to: { row: 1, col: 3 }
		};
		const result = kernel.stepSync(state, jump);
		expect(
			result.events.some(
				(e) =>
					e.type === "pieceCaptured" &&
					e.position.row === 2 &&
					e.position.col === 2
			)
		).toBe(true);
		expect(result.nextState.mustContinueFrom).toBeUndefined();
		expect(result.nextState.currentPlayer).toBe("O");
		expect(result.nextState.status).toBe("playing");
	});
});

describe("movement.capture = jump schema / validateConfig", () => {
	it("rejects jump on hex_offset", () => {
		const cfg = {
			...examplePresets["jump-race"].config,
			grid: {
				width: 5,
				height: 5,
				topology: "hex_offset" as const,
				wrap: false
			},
			movement: {
				adjacency: "orthogonal" as const,
				range: 1,
				capture: "jump" as const
			}
		};
		expect(validateConfig(cfg).ok).toBe(false);
		expect(zConfig.safeParse(cfg).success).toBe(false);
	});

	it("rejects jump under simultaneous", () => {
		const cfg = {
			...examplePresets["jump-race"].config,
			turn: { mode: "turn" as const, schedule: "simultaneous" as const }
		};
		expect(validateConfig(cfg).ok).toBe(false);
	});

	it("rejects jump with range > 1", () => {
		const cfg = {
			...examplePresets["jump-race"].config,
			movement: {
				adjacency: "diagonal" as const,
				range: 2,
				capture: "jump" as const
			}
		};
		expect(validateConfig(cfg).ok).toBe(false);
	});

	it("rejects jump with actionsPerTurn > 1", () => {
		const cfg = {
			...examplePresets["jump-race"].config,
			turn: { mode: "turn" as const, actionsPerTurn: 2 }
		};
		expect(validateConfig(cfg).ok).toBe(false);
	});

	it("rejects jump with placement.capture", () => {
		const cfg = {
			...examplePresets["jump-race"].config,
			placement: {
				mode: "direct" as const,
				overflow: "reject" as const,
				capture: { enabled: true, mode: "flip" as const }
			}
		};
		expect(validateConfig(cfg).ok).toBe(false);
	});

	it("rejects mustCapture without jump capture", () => {
		const cfg = {
			...examplePresets["mandatory-jump-race"].config,
			movement: {
				adjacency: "diagonal" as const,
				range: 1,
				capture: "none" as const,
				mustCapture: true
			}
		};
		expect(validateConfig(cfg).ok).toBe(false);
		expect(zConfig.safeParse(cfg).success).toBe(false);
	});
});

describe("Mandatory Jump Race (movement.mustCapture)", () => {
	const JUMP_MUST: MovementConfig = {
		adjacency: "diagonal",
		range: 1,
		capture: "jump",
		mustCapture: true
	};

	it("validates and compiles the mandatory-jump-race preset", () => {
		const cfg = examplePresets["mandatory-jump-race"].config;
		expect(validateConfig(cfg).ok).toBe(true);
		const parsed = zConfig.safeParse(cfg);
		expect(parsed.success).toBe(true);
		const { kernel, gameConfig } = compileConfig(cfg);
		expect(gameConfig.movement?.capture).toBe("jump");
		expect(gameConfig.movement?.mustCapture).toBe(true);
		const state = kernel.initialState(cfg.rng.seed);
		expect(getCell(state.grid, { row: 4, col: 2 })).toBe("X");
		expect(hasAnyJumpCapture(state.grid, "X", JUMP_MUST)).toBe(true);
	});

	it("opening: quiet escape exists but mustCapture keeps only the jump", () => {
		const cfg = examplePresets["mandatory-jump-race"].config;
		const { kernel, gameConfig } = compileConfig(cfg);
		const state = kernel.initialState(cfg.rng.seed);
		const from = { row: 4, col: 2 };
		// Without mustCapture, quiet (3,3) is among legalDestinations.
		const optional: MovementConfig = {
			adjacency: "diagonal",
			range: 1,
			capture: "jump"
		};
		const dests = legalDestinations(state.grid, from, optional);
		expect(dests.some((p) => p.row === 3 && p.col === 3)).toBe(true);
		expect(dests.some((p) => p.row === 2 && p.col === 0)).toBe(true);
		expect(canMove(state.grid, from, { row: 3, col: 3 }, "X", optional)).toBe(
			true
		);

		const legal = kernel.legalActions(state, 0);
		expect(legal).toHaveLength(1);
		expect(legal[0]).toEqual({
			type: "move",
			from: { row: 4, col: 2 },
			to: { row: 2, col: 0 }
		});
		expect(gameConfig.movement?.mustCapture).toBe(true);

		const quiet: KernelAction = {
			type: "move",
			from: { row: 4, col: 2 },
			to: { row: 3, col: 3 }
		};
		const ignored = kernel.stepSync(state, quiet);
		expect(ignored.events[0]?.type).toBe("ignored");
	});

	it("optional jump-race still allows quiet when a jump exists elsewhere", () => {
		// Board with quiet + jump; without mustCapture both stay legal.
		const cfg = {
			...examplePresets["mandatory-jump-race"].config,
			metadata: { name: "Optional Jump Contrast", version: 1 },
			movement: {
				adjacency: "diagonal" as const,
				range: 1,
				capture: "jump" as const
			}
		};
		const { kernel } = compileConfig(cfg);
		const state = kernel.initialState(cfg.rng.seed);
		const legal = kernel.legalActions(state, 0);
		expect(
			legal.some(
				(a) =>
					a.type === "move" &&
					a.from.row === 4 &&
					a.from.col === 2 &&
					a.to.row === 3 &&
					a.to.col === 3
			)
		).toBe(true);
		expect(
			legal.some(
				(a) =>
					a.type === "move" &&
					a.from.row === 4 &&
					a.from.col === 2 &&
					a.to.row === 2 &&
					a.to.col === 0
			)
		).toBe(true);
	});

	it("chain second jump wins reach_row (transcript + replay)", () => {
		const cfg = examplePresets["mandatory-jump-race"].config;
		const { kernel, gameConfig } = compileConfig(cfg);
		const state = kernel.initialState(cfg.rng.seed);
		const actions: KernelAction[] = [
			{ type: "move", from: { row: 4, col: 2 }, to: { row: 2, col: 0 } },
			{ type: "move", from: { row: 2, col: 0 }, to: { row: 0, col: 2 } }
		];
		let cur = state;
		const events: Array<{ type: string }> = [];
		for (const action of actions) {
			const step = kernel.stepSync(cur, action);
			events.push(...step.events);
			cur = step.nextState;
		}
		expect(cur.status).toBe("won");
		expect(cur.winner).toBe("X");
		expect(cur.mustContinueFrom).toBeUndefined();
		expect(events.filter((e) => e.type === "pieceCaptured")).toHaveLength(2);
		expect(getCell(cur.grid, { row: 0, col: 2 })).toBe("X");
		expect(getCell(cur.grid, { row: 3, col: 1 })).toBe(null);
		expect(getCell(cur.grid, { row: 1, col: 1 })).toBe(null);

		const replayed = replayActions(gameConfig, actions, cfg.rng.seed);
		expect(replayed.finalState.status).toBe("won");
		expect(replayed.finalState.winner).toBe("X");
	});

	it("when no jump exists, quiet moves remain legal under mustCapture", () => {
		const cfg = examplePresets["mandatory-jump-race"].config;
		const { kernel } = compileConfig(cfg);
		// Clear both enemy mids so X has only quiet diagonals.
		let state = kernel.initialState(cfg.rng.seed);
		state = {
			...state,
			grid: {
				...state.grid,
				cells: setCell(
					{ ...state.grid, cells: setCell(state.grid, { row: 3, col: 1 }, null) },
					{ row: 1, col: 1 },
					null
				)
			}
		};
		expect(hasAnyJumpCapture(state.grid, "X", JUMP_MUST)).toBe(false);
		const legal = kernel.legalActions(state, 0);
		expect(
			legal.some(
				(a) =>
					a.type === "move" &&
					a.from.row === 4 &&
					a.from.col === 2 &&
					a.to.row === 3 &&
					a.to.col === 3
			)
		).toBe(true);
		const quiet: KernelAction = {
			type: "move",
			from: { row: 4, col: 2 },
			to: { row: 3, col: 3 }
		};
		const result = kernel.stepSync(state, quiet);
		expect(result.events.some((e) => e.type === "ignored")).toBe(false);
		expect(getCell(result.nextState.grid, { row: 3, col: 3 })).toBe("X");
		expect(result.nextState.currentPlayer).toBe("O");
	});
});
