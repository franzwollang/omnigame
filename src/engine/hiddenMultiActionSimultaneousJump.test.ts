import { describe, expect, it } from "vitest";
import { compileConfig, compileToGameConfig } from "@/compiler";
import {
	enumerateCommitRevealJoints,
	isFreshCommitRound,
	seatCommitFromJoint
} from "@/agents/jointLegal";
import { stepPly, type KernelAction } from "@/engine/kernel";
import { asMoveList, getCell, toIndex } from "@/engine/types";
import { validateConfig } from "@/engine/validateConfig";
import { replayActions } from "@/ir/gameIr";
import { zConfig } from "@/schemas/config";
import { examplePresets } from "@/presets/registry";

const JUMP = {
	adjacency: "diagonal" as const,
	range: 1 as const,
	capture: "jump" as const
};

describe("schema: commitReveal × multi-action simultaneous jump (M85)", () => {
	it("validates and compiles the hidden-double-simultaneous-jump-race preset", () => {
		const cfg = examplePresets["hidden-double-simultaneous-jump-race"].config;
		expect(validateConfig(cfg).ok).toBe(true);
		expect(zConfig.safeParse(cfg).success).toBe(true);
		const { kernel, gameConfig } = compileConfig(cfg);
		expect(gameConfig.turnSchedule).toBe("simultaneous");
		expect(gameConfig.commitReveal).toBe(true);
		expect(gameConfig.actionsPerTurn).toBe(2);
		expect(gameConfig.movement?.capture).toBe("jump");
		expect(gameConfig.objectiveMode).toBe("reach_row");
		const state = kernel.initialState(cfg.rng.seed);
		expect(kernel.currentPlayer(state)).toBe("simultaneous");
	});

	it("accepts open double-simultaneous-jump-race + commitReveal", () => {
		const cfg = {
			...examplePresets["double-simultaneous-jump-race"].config,
			turn: {
				mode: "turn" as const,
				schedule: "simultaneous" as const,
				actionsPerTurn: 2,
				commitReveal: true
			}
		};
		expect(validateConfig(cfg).ok).toBe(true);
		expect(zConfig.safeParse(cfg).success).toBe(true);
	});

	it("still rejects hex under hidden multi-action jump", () => {
		const cfg = {
			...examplePresets["hidden-double-simultaneous-jump-race"].config,
			grid: {
				width: 5,
				height: 5,
				topology: "hex_offset" as const,
				wrap: false
			},
			movement: {
				adjacency: "orthogonal" as const,
				range: 1 as const,
				capture: "jump" as const
			}
		};
		expect(validateConfig(cfg).ok).toBe(false);
	});

	it("still rejects mustLongestCapture under hidden multi-action jump", () => {
		const cfg = {
			...examplePresets["hidden-double-simultaneous-jump-race"].config,
			movement: {
				...JUMP,
				mustCapture: true,
				mustLongestCapture: true
			}
		};
		expect(validateConfig(cfg).ok).toBe(false);
	});

	it("still rejects range > 1 under hidden multi-action jump", () => {
		const bad = zConfig.safeParse({
			...examplePresets["hidden-double-simultaneous-jump-race"].config,
			movement: { adjacency: "diagonal", range: 2, capture: "jump" }
		});
		expect(bad.success).toBe(false);
	});
});

describe("kernel: hidden multi-action commitMove × jump", () => {
	it("accumulates two commits per seat then reveals double-hop win", () => {
		const { kernel } = compileConfig(
			examplePresets["hidden-double-simultaneous-jump-race"].config
		);
		let state = kernel.initialState(42);
		expect(kernel.currentPlayer(state)).toBe("simultaneous");

		const legalX = kernel.legalActions(state, 0);
		expect(legalX.every((a) => a.type === "commitMove")).toBe(true);
		expect(
			legalX.some(
				(a) =>
					a.type === "commitMove" &&
					a.from.row === 4 &&
					a.from.col === 0 &&
					a.to.row === 2 &&
					a.to.col === 2
			)
		).toBe(true);

		state = kernel.stepSync(state, {
			type: "commitMove",
			player: "X",
			from: { row: 4, col: 0 },
			to: { row: 2, col: 2 }
		}).nextState;
		expect(state.moveCount).toBe(0);
		expect(state.committedMoves?.X).toHaveLength(1);
		expect(getCell(state.grid, { row: 4, col: 0 })).toBe("X");
		expect(getCell(state.grid, { row: 3, col: 1 })).toBe("O");

		const chain = {
			type: "commitMove" as const,
			player: "X" as const,
			from: { row: 2, col: 2 },
			to: { row: 0, col: 4 }
		};
		expect(kernel.explainAction(state, 0, chain).legal).toBe(true);
		state = kernel.stepSync(state, chain).nextState;
		expect(state.committedMoves?.X).toHaveLength(2);
		expect(kernel.legalActions(state, 0)).toHaveLength(0);

		const obsX = kernel.observe(state, 0);
		const land1 = toIndex({ row: 2, col: 2 }, state.grid.width);
		const land2 = toIndex({ row: 0, col: 4 }, state.grid.width);
		expect(obsX.cells[land1]).toBe("X");
		expect(obsX.cells[land2]).toBe("X");
		expect(obsX.pendingCommit).toEqual({
			kind: "move",
			from: { row: 2, col: 2 },
			to: { row: 0, col: 4 }
		});

		state = kernel.stepSync(state, {
			type: "commitMove",
			player: "O",
			from: { row: 0, col: 0 },
			to: { row: 1, col: 1 }
		}).nextState;
		expect(state.moveCount).toBe(0);
		expect(state.committedMoves?.O).toHaveLength(1);

		const result = kernel.stepSync(state, {
			type: "commitMove",
			player: "O",
			from: { row: 1, col: 1 },
			to: { row: 2, col: 0 }
		});
		state = result.nextState;
		expect(state.committedMoves).toBeUndefined();
		expect(state.moveCount).toBe(1);
		expect(getCell(state.grid, { row: 0, col: 4 })).toBe("X");
		expect(getCell(state.grid, { row: 3, col: 1 })).toBeNull();
		expect(getCell(state.grid, { row: 1, col: 3 })).toBeNull();
		expect(getCell(state.grid, { row: 2, col: 0 })).toBe("O");
		expect(state.mustContinueFrom).toBeUndefined();
		expect(state.status).toBe("won");
		expect(state.winner).toBe("X");

		const captures = result.events.filter((e) => e.type === "pieceCaptured");
		expect(captures).toHaveLength(2);
		expect(captures).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					type: "pieceCaptured",
					position: { row: 3, col: 1 },
					captured: "O",
					by: "X"
				}),
				expect.objectContaining({
					type: "pieceCaptured",
					position: { row: 1, col: 3 },
					captured: "O",
					by: "X"
				})
			])
		);
	});

	it("blind mid-flee at index 1 aborts reveal (clear commits, board unchanged)", () => {
		const { kernel } = compileConfig(
			examplePresets["hidden-double-simultaneous-jump-race"].config
		);
		let state = kernel.initialState(42);
		state = kernel.stepSync(state, {
			type: "commitMove",
			player: "X",
			from: { row: 4, col: 0 },
			to: { row: 2, col: 2 }
		}).nextState;
		state = kernel.stepSync(state, {
			type: "commitMove",
			player: "X",
			from: { row: 2, col: 2 },
			to: { row: 0, col: 4 }
		}).nextState;
		state = kernel.stepSync(state, {
			type: "commitMove",
			player: "O",
			from: { row: 0, col: 0 },
			to: { row: 1, col: 1 }
		}).nextState;

		const flee = {
			type: "commitMove" as const,
			player: "O" as const,
			from: { row: 1, col: 3 },
			to: { row: 0, col: 2 }
		};
		expect(kernel.explainAction(state, 1, flee).legal).toBe(true);
		const after = kernel.stepSync(state, flee);
		expect(getCell(after.nextState.grid, { row: 4, col: 0 })).toBe("X");
		expect(getCell(after.nextState.grid, { row: 3, col: 1 })).toBe("O");
		expect(getCell(after.nextState.grid, { row: 1, col: 3 })).toBe("O");
		expect(getCell(after.nextState.grid, { row: 0, col: 4 })).toBeNull();
		expect(after.nextState.committedMoves).toBeUndefined();
		expect(after.nextState.moveCount).toBe(1);
		expect(after.events.some((e) => e.type === "pieceCaptured")).toBe(false);
		expect(after.nextState.status).toBe("playing");
		expect(
			kernel
				.legalActions(after.nextState, 0)
				.every((a) => a.type === "commitMove")
		).toBe(true);
	});

	it("stepPly completes a hidden double-jump round via sequential commits", () => {
		const { kernel } = compileConfig(
			examplePresets["hidden-double-simultaneous-jump-race"].config
		);
		const state = kernel.initialState(42);
		const picks: Record<0 | 1, KernelAction[]> = {
			0: [
				{
					type: "commitMove",
					player: "X",
					from: { row: 4, col: 0 },
					to: { row: 2, col: 2 }
				},
				{
					type: "commitMove",
					player: "X",
					from: { row: 2, col: 2 },
					to: { row: 0, col: 4 }
				}
			],
			1: [
				{
					type: "commitMove",
					player: "O",
					from: { row: 0, col: 0 },
					to: { row: 1, col: 1 }
				},
				{
					type: "commitMove",
					player: "O",
					from: { row: 1, col: 1 },
					to: { row: 2, col: 0 }
				}
			]
		};
		const idx = { 0: 0, 1: 0 };
		const result = stepPly(kernel, state, (player) => {
			const seat = player as 0 | 1;
			return picks[seat][idx[seat]++]!;
		});
		expect(result).not.toBeNull();
		expect(getCell(result!.nextState.grid, { row: 0, col: 4 })).toBe("X");
		expect(getCell(result!.nextState.grid, { row: 3, col: 1 })).toBeNull();
		expect(getCell(result!.nextState.grid, { row: 1, col: 3 })).toBeNull();
		expect(result!.nextState.status).toBe("won");
		expect(result!.nextState.winner).toBe("X");
		expect(result!.nextState.committedMoves).toBeUndefined();
	});
});

describe("agents: commitReveal multi-jump joints", () => {
	it("enumerateCommitRevealJoints yields length-2 simultaneousMove arrays", () => {
		const { kernel } = compileConfig(
			examplePresets["hidden-double-simultaneous-jump-race"].config
		);
		const state = kernel.initialState(42);
		expect(isFreshCommitRound(state)).toBe(true);
		const joints = enumerateCommitRevealJoints(kernel, state);
		expect(joints.length).toBeGreaterThan(0);
		expect(joints.every((j) => j.type === "simultaneousMove")).toBe(true);
		const sample = joints[0]!;
		expect(sample.type).toBe("simultaneousMove");
		if (sample.type !== "simultaneousMove") throw new Error("expected joint");
		expect(asMoveList(sample.moves.X)).toHaveLength(2);
		expect(asMoveList(sample.moves.O)).toHaveLength(2);

		const first = seatCommitFromJoint(sample, 0, 0);
		const second = seatCommitFromJoint(sample, 0, 1);
		expect(first?.type).toBe("commitMove");
		expect(second?.type).toBe("commitMove");
		if (first?.type === "commitMove" && second?.type === "commitMove") {
			expect(first.to).toEqual(asMoveList(sample.moves.X)[0]!.to);
			expect(second.from).toEqual(asMoveList(sample.moves.X)[1]!.from);
		}

		expect(
			joints.some((j) => {
				if (j.type !== "simultaneousMove") return false;
				const xs = asMoveList(j.moves.X);
				return (
					xs[0]?.from.row === 4 &&
					xs[0]?.from.col === 0 &&
					xs[0]?.to.row === 2 &&
					xs[0]?.to.col === 2 &&
					xs[1]?.to.row === 0 &&
					xs[1]?.to.col === 4
				);
			})
		).toBe(true);
	});
});

describe("transcript: Hidden Double Simultaneous Jump Race", () => {
	it("replays four commitMove events via GameIR", () => {
		const config = compileToGameConfig(
			examplePresets["hidden-double-simultaneous-jump-race"].config
		).gameConfig;
		const actions: KernelAction[] = [
			{
				type: "commitMove",
				player: "X",
				from: { row: 4, col: 0 },
				to: { row: 2, col: 2 }
			},
			{
				type: "commitMove",
				player: "X",
				from: { row: 2, col: 2 },
				to: { row: 0, col: 4 }
			},
			{
				type: "commitMove",
				player: "O",
				from: { row: 0, col: 0 },
				to: { row: 1, col: 1 }
			},
			{
				type: "commitMove",
				player: "O",
				from: { row: 1, col: 1 },
				to: { row: 2, col: 0 }
			}
		];
		const replay = replayActions(config, actions, 0);
		expect(replay.faithful).toBe(true);
		expect(getCell(replay.finalState.grid, { row: 0, col: 4 })).toBe("X");
		expect(getCell(replay.finalState.grid, { row: 3, col: 1 })).toBeNull();
		expect(getCell(replay.finalState.grid, { row: 1, col: 3 })).toBeNull();
		expect(replay.finalState.status).toBe("won");
		expect(replay.finalState.winner).toBe("X");
		expect(replay.finalState.moveCount).toBe(1);
		expect(replay.finalState.committedMoves).toBeUndefined();
	});
});
