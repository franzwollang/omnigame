import { describe, expect, it } from "vitest";
import { compileConfig, compileToGameConfig } from "@/compiler";
import {
	enumerateCommitRevealJoints,
	isFreshCommitRound,
	seatCommitFromJoint
} from "@/agents/jointLegal";
import {
	stepPly,
	type KernelAction
} from "@/engine/kernel";
import { getCell, toIndex } from "@/engine/types";
import { validateConfig } from "@/engine/validateConfig";
import { replayActions } from "@/ir/gameIr";
import { zConfig } from "@/schemas/config";
import { examplePresets } from "@/presets/registry";

const JUMP = {
	adjacency: "diagonal" as const,
	range: 1 as const,
	capture: "jump" as const
};

describe("schema: commitReveal × simultaneous jump (M83)", () => {
	it("validates and compiles the hidden-simultaneous-jump-race preset", () => {
		const cfg = examplePresets["hidden-simultaneous-jump-race"].config;
		expect(validateConfig(cfg).ok).toBe(true);
		expect(zConfig.safeParse(cfg).success).toBe(true);
		const { kernel, gameConfig } = compileConfig(cfg);
		expect(gameConfig.turnSchedule).toBe("simultaneous");
		expect(gameConfig.commitReveal).toBe(true);
		expect(gameConfig.movement?.capture).toBe("jump");
		const state = kernel.initialState(cfg.rng.seed);
		expect(kernel.currentPlayer(state)).toBe("simultaneous");
	});

	it("accepts open simultaneous-jump-race + commitReveal", () => {
		const cfg = {
			...examplePresets["simultaneous-jump-race"].config,
			turn: {
				mode: "turn" as const,
				schedule: "simultaneous" as const,
				commitReveal: true
			}
		};
		expect(validateConfig(cfg).ok).toBe(true);
		expect(zConfig.safeParse(cfg).success).toBe(true);
	});

	it("still rejects hex simultaneous jump under commitReveal", () => {
		const cfg = {
			...examplePresets["hidden-simultaneous-jump-race"].config,
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

	it("still rejects actionsPerTurn > 1 under simultaneous jump", () => {
		const cfg = {
			...examplePresets["hidden-simultaneous-jump-race"].config,
			turn: {
				mode: "turn" as const,
				schedule: "simultaneous" as const,
				commitReveal: true,
				actionsPerTurn: 2
			}
		};
		expect(validateConfig(cfg).ok).toBe(false);
	});

	it("still rejects mustLongestCapture under simultaneous jump", () => {
		const cfg = {
			...examplePresets["hidden-simultaneous-jump-race"].config,
			movement: {
				...JUMP,
				mustCapture: true,
				mustLongestCapture: true
			}
		};
		expect(validateConfig(cfg).ok).toBe(false);
	});
});

describe("kernel: hidden simultaneous commitMove × jump", () => {
	it("lists commitMove; first commit hides dest from opponent", () => {
		const { kernel } = compileConfig(
			examplePresets["hidden-simultaneous-jump-race"].config
		);
		let state = kernel.initialState(42);
		const legalX = kernel.legalActions(state, 0);
		expect(legalX.every((a) => a.type === "commitMove")).toBe(true);
		expect(
			legalX.some(
				(a) =>
					a.type === "commitMove" &&
					a.from.row === 2 &&
					a.from.col === 0 &&
					a.to.row === 0 &&
					a.to.col === 2
			)
		).toBe(true);

		const result = kernel.stepSync(state, {
			type: "commitMove",
			player: "X",
			from: { row: 2, col: 0 },
			to: { row: 0, col: 2 }
		});
		state = result.nextState;
		expect(state.moveCount).toBe(0);
		expect(state.committedMoves?.X).toEqual([
			{ from: { row: 2, col: 0 }, to: { row: 0, col: 2 } }
		]);
		expect(getCell(state.grid, { row: 2, col: 0 })).toBe("X");
		expect(getCell(state.grid, { row: 0, col: 2 })).toBe(null);
		expect(getCell(state.grid, { row: 1, col: 1 })).toBe("O");

		const obsX = kernel.observe(state, 0);
		const obsO = kernel.observe(state, 1);
		const destIdx = toIndex({ row: 0, col: 2 }, state.grid.width);
		const midIdx = toIndex({ row: 1, col: 1 }, state.grid.width);
		expect(obsX.cells[destIdx]).toBe("X");
		expect(obsO.cells[destIdx]).toBe(null);
		expect(obsO.cells[midIdx]).toBe("O");
		expect(obsX.pendingCommit).toEqual({
			kind: "move",
			from: { row: 2, col: 0 },
			to: { row: 0, col: 2 }
		});
		expect(obsO.pendingCommit).toBeUndefined();
		expect(kernel.legalActions(state, 0)).toHaveLength(0);
		expect(
			kernel.legalActions(state, 1).every((a) => a.type === "commitMove")
		).toBe(true);
	});

	it("second commit reveals: mid clear, pieceCaptured, X wins", () => {
		const { kernel } = compileConfig(
			examplePresets["hidden-simultaneous-jump-race"].config
		);
		let state = kernel.initialState(42);
		state = kernel.stepSync(state, {
			type: "commitMove",
			player: "X",
			from: { row: 2, col: 0 },
			to: { row: 0, col: 2 }
		}).nextState;
		const result = kernel.stepSync(state, {
			type: "commitMove",
			player: "O",
			from: { row: 4, col: 4 },
			to: { row: 3, col: 3 }
		});
		state = result.nextState;
		expect(getCell(state.grid, { row: 0, col: 2 })).toBe("X");
		expect(getCell(state.grid, { row: 1, col: 1 })).toBeNull();
		expect(getCell(state.grid, { row: 3, col: 3 })).toBe("O");
		expect(getCell(state.grid, { row: 2, col: 0 })).toBeNull();
		expect(
			result.events.some(
				(e) =>
					e.type === "pieceCaptured" &&
					e.position.row === 1 &&
					e.position.col === 1 &&
					e.captured === "O" &&
					e.by === "X"
			)
		).toBe(true);
		expect(state.mustContinueFrom).toBeUndefined();
		expect(state.committedMoves).toBeUndefined();
		expect(state.status).toBe("won");
		expect(state.winner).toBe("X");
		expect(state.moveCount).toBe(1);
	});

	it("blind mid-flee + jump aborts reveal (clear commits, board unchanged)", () => {
		const { kernel } = compileConfig(
			examplePresets["hidden-simultaneous-jump-race"].config
		);
		let state = kernel.initialState(42);
		state = kernel.stepSync(state, {
			type: "commitMove",
			player: "X",
			from: { row: 2, col: 0 },
			to: { row: 0, col: 2 }
		}).nextState;
		// O can still commit the flee while X's jump is hidden.
		const explained = kernel.explainAction(state, 1, {
			type: "commitMove",
			player: "O",
			from: { row: 1, col: 1 },
			to: { row: 0, col: 0 }
		});
		expect(explained.legal).toBe(true);
		const after = kernel.stepSync(state, {
			type: "commitMove",
			player: "O",
			from: { row: 1, col: 1 },
			to: { row: 0, col: 0 }
		});
		// Illegal joint at reveal: pieces stay put, commits cleared, wasted round.
		expect(getCell(after.nextState.grid, { row: 2, col: 0 })).toBe("X");
		expect(getCell(after.nextState.grid, { row: 1, col: 1 })).toBe("O");
		expect(getCell(after.nextState.grid, { row: 0, col: 2 })).toBeNull();
		expect(after.nextState.committedMoves).toBeUndefined();
		expect(after.nextState.moveCount).toBe(1);
		expect(
			after.events.some((e) => e.type === "pieceCaptured")
		).toBe(false);
		expect(after.nextState.status).toBe("playing");
		// Seats may re-commit after abort.
		expect(
			kernel
				.legalActions(after.nextState, 0)
				.every((a) => a.type === "commitMove")
		).toBe(true);
	});

	it("mustCapture forbids quiet commitMove when a jump exists", () => {
		const cfg = {
			...examplePresets["hidden-simultaneous-jump-race"].config,
			movement: { ...JUMP, mustCapture: true }
		};
		expect(validateConfig(cfg).ok).toBe(true);
		const { kernel } = compileConfig(cfg);
		const state = kernel.initialState(42);
		const xLegals = kernel.legalActions(state, 0);
		expect(
			xLegals.some(
				(a) =>
					a.type === "commitMove" &&
					a.from.row === 2 &&
					a.from.col === 0 &&
					a.to.row === 0 &&
					a.to.col === 2
			)
		).toBe(true);
		expect(
			xLegals.some(
				(a) =>
					a.type === "commitMove" &&
					a.from.row === 2 &&
					a.from.col === 0 &&
					a.to.row === 3 &&
					a.to.col === 1
			)
		).toBe(false);
	});

	it("stepPly completes a full commit-reveal jump round", () => {
		const { kernel } = compileConfig(
			examplePresets["hidden-simultaneous-jump-race"].config
		);
		const state = kernel.initialState(42);
		const result = stepPly(kernel, state, (player) => ({
			type: "commitMove",
			player: player === 0 ? "X" : "O",
			from:
				player === 0
					? { row: 2, col: 0 }
					: { row: 4, col: 4 },
			to:
				player === 0
					? { row: 0, col: 2 }
					: { row: 3, col: 3 }
		}));
		expect(result).not.toBeNull();
		expect(getCell(result!.nextState.grid, { row: 0, col: 2 })).toBe("X");
		expect(getCell(result!.nextState.grid, { row: 1, col: 1 })).toBeNull();
		expect(result!.nextState.status).toBe("won");
		expect(result!.nextState.winner).toBe("X");
		expect(result!.nextState.committedMoves).toBeUndefined();
	});
});

describe("transcript: Hidden Simultaneous Jump Race", () => {
	it("replays commitMove jump sequence via GameIR", () => {
		const config = compileToGameConfig(
			examplePresets["hidden-simultaneous-jump-race"].config
		).gameConfig;
		const actions: KernelAction[] = [
			{
				type: "commitMove",
				player: "X",
				from: { row: 2, col: 0 },
				to: { row: 0, col: 2 }
			},
			{
				type: "commitMove",
				player: "O",
				from: { row: 4, col: 4 },
				to: { row: 3, col: 3 }
			}
		];
		const replay = replayActions(config, actions, 0);
		expect(replay.faithful).toBe(true);
		expect(getCell(replay.finalState.grid, { row: 0, col: 2 })).toBe("X");
		expect(getCell(replay.finalState.grid, { row: 1, col: 1 })).toBeNull();
		expect(replay.finalState.status).toBe("won");
		expect(replay.finalState.winner).toBe("X");
	});
});

describe("agents: commitReveal jump joints", () => {
	it("enumerateCommitRevealJoints non-empty on fresh; empty after one commit", () => {
		const { kernel } = compileConfig(
			examplePresets["hidden-simultaneous-jump-race"].config
		);
		let state = kernel.initialState(42);
		expect(isFreshCommitRound(state)).toBe(true);
		const joints = enumerateCommitRevealJoints(kernel, state);
		expect(joints.length).toBeGreaterThan(0);
		expect(joints.every((j) => j.type === "simultaneousMove")).toBe(true);
		expect(
			joints.some((j) => {
				if (j.type !== "simultaneousMove") return false;
				const x = Array.isArray(j.moves.X) ? j.moves.X[0] : j.moves.X;
				return (
					x?.from.row === 2 &&
					x.from.col === 0 &&
					x.to.row === 0 &&
					x.to.col === 2
				);
			})
		).toBe(true);

		state = kernel.stepSync(state, {
			type: "commitMove",
			player: "X",
			from: { row: 2, col: 0 },
			to: { row: 0, col: 2 }
		}).nextState;
		expect(isFreshCommitRound(state)).toBe(false);
		expect(enumerateCommitRevealJoints(kernel, state)).toHaveLength(0);

		const joint = joints.find((j) => {
			if (j.type !== "simultaneousMove") return false;
			const x = Array.isArray(j.moves.X) ? j.moves.X[0] : j.moves.X;
			return x?.to.row === 0 && x.to.col === 2;
		});
		expect(joint).toBeDefined();
		if (joint && joint.type === "simultaneousMove") {
			const seat = seatCommitFromJoint(joint, 1);
			expect(seat?.type).toBe("commitMove");
		}
	});
});
