import { describe, expect, it } from "vitest";
import { compileConfig, compileToGameConfig } from "@/compiler";
import { zConfig } from "@/schemas/config";
import { examplePresets } from "@/presets/registry";
import { asMoveList, getCell, toIndex } from "@/engine/types";
import { stepPly, type KernelAction } from "@/engine/kernel";
import { replayActions } from "@/ir/gameIr";
import { validateConfig } from "@/engine/validateConfig";
import {
	enumerateCommitRevealJoints,
	isFreshCommitRound,
	seatCommitFromJoint
} from "@/agents/jointLegal";

describe("schema: commitReveal × multi-action simultaneous move", () => {
	it("accepts hidden-double-simultaneous-step-race preset", () => {
		const ok = zConfig.safeParse(
			examplePresets["hidden-double-simultaneous-step-race"].config
		);
		expect(ok.success).toBe(true);
	});

	it("wires ScheduleMultiActionSimultaneous + commitReveal + move", () => {
		const result = validateConfig(
			examplePresets["hidden-double-simultaneous-step-race"].config
		);
		expect(result.ok).toBe(true);
		const { gameConfig } = compileToGameConfig(
			examplePresets["hidden-double-simultaneous-step-race"].config
		);
		expect(gameConfig.turnSchedule).toBe("simultaneous");
		expect(gameConfig.commitReveal).toBe(true);
		expect(gameConfig.inputMode).toBe("move");
		expect(gameConfig.actionsPerTurn).toBe(2);
		expect(gameConfig.objectiveMode).toBe("reach_row");
	});

	it("still rejects range > 1 and replace under hidden multi-action move", () => {
		const slide = zConfig.safeParse({
			...examplePresets["hidden-double-simultaneous-step-race"].config,
			movement: { adjacency: "orthogonal", range: 2 }
		});
		expect(slide.success).toBe(false);

		const replace = zConfig.safeParse({
			...examplePresets["hidden-double-simultaneous-step-race"].config,
			movement: {
				adjacency: "orthogonal",
				range: 1,
				capture: "replace"
			}
		});
		expect(replace.success).toBe(false);
	});
});

describe("kernel: hidden multi-action commitMove", () => {
	it("accumulates two commits per seat then reveals", () => {
		const { kernel } = compileConfig(
			examplePresets["hidden-double-simultaneous-step-race"].config
		);
		let state = kernel.initialState();
		expect(kernel.currentPlayer(state)).toBe("simultaneous");

		// X: (4,2)→(3,2)→(2,2)
		state = kernel.stepSync(state, {
			type: "commitMove",
			player: "X",
			from: { row: 4, col: 2 },
			to: { row: 3, col: 2 }
		}).nextState;
		expect(state.moveCount).toBe(0);
		expect(state.committedMoves?.X).toHaveLength(1);
		expect(kernel.legalActions(state, 0).every((a) => a.type === "commitMove")).toBe(
			true
		);
		expect(kernel.legalActions(state, 0).length).toBeGreaterThan(0);

		state = kernel.stepSync(state, {
			type: "commitMove",
			player: "X",
			from: { row: 3, col: 2 },
			to: { row: 2, col: 2 }
		}).nextState;
		expect(state.committedMoves?.X).toHaveLength(2);
		expect(kernel.legalActions(state, 0)).toHaveLength(0);

		// O: (0,2)→(1,2)→(1,1) — avoid same-dest conflict
		state = kernel.stepSync(state, {
			type: "commitMove",
			player: "O",
			from: { row: 0, col: 2 },
			to: { row: 1, col: 2 }
		}).nextState;
		expect(state.moveCount).toBe(0);
		expect(state.committedMoves?.O).toHaveLength(1);

		const result = kernel.stepSync(state, {
			type: "commitMove",
			player: "O",
			from: { row: 1, col: 2 },
			to: { row: 1, col: 1 }
		});
		state = result.nextState;
		expect(state.committedMoves).toBeUndefined();
		expect(state.moveCount).toBe(1);
		expect(getCell(state.grid, { row: 2, col: 2 })).toBe("X");
		expect(getCell(state.grid, { row: 1, col: 1 })).toBe("O");
		expect(getCell(state.grid, { row: 4, col: 2 })).toBe(null);
		expect(getCell(state.grid, { row: 0, col: 2 })).toBe(null);
	});

	it("allows chain commit #2 while public origin still occupied", () => {
		const { kernel } = compileConfig(
			examplePresets["hidden-double-simultaneous-step-race"].config
		);
		let state = kernel.initialState();
		state = kernel.stepSync(state, {
			type: "commitMove",
			player: "X",
			from: { row: 4, col: 2 },
			to: { row: 3, col: 2 }
		}).nextState;
		// Public board still shows X at origin
		expect(getCell(state.grid, { row: 4, col: 2 })).toBe("X");
		expect(getCell(state.grid, { row: 3, col: 2 })).toBe(null);

		const chain = {
			type: "commitMove" as const,
			player: "X" as const,
			from: { row: 3, col: 2 },
			to: { row: 2, col: 2 }
		};
		expect(kernel.explainAction(state, 0, chain).legal).toBe(true);
		const legal = kernel.legalActions(state, 0);
		expect(
			legal.some(
				(a) =>
					a.type === "commitMove" &&
					a.from.row === 3 &&
					a.from.col === 2 &&
					a.to.row === 2 &&
					a.to.col === 2
			)
		).toBe(true);

		state = kernel.stepSync(state, chain).nextState;
		expect(state.committedMoves?.X).toHaveLength(2);
		const obs = kernel.observe(state, 0);
		const d1 = toIndex({ row: 3, col: 2 }, state.grid.width);
		const d2 = toIndex({ row: 2, col: 2 }, state.grid.width);
		expect(obs.cells[d1]).toBe("X");
		expect(obs.cells[d2]).toBe("X");
		expect(obs.pendingCommit).toEqual({
			kind: "move",
			from: { row: 3, col: 2 },
			to: { row: 2, col: 2 }
		});
	});

	it("stepPly completes a hidden double-move round via sequential commits", () => {
		const { kernel } = compileConfig(
			examplePresets["hidden-double-simultaneous-step-race"].config
		);
		const state = kernel.initialState();
		const picks: Record<0 | 1, KernelAction[]> = {
			0: [
				{
					type: "commitMove",
					player: "X",
					from: { row: 4, col: 2 },
					to: { row: 3, col: 2 }
				},
				{
					type: "commitMove",
					player: "X",
					from: { row: 3, col: 2 },
					to: { row: 2, col: 2 }
				}
			],
			1: [
				{
					type: "commitMove",
					player: "O",
					from: { row: 0, col: 2 },
					to: { row: 1, col: 2 }
				},
				{
					type: "commitMove",
					player: "O",
					from: { row: 1, col: 2 },
					to: { row: 1, col: 1 }
				}
			]
		};
		const idx = { 0: 0, 1: 0 };
		const result = stepPly(kernel, state, (player) => {
			const seat = player as 0 | 1;
			const action = picks[seat][idx[seat]++]!;
			return action;
		});
		expect(result).not.toBeNull();
		expect(getCell(result!.nextState.grid, { row: 2, col: 2 })).toBe("X");
		expect(getCell(result!.nextState.grid, { row: 1, col: 1 })).toBe("O");
		expect(result!.nextState.moveCount).toBe(1);
		expect(result!.nextState.committedMoves).toBeUndefined();
	});
});

describe("agents: commitReveal multi-move joints", () => {
	it("enumerateCommitRevealJoints yields length-2 simultaneousMove arrays", () => {
		const { kernel } = compileConfig(
			examplePresets["hidden-double-simultaneous-step-race"].config
		);
		const state = kernel.initialState();
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
	});
});

describe("transcript: Hidden Double Simultaneous Step Race", () => {
	it("replays four commitMove events via GameIR", () => {
		const config = compileToGameConfig(
			examplePresets["hidden-double-simultaneous-step-race"].config
		).gameConfig;
		const actions: KernelAction[] = [
			{
				type: "commitMove",
				player: "X",
				from: { row: 4, col: 2 },
				to: { row: 3, col: 2 }
			},
			{
				type: "commitMove",
				player: "X",
				from: { row: 3, col: 2 },
				to: { row: 2, col: 2 }
			},
			{
				type: "commitMove",
				player: "O",
				from: { row: 0, col: 2 },
				to: { row: 1, col: 2 }
			},
			{
				type: "commitMove",
				player: "O",
				from: { row: 1, col: 2 },
				to: { row: 1, col: 1 }
			}
		];
		const replay = replayActions(config, actions, 0);
		expect(replay.faithful).toBe(true);
		expect(getCell(replay.finalState.grid, { row: 2, col: 2 })).toBe("X");
		expect(getCell(replay.finalState.grid, { row: 1, col: 1 })).toBe("O");
		expect(replay.finalState.moveCount).toBe(1);
		expect(replay.finalState.committedMoves).toBeUndefined();
	});
});
