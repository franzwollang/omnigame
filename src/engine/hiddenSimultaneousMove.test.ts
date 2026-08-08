import { describe, expect, it } from "vitest";
import { compileConfig, compileToGameConfig } from "@/compiler";
import { zConfig } from "@/schemas/config";
import { examplePresets } from "@/presets/registry";
import { getCell, toIndex } from "@/engine/types";
import {
	stepPly,
	type KernelAction
} from "@/engine/kernel";
import { replayActions } from "@/ir/gameIr";
import { validateConfig } from "@/engine/validateConfig";
import {
	enumerateCommitRevealJoints,
	isFreshCommitRound,
	seatCommitFromJoint
} from "@/agents/jointLegal";

describe("schema: commitReveal × simultaneous move", () => {
	it("accepts simultaneous-step-race + commitReveal; rejects multi-action", () => {
		const ok = zConfig.safeParse(
			examplePresets["hidden-simultaneous-step-race"].config
		);
		expect(ok.success).toBe(true);

		const fromOpen = zConfig.safeParse({
			...examplePresets["simultaneous-step-race"].config,
			turn: {
				mode: "turn",
				schedule: "simultaneous",
				commitReveal: true
			}
		});
		expect(fromOpen.success).toBe(true);

		const multi = zConfig.safeParse({
			...examplePresets["simultaneous-step-race"].config,
			turn: {
				mode: "turn",
				schedule: "simultaneous",
				commitReveal: true,
				actionsPerTurn: 2
			}
		});
		expect(multi.success).toBe(false);
	});

	it("rejects alternating + commitReveal + move", () => {
		const bad = zConfig.safeParse({
			...examplePresets["simultaneous-step-race"].config,
			turn: {
				mode: "turn",
				schedule: "alternating",
				commitReveal: true
			}
		});
		expect(bad.success).toBe(false);
	});
});

describe("kernel: hidden simultaneous commitMove", () => {
	it("lists commitMove actions; first commit hides dest from opponent", () => {
		const { kernel, gameConfig } = compileConfig(
			examplePresets["hidden-simultaneous-step-race"].config
		);
		expect(gameConfig.commitReveal).toBe(true);
		expect(gameConfig.turnSchedule).toBe("simultaneous");
		expect(gameConfig.inputMode).toBe("move");

		let state = kernel.initialState();
		expect(kernel.currentPlayer(state)).toBe("simultaneous");
		const legalX = kernel.legalActions(state, 0);
		expect(legalX.every((a) => a.type === "commitMove")).toBe(true);
		expect(legalX.length).toBeGreaterThan(0);

		const result = kernel.stepSync(state, {
			type: "commitMove",
			player: "X",
			from: { row: 4, col: 2 },
			to: { row: 3, col: 2 }
		});
		state = result.nextState;
		expect(state.moveCount).toBe(0);
		expect(state.committedMoves?.X).toEqual({
			from: { row: 4, col: 2 },
			to: { row: 3, col: 2 }
		});
		expect(getCell(state.grid, { row: 4, col: 2 })).toBe("X");
		expect(getCell(state.grid, { row: 3, col: 2 })).toBe(null);

		const obsX = kernel.observe(state, 0);
		const obsO = kernel.observe(state, 1);
		const destIdx = toIndex({ row: 3, col: 2 }, state.grid.width);
		const fromIdx = toIndex({ row: 4, col: 2 }, state.grid.width);
		expect(obsX.cells[destIdx]).toBe("X"); // own dest overlaid
		expect(obsX.cells[fromIdx]).toBe("X"); // from still occupied publicly
		expect(obsO.cells[destIdx]).toBe(null); // opponent dest hidden
		expect(obsO.cells[fromIdx]).toBe("X");
		expect(obsX.pendingCommit).toEqual({
			kind: "move",
			from: { row: 4, col: 2 },
			to: { row: 3, col: 2 }
		});
		expect(obsO.pendingCommit).toBeUndefined();
		expect(kernel.legalActions(state, 0)).toHaveLength(0);
		expect(kernel.legalActions(state, 1).every((a) => a.type === "commitMove")).toBe(
			true
		);
	});

	it("second commit reveals via joint resolve and clears committedMoves", () => {
		const { kernel } = compileConfig(
			examplePresets["hidden-simultaneous-step-race"].config
		);
		let state = kernel.initialState();
		state = kernel.stepSync(state, {
			type: "commitMove",
			player: "X",
			from: { row: 4, col: 2 },
			to: { row: 3, col: 2 }
		}).nextState;
		const result = kernel.stepSync(state, {
			type: "commitMove",
			player: "O",
			from: { row: 0, col: 2 },
			to: { row: 1, col: 2 }
		});
		state = result.nextState;
		expect(getCell(state.grid, { row: 3, col: 2 })).toBe("X");
		expect(getCell(state.grid, { row: 1, col: 2 })).toBe("O");
		expect(getCell(state.grid, { row: 4, col: 2 })).toBe(null);
		expect(getCell(state.grid, { row: 0, col: 2 })).toBe(null);
		expect(state.moveCount).toBe(1);
		expect(state.committedMoves).toBeUndefined();
	});

	it("same-destination conflict moves neither after reveal", () => {
		const seeded = {
			...examplePresets["hidden-simultaneous-step-race"].config,
			initial: [
				{ row: 2, col: 1, player: "X" as const, visibility: "public" as const },
				{ row: 2, col: 3, player: "O" as const, visibility: "public" as const }
			]
		};
		const { kernel } = compileConfig(seeded);
		let state = kernel.initialState();
		state = kernel.stepSync(state, {
			type: "commitMove",
			player: "X",
			from: { row: 2, col: 1 },
			to: { row: 2, col: 2 }
		}).nextState;
		state = kernel.stepSync(state, {
			type: "commitMove",
			player: "O",
			from: { row: 2, col: 3 },
			to: { row: 2, col: 2 }
		}).nextState;
		expect(getCell(state.grid, { row: 2, col: 2 })).toBe(null);
		expect(getCell(state.grid, { row: 2, col: 1 })).toBe("X");
		expect(getCell(state.grid, { row: 2, col: 3 })).toBe("O");
		expect(state.moveCount).toBe(1);
		expect(state.status).toBe("playing");
		expect(state.committedMoves).toBeUndefined();
	});

	it("rejects double commit from the same seat", () => {
		const { kernel } = compileConfig(
			examplePresets["hidden-simultaneous-step-race"].config
		);
		let state = kernel.initialState();
		state = kernel.stepSync(state, {
			type: "commitMove",
			player: "X",
			from: { row: 4, col: 2 },
			to: { row: 3, col: 2 }
		}).nextState;
		const explained = kernel.explainAction(state, 0, {
			type: "commitMove",
			player: "X",
			from: { row: 4, col: 2 },
			to: { row: 4, col: 1 }
		});
		expect(explained.legal).toBe(false);
		if (!explained.legal) {
			expect(explained.reason).toBe("already_committed");
		}
		const ignored = kernel.stepSync(state, {
			type: "commitMove",
			player: "X",
			from: { row: 4, col: 2 },
			to: { row: 4, col: 1 }
		});
		expect(ignored.events[0]?.type).toBe("ignored");
	});

	it("rejects illegal destination on commitMove", () => {
		const { kernel } = compileConfig(
			examplePresets["hidden-simultaneous-step-race"].config
		);
		const state = kernel.initialState();
		const bad = {
			type: "commitMove" as const,
			player: "X" as const,
			from: { row: 4, col: 2 },
			to: { row: 2, col: 2 } // range-1 orthogonal: two steps north — illegal
		};
		const explained = kernel.explainAction(state, 0, bad);
		expect(explained.legal).toBe(false);
		if (!explained.legal) {
			expect(explained.reason).toBe("invalid_destination");
		}
		const ignored = kernel.stepSync(state, bad);
		expect(ignored.events[0]?.type).toBe("ignored");
		expect(ignored.nextState.committedMoves).toBeUndefined();
	});

	it("stepPly completes a full commit-reveal move round", () => {
		const { kernel } = compileConfig(
			examplePresets["hidden-simultaneous-step-race"].config
		);
		const state = kernel.initialState();
		const result = stepPly(kernel, state, (player) => ({
			type: "commitMove",
			player: player === 0 ? "X" : "O",
			from: player === 0 ? { row: 4, col: 2 } : { row: 0, col: 2 },
			to: player === 0 ? { row: 3, col: 2 } : { row: 1, col: 2 }
		}));
		expect(result).not.toBeNull();
		expect(getCell(result!.nextState.grid, { row: 3, col: 2 })).toBe("X");
		expect(getCell(result!.nextState.grid, { row: 1, col: 2 })).toBe("O");
		expect(result!.nextState.moveCount).toBe(1);
		expect(result!.nextState.committedMoves).toBeUndefined();
	});
});

describe("transcript: Hidden Simultaneous Step Race", () => {
	it("replays commitMove sequence via GameIR", () => {
		const config = compileToGameConfig(
			examplePresets["hidden-simultaneous-step-race"].config
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
				player: "O",
				from: { row: 0, col: 2 },
				to: { row: 1, col: 2 }
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
				from: { row: 1, col: 2 },
				to: { row: 2, col: 2 }
			}
		];
		const replay = replayActions(config, actions, 0);
		expect(replay.faithful).toBe(true);
		// Same-destination conflict on round 2 → neither moves from round-1 cells
		expect(getCell(replay.finalState.grid, { row: 3, col: 2 })).toBe("X");
		expect(getCell(replay.finalState.grid, { row: 1, col: 2 })).toBe("O");
		expect(getCell(replay.finalState.grid, { row: 2, col: 2 })).toBe(null);
		expect(replay.finalState.moveCount).toBe(2);
	});
});

describe("agents: commitReveal move joints", () => {
	it("enumerateCommitRevealJoints non-empty on fresh; empty after one commit", () => {
		const { kernel } = compileConfig(
			examplePresets["hidden-simultaneous-step-race"].config
		);
		let state = kernel.initialState();
		expect(isFreshCommitRound(state)).toBe(true);
		const joints = enumerateCommitRevealJoints(kernel, state);
		expect(joints.length).toBeGreaterThan(0);
		expect(joints.every((j) => j.type === "simultaneousMove")).toBe(true);

		state = kernel.stepSync(state, {
			type: "commitMove",
			player: "X",
			from: { row: 4, col: 2 },
			to: { row: 3, col: 2 }
		}).nextState;
		expect(isFreshCommitRound(state)).toBe(false);
		expect(enumerateCommitRevealJoints(kernel, state)).toHaveLength(0);
	});

	it("seatCommitFromJoint maps simultaneousMove to commitMove", () => {
		const { kernel } = compileConfig(
			examplePresets["hidden-simultaneous-step-race"].config
		);
		const state = kernel.initialState();
		const joints = enumerateCommitRevealJoints(kernel, state);
		const joint = joints.find(
			(j) =>
				j.type === "simultaneousMove" &&
				j.moves.X.from.row === 4 &&
				j.moves.X.from.col === 2 &&
				j.moves.X.to.row === 3 &&
				j.moves.X.to.col === 2
		);
		expect(joint?.type).toBe("simultaneousMove");
		if (joint?.type !== "simultaneousMove") throw new Error("expected joint");
		expect(seatCommitFromJoint(joint, 0)).toEqual({
			type: "commitMove",
			player: "X",
			from: joint.moves.X.from,
			to: joint.moves.X.to
		});
		expect(seatCommitFromJoint(joint, 1)).toEqual({
			type: "commitMove",
			player: "O",
			from: joint.moves.O.from,
			to: joint.moves.O.to
		});
	});
});

describe("validateConfig: hidden simultaneous step race", () => {
	it("accepts Hidden Simultaneous Step Race preset", () => {
		const result = validateConfig(
			examplePresets["hidden-simultaneous-step-race"].config
		);
		expect(result.ok).toBe(true);
	});
});
