import { describe, expect, it } from "vitest";
import { compileConfig } from "@/compiler";
import {
	createAgent,
	createGreedyAgent,
	createHuntAgent,
	createRandomAgent,
	createTinyMctsAgent,
	createUctAgent,
	canSearchCommitRevealJoint,
	canSearchJointActions,
	enumerateCommitRevealJoints,
	enumerateJointLegalActions,
	isFreshCommitRound,
	jointSeatBudget,
	orderedDistinctPlaceTuples,
	pickHuntFireAction,
	seatCommitFromJoint,
	seatComponentFromJoint
} from "@/agents";
import { examplePresets } from "@/presets/registry";
import {
	jointEliminateFromActions,
	jointGuessFromActions,
	jointPlaceFromActions,
	jointPlacesFromActions,
	jointQueryFromActions
} from "@/engine/kernel";
import type { KernelAction } from "@/engine/kernel";
import type { CellValue } from "@/engine/types";
import { setCell } from "@/engine/types";

function jointFromSeatPair(
	a0: KernelAction,
	a1: KernelAction
): KernelAction | null {
	return (
		jointPlaceFromActions(a0, a1) ??
		jointQueryFromActions(a0, a1) ??
		jointGuessFromActions(a0, a1) ??
		jointEliminateFromActions(a0, a1)
	);
}

describe("kernel agents (M6)", () => {
	it("random agent only picks from legalActions", () => {
		const { kernel } = compileConfig(examplePresets["tic-tac-toe"].config);
		let state = kernel.initialState(7);
		const agent = createRandomAgent(7);
		for (let i = 0; i < 5; i++) {
			const player = kernel.currentPlayer(state);
			expect(player).not.toBe("simultaneous");
			if (player === "simultaneous") throw new Error("unexpected");
			const legal = kernel.legalActions(state, player);
			const action = agent.act(kernel, state, player);
			expect(action).not.toBeNull();
			expect(
				legal.some(
					(a) =>
						a.type === action!.type &&
						a.type === "place" &&
						action!.type === "place" &&
						a.position.row === action!.position.row &&
						a.position.col === action!.position.col
				)
			).toBe(true);
			state = kernel.stepSync(state, action!).nextState;
		}
	});

	it("greedy agent takes an immediate winning place on TTT", () => {
		const { kernel } = compileConfig(examplePresets["tic-tac-toe"].config);
		let state = kernel.initialState();
		const script: KernelAction[] = [
			{ type: "place", position: { row: 0, col: 0 } },
			{ type: "place", position: { row: 1, col: 0 } },
			{ type: "place", position: { row: 0, col: 1 } },
			{ type: "place", position: { row: 1, col: 1 } }
		];
		for (const action of script) {
			state = kernel.stepSync(state, action).nextState;
		}
		// X to move; (0,2) wins
		const agent = createGreedyAgent();
		const pick = agent.act(kernel, state, 0);
		expect(pick).toEqual({ type: "place", position: { row: 0, col: 2 } });
		state = kernel.stepSync(state, pick!).nextState;
		expect(state.status).toBe("won");
		expect(state.winner).toBe("X");
	});

	it("createAgent factory returns requested kind", () => {
		expect(createAgent("random").kind).toBe("random");
		expect(createAgent("greedy").kind).toBe("greedy");
		expect(createAgent("hunt").kind).toBe("hunt");
		expect(createAgent("mcts").kind).toBe("mcts");
		expect(createAgent("uct").kind).toBe("uct");
	});

	it("tiny mcts takes an immediate winning place on TTT", () => {
		const { kernel } = compileConfig(examplePresets["tic-tac-toe"].config);
		let state = kernel.initialState();
		const script: KernelAction[] = [
			{ type: "place", position: { row: 0, col: 0 } },
			{ type: "place", position: { row: 1, col: 0 } },
			{ type: "place", position: { row: 0, col: 1 } },
			{ type: "place", position: { row: 1, col: 1 } }
		];
		for (const action of script) {
			state = kernel.stepSync(state, action).nextState;
		}
		const agent = createAgent("mcts", 3);
		const pick = agent.act(kernel, state, 0);
		expect(pick).toEqual({ type: "place", position: { row: 0, col: 2 } });
	});

	it("uct takes an immediate winning place on TTT", () => {
		const { kernel } = compileConfig(examplePresets["tic-tac-toe"].config);
		let state = kernel.initialState();
		const script: KernelAction[] = [
			{ type: "place", position: { row: 0, col: 0 } },
			{ type: "place", position: { row: 1, col: 0 } },
			{ type: "place", position: { row: 0, col: 1 } },
			{ type: "place", position: { row: 1, col: 1 } }
		];
		for (const action of script) {
			state = kernel.stepSync(state, action).nextState;
		}
		const agent = createUctAgent(3, { simulations: 40 });
		const pick = agent.act(kernel, state, 0);
		expect(pick).toEqual({ type: "place", position: { row: 0, col: 2 } });
	});

	it("uct completes a short TTT playout against random", () => {
		const { kernel } = compileConfig(examplePresets["tic-tac-toe"].config);
		let state = kernel.initialState(11);
		const uct = createUctAgent(11, { simulations: 48, reuseTree: true });
		const random = createRandomAgent(99);
		let guard = 0;
		while (state.status === "playing" && guard < 20) {
			const player = kernel.currentPlayer(state);
			expect(player).not.toBe("simultaneous");
			if (player === "simultaneous") throw new Error("unexpected");
			const agent = player === 0 ? uct : random;
			const action = agent.act(kernel, state, player);
			expect(action).not.toBeNull();
			state = kernel.stepSync(state, action!).nextState;
			guard += 1;
		}
		expect(state.status === "won" || state.status === "draw").toBe(true);
	});

	it("uct blocks an immediate opponent threat on TTT", () => {
		const { kernel } = compileConfig(examplePresets["tic-tac-toe"].config);
		let state = kernel.initialState();
		state = kernel.stepSync(state, {
			type: "place",
			position: { row: 0, col: 0 }
		}).nextState;
		state = kernel.stepSync(state, {
			type: "place",
			position: { row: 1, col: 1 }
		}).nextState;
		state = kernel.stepSync(state, {
			type: "place",
			position: { row: 0, col: 1 }
		}).nextState;
		// O to move; X threatens (0,2)
		const agent = createUctAgent(5, { simulations: 64 });
		const pick = agent.act(kernel, state, 1);
		expect(pick).toEqual({ type: "place", position: { row: 0, col: 2 } });
	});

	it("greedy prefers a blocking reply when opponent threatens", () => {
		const { kernel } = compileConfig(examplePresets["tic-tac-toe"].config);
		let state = kernel.initialState();
		// X center, O corner, X top-left — O must block bottom-right for X's diagonal? 
		// Simpler: X has two in a row on top; O to move must block.
		state = kernel.stepSync(state, {
			type: "place",
			position: { row: 0, col: 0 }
		}).nextState;
		state = kernel.stepSync(state, {
			type: "place",
			position: { row: 1, col: 1 }
		}).nextState;
		state = kernel.stepSync(state, {
			type: "place",
			position: { row: 0, col: 1 }
		}).nextState;
		// O to move; X threatens (0,2)
		const agent = createGreedyAgent();
		const pick = agent.act(kernel, state, 1);
		expect(pick).toEqual({ type: "place", position: { row: 0, col: 2 } });
	});

	it("hunt picker targets orthogonal neighbors after a hit", () => {
		const width = 5;
		const height = 5;
		const cells: CellValue[] = Array(width * height).fill(null);
		cells[4 * width + 4] = "hit";
		const legal: KernelAction[] = [
			{ type: "fire", position: { row: 0, col: 0 } },
			{ type: "fire", position: { row: 3, col: 4 } },
			{ type: "fire", position: { row: 4, col: 3 } },
			{ type: "fire", position: { row: 2, col: 2 } }
		];
		const next = () => 0; // always first of preferred pool
		const pick = pickHuntFireAction(cells, width, height, legal, next);
		expect(pick?.type).toBe("fire");
		expect(
			pick &&
				pick.type === "fire" &&
				((pick.position.row === 3 && pick.position.col === 4) ||
					(pick.position.row === 4 && pick.position.col === 3))
		).toBe(true);
	});

	it("hunt picker extends a line of hits before other neighbors", () => {
		const width = 5;
		const height = 5;
		const cells: CellValue[] = Array(width * height).fill(null);
		cells[4 * width + 3] = "hit";
		cells[4 * width + 4] = "hit";
		const legal: KernelAction[] = [
			{ type: "fire", position: { row: 4, col: 2 } }, // line extension
			{ type: "fire", position: { row: 3, col: 4 } }, // mere neighbor
			{ type: "fire", position: { row: 0, col: 0 } }
		];
		const pick = pickHuntFireAction(cells, width, height, legal, () => 0);
		expect(pick).toEqual({ type: "fire", position: { row: 4, col: 2 } });
	});

	it("hunt agent fires only legal cells on Battleship-lite and hunts after hit", () => {
		const { kernel } = compileConfig(
			examplePresets["battleship-lite"].config
		);
		let state = kernel.initialState(42);
		const agent = createHuntAgent(42);

		// First shot: any legal fire (parity search)
		const first = agent.act(kernel, state, 0);
		expect(first?.type).toBe("fire");
		const openingLegal = kernel.legalActions(state, 0);
		expect(
			openingLegal.some(
				(a) =>
					a.type === "fire" &&
					first!.type === "fire" &&
					a.position.row === first!.position.row &&
					a.position.col === first!.position.col
			)
		).toBe(true);

		// Force a known hit so hunt mode is observable
		state = kernel.stepSync(state, {
			type: "fire",
			position: { row: 4, col: 4 }
		}).nextState;
		expect(state.grid.cells[4 * 5 + 4]).toBe("hit");
		// O replies somewhere harmless
		state = kernel.stepSync(state, {
			type: "fire",
			position: { row: 2, col: 2 }
		}).nextState;

		const huntPick = agent.act(kernel, state, 0);
		expect(huntPick?.type).toBe("fire");
		if (huntPick?.type === "fire") {
			const { row, col } = huntPick.position;
			const orthoToHit =
				(Math.abs(row - 4) === 1 && col === 4) ||
				(row === 4 && Math.abs(col - 4) === 1);
			expect(orthoToHit).toBe(true);
			const stillLegal = kernel.legalActions(state, 0);
			expect(
				stillLegal.some(
					(a) =>
						a.type === "fire" &&
						a.position.row === row &&
						a.position.col === col
				)
			).toBe(true);
		}
	});

	it("hunt agent completes a Battleship-lite playout via observe+legalActions", () => {
		const { kernel } = compileConfig(
			examplePresets["battleship-lite"].config
		);
		let state = kernel.initialState(7);
		const x = createHuntAgent(7);
		const o = createHuntAgent(99);
		let guard = 0;
		while (state.status === "playing" && guard < 40) {
			const player = kernel.currentPlayer(state);
			expect(player).not.toBe("simultaneous");
			if (player === "simultaneous") throw new Error("unexpected");
			const agent = player === 0 ? x : o;
			// Prove observe is available (agent uses it internally)
			const obs = kernel.observe(state, player);
			expect(obs.cells.length).toBe(25);
			expect(obs.visible.every(Boolean)).toBe(true);
			const action = agent.act(kernel, state, player);
			expect(action).not.toBeNull();
			expect(action!.type).toBe("fire");
			state = kernel.stepSync(state, action!).nextState;
			guard += 1;
		}
		expect(state.status).toBe("won");
		expect(state.winner === "X" || state.winner === "O").toBe(true);
	});

	it("mcts/uct hit_miss path delegates to hunt (adjacent after hit)", () => {
		const { kernel } = compileConfig(
			examplePresets["battleship-lite"].config
		);
		let state = kernel.initialState();
		state = kernel.stepSync(state, {
			type: "fire",
			position: { row: 4, col: 4 }
		}).nextState;
		state = kernel.stepSync(state, {
			type: "fire",
			position: { row: 1, col: 1 }
		}).nextState;
		for (const kind of ["mcts", "uct"] as const) {
			const agent = createAgent(kind, 3);
			const pick = agent.act(kernel, state, 0);
			expect(pick?.type).toBe("fire");
			if (pick?.type === "fire") {
				const { row, col } = pick.position;
				const orthoToHit =
					(Math.abs(row - 4) === 1 && col === 4) ||
					(row === 4 && Math.abs(col - 4) === 1);
				expect(orthoToHit).toBe(true);
			}
		}
	});
});

describe("joint UCT/MCTS under simultaneous (M18)", () => {
	it("enumerates 81 joint places on empty simultaneous-ttt", () => {
		const { kernel } = compileConfig(
			examplePresets["simultaneous-ttt"].config
		);
		const state = kernel.initialState();
		expect(canSearchJointActions(kernel)).toBe(true);
		const joints = enumerateJointLegalActions(kernel, state);
		expect(joints).toHaveLength(81);
		expect(joints.every((a) => a.type === "simultaneousPlace")).toBe(true);
	});

	it("open joint search stays off under commitReveal (use commitReveal joints)", () => {
		const hidden = compileConfig(
			examplePresets["hidden-simultaneous-ttt"].config
		);
		expect(canSearchJointActions(hidden.kernel)).toBe(false);
		expect(
			enumerateJointLegalActions(
				hidden.kernel,
				hidden.kernel.initialState()
			)
		).toHaveLength(0);
	});

	it("uct dual-act returns consistent joint seat components", () => {
		const { kernel } = compileConfig(
			examplePresets["simultaneous-ttt"].config
		);
		const state = kernel.initialState(3);
		const agent = createUctAgent(3, { simulations: 48 });
		const a0 = agent.act(kernel, state, 0);
		const a1 = agent.act(kernel, state, 1);
		expect(a0?.type).toBe("place");
		expect(a1?.type).toBe("place");
		const joint =
			jointPlaceFromActions(a0!, a1!) ??
			(() => {
				throw new Error("expected joint place");
			})();
		// Re-compose matches a fresh joint-search cache hit path.
		const again0 = agent.act(kernel, state, 0);
		const again1 = agent.act(kernel, state, 1);
		expect(again0).toEqual(a0);
		expect(again1).toEqual(a1);
		expect(seatComponentFromJoint(joint, 0)).toEqual(a0);
		expect(seatComponentFromJoint(joint, 1)).toEqual(a1);
	});

	it("uct takes an immediate joint winning place for X", () => {
		const { kernel } = compileConfig(
			examplePresets["simultaneous-ttt"].config
		);
		let state = kernel.initialState();
		// X threatens top row; O occupies center-left elsewhere.
		// Empty cells: (0,2) wins for X if O does not collide there.
		state = {
			...state,
			grid: {
				...state.grid,
				cells: setCell(
					{
						...state.grid,
						cells: setCell(
							{
								...state.grid,
								cells: setCell(state.grid, { row: 0, col: 0 }, "X")
							},
							{ row: 0, col: 1 },
							"X"
						)
					},
					{ row: 1, col: 0 },
					"O"
				)
			},
			moveCount: 3
		};
		const agent = createUctAgent(7, { simulations: 40 });
		const pick = agent.act(kernel, state, 0);
		expect(pick).toEqual({ type: "place", position: { row: 0, col: 2 } });
		const oPick = agent.act(kernel, state, 1);
		expect(oPick?.type).toBe("place");
		// Joint must not collide on the winning cell (else neither places).
		expect(oPick).not.toEqual({
			type: "place",
			position: { row: 0, col: 2 }
		});
		const joint = jointPlaceFromActions(pick!, oPick!);
		expect(joint).not.toBeNull();
		const after = kernel.stepSync(state, joint!).nextState;
		expect(after.status).toBe("won");
		expect(after.winner).toBe("X");
	});

	it("mcts takes an immediate joint winning place for X", () => {
		const { kernel } = compileConfig(
			examplePresets["simultaneous-ttt"].config
		);
		let state = kernel.initialState();
		state = {
			...state,
			grid: {
				...state.grid,
				cells: setCell(
					{
						...state.grid,
						cells: setCell(
							{
								...state.grid,
								cells: setCell(state.grid, { row: 0, col: 0 }, "X")
							},
							{ row: 0, col: 1 },
							"X"
						)
					},
					{ row: 1, col: 0 },
					"O"
				)
			},
			moveCount: 3
		};
		const agent = createTinyMctsAgent(5, { rolloutsPerAction: 8 });
		const pick = agent.act(kernel, state, 0);
		expect(pick).toEqual({ type: "place", position: { row: 0, col: 2 } });
	});

	it("uct completes a short simultaneous-ttt playout via stepPly", () => {
		const { kernel } = compileConfig(
			examplePresets["simultaneous-ttt"].config
		);
		let state = kernel.initialState(11);
		const uct = createUctAgent(11, { simulations: 32, reuseTree: true });
		let guard = 0;
		while (state.status === "playing" && guard < 12) {
			expect(kernel.currentPlayer(state)).toBe("simultaneous");
			const a0 = uct.act(kernel, state, 0);
			const a1 = uct.act(kernel, state, 1);
			expect(a0).not.toBeNull();
			expect(a1).not.toBeNull();
			const result = kernel.stepJointSync(state, { 0: a0!, 1: a1! });
			state = result.nextState;
			guard += 1;
		}
		expect(state.status === "won" || state.status === "draw").toBe(true);
	});
});

describe("joint UCT/MCTS under multi-action simultaneous (M19)", () => {
	it("enumerates 5184 joint double-places on empty double-place-simultaneous-ttt", () => {
		const { kernel } = compileConfig(
			examplePresets["double-place-simultaneous-ttt"].config
		);
		const state = kernel.initialState();
		expect(canSearchJointActions(kernel)).toBe(true);
		expect(kernel.config.actionsPerTurn).toBe(2);
		const places = kernel.legalActions(state, 0);
		expect(places).toHaveLength(9);
		expect(orderedDistinctPlaceTuples(places, 2)).toHaveLength(72);
		const joints = enumerateJointLegalActions(kernel, state);
		expect(joints).toHaveLength(5184);
		expect(joints.every((a) => a.type === "simultaneousPlace")).toBe(true);
		const sample = joints[0]!;
		expect(sample.type).toBe("simultaneousPlace");
		if (sample.type === "simultaneousPlace") {
			expect(jointSeatBudget(sample)).toBe(2);
		}
	});

	it("uct multi-act returns coordinated length-2 picks per seat", () => {
		const { kernel } = compileConfig(
			examplePresets["double-place-simultaneous-ttt"].config
		);
		const state = kernel.initialState(5);
		const agent = createUctAgent(5, { simulations: 40 });
		const x0 = agent.act(kernel, state, 0);
		const x1 = agent.act(kernel, state, 0);
		const o0 = agent.act(kernel, state, 1);
		const o1 = agent.act(kernel, state, 1);
		expect(x0?.type).toBe("place");
		expect(x1?.type).toBe("place");
		expect(o0?.type).toBe("place");
		expect(o1?.type).toBe("place");
		expect(x0).not.toEqual(x1);
		expect(o0).not.toEqual(o1);
		const joint = jointPlacesFromActions([x0!, x1!], [o0!, o1!]);
		expect(joint).not.toBeNull();
		const explained = kernel.explainAction(state, 0, joint!);
		expect(explained.legal).toBe(true);
		// Cache wrap: re-reading seat 0 yields the same ordered pair.
		expect(agent.act(kernel, state, 0)).toEqual(x0);
		expect(agent.act(kernel, state, 0)).toEqual(x1);
	});

	it("uct takes an immediate mid-round joint win for X", () => {
		const { kernel } = compileConfig(
			examplePresets["double-place-simultaneous-ttt"].config
		);
		let state = kernel.initialState();
		// X has top-row threat; index-0 place at (0,2) wins before later picks.
		state = {
			...state,
			grid: {
				...state.grid,
				cells: (() => {
					const cells = [...state.grid.cells];
					cells[0] = "X";
					cells[1] = "X";
					return cells;
				})()
			},
			moveCount: 2
		};
		const agent = createUctAgent(9, { simulations: 24 });
		const x0 = agent.act(kernel, state, 0);
		const x1 = agent.act(kernel, state, 0);
		expect(x0).toEqual({ type: "place", position: { row: 0, col: 2 } });
		expect(x1?.type).toBe("place");
		expect(x1).not.toEqual(x0);
		const o0 = agent.act(kernel, state, 1);
		const o1 = agent.act(kernel, state, 1);
		expect(o0?.type).toBe("place");
		expect(o1?.type).toBe("place");
		// O must not collide on the winning cell at index 0.
		expect(o0).not.toEqual({
			type: "place",
			position: { row: 0, col: 2 }
		});
		const joint = jointPlacesFromActions([x0!, x1!], [o0!, o1!]);
		expect(joint).not.toBeNull();
		const after = kernel.stepSync(state, joint!).nextState;
		expect(after.status).toBe("won");
		expect(after.winner).toBe("X");
	});

	it("mcts takes an immediate mid-round joint win for X", () => {
		const { kernel } = compileConfig(
			examplePresets["double-place-simultaneous-ttt"].config
		);
		let state = kernel.initialState();
		state = {
			...state,
			grid: {
				...state.grid,
				cells: (() => {
					const cells = [...state.grid.cells];
					cells[0] = "X";
					cells[1] = "X";
					return cells;
				})()
			},
			moveCount: 2
		};
		const agent = createTinyMctsAgent(3, { rolloutsPerAction: 4 });
		const x0 = agent.act(kernel, state, 0);
		expect(x0).toEqual({ type: "place", position: { row: 0, col: 2 } });
	});

	it("uct completes a short double-place-simultaneous-ttt playout", () => {
		const { kernel } = compileConfig(
			examplePresets["double-place-simultaneous-ttt"].config
		);
		let state = kernel.initialState(13);
		const uct = createUctAgent(13, { simulations: 28, reuseTree: true });
		let guard = 0;
		while (state.status === "playing" && guard < 8) {
			expect(kernel.currentPlayer(state)).toBe("simultaneous");
			const xs: KernelAction[] = [];
			const os: KernelAction[] = [];
			for (let i = 0; i < 2; i++) {
				const a = uct.act(kernel, state, 0);
				expect(a).not.toBeNull();
				xs.push(a!);
			}
			for (let i = 0; i < 2; i++) {
				const a = uct.act(kernel, state, 1);
				expect(a).not.toBeNull();
				os.push(a!);
			}
			const joint = jointPlacesFromActions(xs, os);
			expect(joint).not.toBeNull();
			state = kernel.stepSync(state, joint!).nextState;
			guard += 1;
		}
		expect(state.status === "won" || state.status === "draw").toBe(true);
	});
});

describe("joint UCT/MCTS under commitReveal (M20)", () => {
	it("enumerates 81 reveal joints on empty hidden-simultaneous-ttt", () => {
		const { kernel } = compileConfig(
			examplePresets["hidden-simultaneous-ttt"].config
		);
		const state = kernel.initialState();
		expect(canSearchJointActions(kernel)).toBe(false);
		expect(canSearchCommitRevealJoint(kernel, state)).toBe(true);
		expect(isFreshCommitRound(state)).toBe(true);
		const joints = enumerateCommitRevealJoints(kernel, state);
		expect(joints).toHaveLength(81);
		expect(joints.every((a) => a.type === "simultaneousPlace")).toBe(true);
	});

	it("disables commitReveal joint enum after a partial commit", () => {
		const { kernel } = compileConfig(
			examplePresets["hidden-simultaneous-ttt"].config
		);
		let state = kernel.initialState();
		state = kernel.stepSync(state, {
			type: "commitPlace",
			player: "X",
			position: { row: 0, col: 0 }
		}).nextState;
		expect(isFreshCommitRound(state)).toBe(false);
		expect(canSearchCommitRevealJoint(kernel, state)).toBe(false);
		expect(enumerateCommitRevealJoints(kernel, state)).toHaveLength(0);
	});

	it("uct sequential commits return coordinated plan across seats", () => {
		const { kernel } = compileConfig(
			examplePresets["hidden-simultaneous-ttt"].config
		);
		const state = kernel.initialState(3);
		const agent = createUctAgent(3, { simulations: 48 });
		const xCommit = agent.act(kernel, state, 0);
		expect(xCommit?.type).toBe("commitPlace");
		if (xCommit?.type !== "commitPlace") throw new Error("expected commit");
		expect(xCommit.player).toBe("X");

		// Simulate sequential sandbox: X commits, then O acts on updated state.
		const afterX = kernel.stepSync(state, xCommit).nextState;
		const oCommit = agent.act(kernel, afterX, 1);
		expect(oCommit?.type).toBe("commitPlace");
		if (oCommit?.type !== "commitPlace") throw new Error("expected commit");
		expect(oCommit.player).toBe("O");

		const joint = {
			type: "simultaneousPlace" as const,
			placements: {
				X: xCommit.position,
				O: oCommit.position
			}
		};
		expect(seatCommitFromJoint(joint, 0)).toEqual(xCommit);
		expect(seatCommitFromJoint(joint, 1)).toEqual(oCommit);

		// Cache wrap on the fresh board still yields the same X pick.
		expect(agent.act(kernel, state, 0)).toEqual(xCommit);
	});

	it("uct takes an immediate winning commit plan for X", () => {
		const { kernel } = compileConfig(
			examplePresets["hidden-simultaneous-ttt"].config
		);
		let state = kernel.initialState();
		state = {
			...state,
			grid: {
				...state.grid,
				cells: setCell(
					{
						...state.grid,
						cells: setCell(
							{
								...state.grid,
								cells: setCell(state.grid, { row: 0, col: 0 }, "X")
							},
							{ row: 0, col: 1 },
							"X"
						)
					},
					{ row: 1, col: 0 },
					"O"
				)
			},
			moveCount: 3
		};
		const agent = createUctAgent(7, { simulations: 40 });
		const xCommit = agent.act(kernel, state, 0);
		expect(xCommit).toEqual({
			type: "commitPlace",
			player: "X",
			position: { row: 0, col: 2 }
		});
		const afterX = kernel.stepSync(state, xCommit!).nextState;
		const oCommit = agent.act(kernel, afterX, 1);
		expect(oCommit?.type).toBe("commitPlace");
		expect(oCommit).not.toEqual({
			type: "commitPlace",
			player: "O",
			position: { row: 0, col: 2 }
		});
		const revealed = kernel.stepSync(afterX, oCommit!).nextState;
		expect(revealed.status).toBe("won");
		expect(revealed.winner).toBe("X");
	});

	it("mcts takes an immediate winning commit for X", () => {
		const { kernel } = compileConfig(
			examplePresets["hidden-simultaneous-ttt"].config
		);
		let state = kernel.initialState();
		state = {
			...state,
			grid: {
				...state.grid,
				cells: setCell(
					{
						...state.grid,
						cells: setCell(
							{
								...state.grid,
								cells: setCell(state.grid, { row: 0, col: 0 }, "X")
							},
							{ row: 0, col: 1 },
							"X"
						)
					},
					{ row: 1, col: 0 },
					"O"
				)
			},
			moveCount: 3
		};
		const agent = createTinyMctsAgent(5, { rolloutsPerAction: 8 });
		const pick = agent.act(kernel, state, 0);
		expect(pick).toEqual({
			type: "commitPlace",
			player: "X",
			position: { row: 0, col: 2 }
		});
	});

	it("uct completes a short hidden-simultaneous-ttt playout via commits", () => {
		const { kernel } = compileConfig(
			examplePresets["hidden-simultaneous-ttt"].config
		);
		let state = kernel.initialState(11);
		const uct = createUctAgent(11, { simulations: 32, reuseTree: true });
		let guard = 0;
		while (state.status === "playing" && guard < 12) {
			expect(kernel.currentPlayer(state)).toBe("simultaneous");
			const xCommit = uct.act(kernel, state, 0);
			expect(xCommit?.type).toBe("commitPlace");
			state = kernel.stepSync(state, xCommit!).nextState;
			if (state.status !== "playing") break;
			const oCommit = uct.act(kernel, state, 1);
			expect(oCommit?.type).toBe("commitPlace");
			state = kernel.stepSync(state, oCommit!).nextState;
			guard += 1;
		}
		expect(state.status === "won" || state.status === "draw").toBe(true);
	});
});

describe("joint UCT/MCTS under simultaneous deduction (M34)", () => {
	it("enumerates 32 kind-matched joints on simultaneous-guess-who-lite", () => {
		const { kernel } = compileConfig(
			examplePresets["simultaneous-guess-who-lite"].config
		);
		const state = kernel.initialState(42);
		expect(canSearchJointActions(kernel)).toBe(true);
		const joints = enumerateJointLegalActions(kernel, state);
		expect(joints).toHaveLength(32);
		expect(
			joints.filter((a) => a.type === "simultaneousQuery")
		).toHaveLength(16);
		expect(
			joints.filter((a) => a.type === "simultaneousGuess")
		).toHaveLength(16);
	});

	it("enumerates 32 joints on simultaneous-guess-who-and-lite", () => {
		const { kernel } = compileConfig(
			examplePresets["simultaneous-guess-who-and-lite"].config
		);
		const state = kernel.initialState(42);
		expect(canSearchJointActions(kernel)).toBe(true);
		const joints = enumerateJointLegalActions(kernel, state);
		expect(joints).toHaveLength(32);
		expect(
			joints.filter((a) => a.type === "simultaneousQuery")
		).toHaveLength(16);
		expect(
			joints.filter((a) => a.type === "simultaneousGuess")
		).toHaveLength(16);
	});

	it("open joint search stays off under commitReveal deduction", () => {
		const { kernel } = compileConfig(
			examplePresets["hidden-simultaneous-guess-who-lite"].config
		);
		const state = kernel.initialState(42);
		expect(canSearchJointActions(kernel)).toBe(false);
		expect(enumerateJointLegalActions(kernel, state)).toHaveLength(0);
	});

	it("uct dual-act returns consistent query/guess seat components", () => {
		const { kernel } = compileConfig(
			examplePresets["simultaneous-guess-who-lite"].config
		);
		const state = kernel.initialState(7);
		const agent = createUctAgent(7, { simulations: 40 });
		const a0 = agent.act(kernel, state, 0);
		const a1 = agent.act(kernel, state, 1);
		expect(a0).not.toBeNull();
		expect(a1).not.toBeNull();
		expect(a0!.type === "query" || a0!.type === "guess").toBe(true);
		expect(a1!.type).toBe(a0!.type);
		const joint = jointFromSeatPair(a0!, a1!);
		expect(joint).not.toBeNull();
		expect(seatComponentFromJoint(joint!, 0)).toEqual(a0);
		expect(seatComponentFromJoint(joint!, 1)).toEqual(a1);
		expect(jointSeatBudget(joint!)).toBe(1);
		const again0 = agent.act(kernel, state, 0);
		const again1 = agent.act(kernel, state, 1);
		expect(again0).toEqual(a0);
		expect(again1).toEqual(a1);
	});

	it("uct takes an immediate winning joint guess for X", () => {
		const { kernel } = compileConfig(
			examplePresets["simultaneous-guess-who-lite"].config
		);
		const state0 = kernel.initialState(42);
		const secretO = state0.deduction!.secret.O;
		const rosterIds = kernel.config.deduction!.roster.map((c) => c.id);
		const state = {
			...state0,
			deduction: {
				...state0.deduction!,
				eliminated: {
					X: rosterIds.filter((id) => id !== secretO),
					O: [] as string[]
				}
			}
		};
		const agent = createUctAgent(3, { simulations: 24 });
		const a0 = agent.act(kernel, state, 0);
		const a1 = agent.act(kernel, state, 1);
		expect(a0).toEqual({ type: "guess", id: secretO });
		expect(a1?.type).toBe("guess");
		const joint = jointGuessFromActions(a0!, a1!);
		expect(joint?.type).toBe("simultaneousGuess");
		const after = kernel.stepSync(state, joint!).nextState;
		expect(after.status).toBe("won");
		expect(after.winner).toBe("X");
	});

	it("mcts dual-act stays kind-matched on simultaneous-guess-who-lite", () => {
		const { kernel } = compileConfig(
			examplePresets["simultaneous-guess-who-lite"].config
		);
		const state = kernel.initialState(5);
		const agent = createTinyMctsAgent(5, { rolloutsPerAction: 4 });
		const a0 = agent.act(kernel, state, 0);
		const a1 = agent.act(kernel, state, 1);
		expect(a0).not.toBeNull();
		expect(a1).not.toBeNull();
		expect(a0!.type === a1!.type).toBe(true);
		const joint = jointFromSeatPair(a0!, a1!);
		expect(joint).not.toBeNull();
		const again0 = agent.act(kernel, state, 0);
		expect(again0).toEqual(a0);
	});

	it("uct completes a short simultaneous-guess-who-lite playout", () => {
		const { kernel } = compileConfig(
			examplePresets["simultaneous-guess-who-lite"].config
		);
		let state = kernel.initialState(13);
		const uct = createUctAgent(13, { simulations: 36, reuseTree: true });
		let guard = 0;
		while (state.status === "playing" && guard < 16) {
			expect(kernel.currentPlayer(state)).toBe("simultaneous");
			const a0 = uct.act(kernel, state, 0);
			const a1 = uct.act(kernel, state, 1);
			expect(a0).not.toBeNull();
			expect(a1).not.toBeNull();
			expect(a0!.type).toBe(a1!.type);
			const joint = jointFromSeatPair(a0!, a1!);
			expect(joint).not.toBeNull();
			state = kernel.stepSync(state, joint!).nextState;
			guard += 1;
		}
		expect(state.status === "won" || state.status === "draw").toBe(true);
	});
});

describe("joint UCT under simultaneous deduction manual eliminate (M35)", () => {
	it("enumerates 48 kind-matched joints on simultaneous-guess-who-commit-lite", () => {
		const { kernel } = compileConfig(
			examplePresets["simultaneous-guess-who-commit-lite"].config
		);
		const state = kernel.initialState(42);
		expect(canSearchJointActions(kernel)).toBe(true);
		const joints = enumerateJointLegalActions(kernel, state);
		expect(joints).toHaveLength(48);
		expect(
			joints.filter((a) => a.type === "simultaneousEliminate")
		).toHaveLength(16);
	});

	it("uct dual-act returns consistent eliminate seat components", () => {
		const { kernel } = compileConfig(
			examplePresets["simultaneous-guess-who-commit-lite"].config
		);
		const state = kernel.initialState(11);
		const agent = createUctAgent(11, { simulations: 48 });
		const a0 = agent.act(kernel, state, 0);
		const a1 = agent.act(kernel, state, 1);
		expect(a0).not.toBeNull();
		expect(a1).not.toBeNull();
		expect(
			a0!.type === "query" ||
				a0!.type === "guess" ||
				a0!.type === "eliminate"
		).toBe(true);
		expect(a1!.type).toBe(a0!.type);
		const joint = jointFromSeatPair(a0!, a1!);
		expect(joint).not.toBeNull();
		expect(seatComponentFromJoint(joint!, 0)).toEqual(a0);
		expect(seatComponentFromJoint(joint!, 1)).toEqual(a1);
		expect(jointSeatBudget(joint!)).toBe(1);
	});

	it("uct advances several kind-matched rounds on commit-lite", () => {
		const { kernel } = compileConfig(
			examplePresets["simultaneous-guess-who-commit-lite"].config
		);
		let state = kernel.initialState(17);
		const uct = createUctAgent(17, { simulations: 48, reuseTree: true });
		for (let i = 0; i < 6; i++) {
			expect(state.status).toBe("playing");
			expect(kernel.currentPlayer(state)).toBe("simultaneous");
			const a0 = uct.act(kernel, state, 0);
			const a1 = uct.act(kernel, state, 1);
			expect(a0).not.toBeNull();
			expect(a1).not.toBeNull();
			expect(a0!.type).toBe(a1!.type);
			const joint = jointFromSeatPair(a0!, a1!);
			expect(joint).not.toBeNull();
			state = kernel.stepSync(state, joint!).nextState;
		}
		expect(state.moveCount).toBeGreaterThanOrEqual(6);
	});

	it("uct takes an immediate winning joint guess after manual prune", () => {
		const { kernel } = compileConfig(
			examplePresets["simultaneous-guess-who-commit-lite"].config
		);
		const state0 = kernel.initialState(42);
		const secretO = state0.deduction!.secret.O;
		const rosterIds = kernel.config.deduction!.roster.map((c) => c.id);
		const state = {
			...state0,
			deduction: {
				...state0.deduction!,
				eliminated: {
					X: rosterIds.filter((id) => id !== secretO),
					O: [] as string[]
				}
			}
		};
		const agent = createUctAgent(3, { simulations: 24 });
		const a0 = agent.act(kernel, state, 0);
		const a1 = agent.act(kernel, state, 1);
		expect(a0).toEqual({ type: "guess", id: secretO });
		expect(a1?.type).toBe("guess");
		const joint = jointGuessFromActions(a0!, a1!);
		expect(joint?.type).toBe("simultaneousGuess");
		const after = kernel.stepSync(state, joint!).nextState;
		expect(after.status).toBe("won");
		expect(after.winner).toBe("X");
	});
});

describe("joint UCT/MCTS under commitReveal deduction (M36)", () => {
	it("enumerates 32 reveal joints on hidden-simultaneous-guess-who-lite", () => {
		const { kernel } = compileConfig(
			examplePresets["hidden-simultaneous-guess-who-lite"].config
		);
		const state = kernel.initialState(42);
		expect(canSearchJointActions(kernel)).toBe(false);
		expect(canSearchCommitRevealJoint(kernel, state)).toBe(true);
		expect(isFreshCommitRound(state)).toBe(true);
		const joints = enumerateCommitRevealJoints(kernel, state);
		expect(joints).toHaveLength(32);
		expect(
			joints.filter((a) => a.type === "simultaneousQuery")
		).toHaveLength(16);
		expect(
			joints.filter((a) => a.type === "simultaneousGuess")
		).toHaveLength(16);
	});

	it("disables commitReveal deduction joint enum after a partial commit", () => {
		const { kernel } = compileConfig(
			examplePresets["hidden-simultaneous-guess-who-lite"].config
		);
		let state = kernel.initialState(42);
		state = kernel.stepSync(state, {
			type: "commitQuery",
			player: "X",
			query: { type: "query", trait: "glasses", value: true }
		}).nextState;
		expect(isFreshCommitRound(state)).toBe(false);
		expect(canSearchCommitRevealJoint(kernel, state)).toBe(false);
		expect(enumerateCommitRevealJoints(kernel, state)).toHaveLength(0);
	});

	it("uct sequential commits return coordinated plan across seats", () => {
		const { kernel } = compileConfig(
			examplePresets["hidden-simultaneous-guess-who-lite"].config
		);
		const state = kernel.initialState(3);
		const agent = createUctAgent(3, { simulations: 48 });
		const xCommit = agent.act(kernel, state, 0);
		expect(
			xCommit?.type === "commitQuery" || xCommit?.type === "commitGuess"
		).toBe(true);
		if (
			xCommit?.type !== "commitQuery" &&
			xCommit?.type !== "commitGuess"
		) {
			throw new Error("expected deduction commit");
		}
		expect(xCommit.player).toBe("X");

		const afterX = kernel.stepSync(state, xCommit).nextState;
		const oCommit = agent.act(kernel, afterX, 1);
		expect(oCommit?.type).toBe(xCommit.type);
		if (
			oCommit?.type !== "commitQuery" &&
			oCommit?.type !== "commitGuess"
		) {
			throw new Error("expected deduction commit");
		}
		expect(oCommit.player).toBe("O");

		if (xCommit.type === "commitQuery" && oCommit.type === "commitQuery") {
			const joint = {
				type: "simultaneousQuery" as const,
				queries: {
					X: xCommit.query,
					O: oCommit.query
				}
			};
			expect(seatCommitFromJoint(joint, 0)).toEqual(xCommit);
			expect(seatCommitFromJoint(joint, 1)).toEqual(oCommit);
		} else if (
			xCommit.type === "commitGuess" &&
			oCommit.type === "commitGuess"
		) {
			const joint = {
				type: "simultaneousGuess" as const,
				guesses: { X: xCommit.id, O: oCommit.id }
			};
			expect(seatCommitFromJoint(joint, 0)).toEqual(xCommit);
			expect(seatCommitFromJoint(joint, 1)).toEqual(oCommit);
		}

		expect(agent.act(kernel, state, 0)).toEqual(xCommit);
	});

	it("uct takes an immediate winning commitGuess plan for X", () => {
		const { kernel } = compileConfig(
			examplePresets["hidden-simultaneous-guess-who-lite"].config
		);
		const state0 = kernel.initialState(42);
		const secretO = state0.deduction!.secret.O;
		const rosterIds = kernel.config.deduction!.roster.map((c) => c.id);
		const state = {
			...state0,
			deduction: {
				...state0.deduction!,
				eliminated: {
					X: rosterIds.filter((id) => id !== secretO),
					O: [] as string[]
				}
			}
		};
		const agent = createUctAgent(7, { simulations: 40 });
		const xCommit = agent.act(kernel, state, 0);
		expect(xCommit).toEqual({
			type: "commitGuess",
			player: "X",
			id: secretO
		});
		const afterX = kernel.stepSync(state, xCommit!).nextState;
		const oCommit = agent.act(kernel, afterX, 1);
		expect(oCommit?.type).toBe("commitGuess");
		const revealed = kernel.stepSync(afterX, oCommit!).nextState;
		expect(revealed.status).toBe("won");
		expect(revealed.winner).toBe("X");
	});

	it("mcts takes an immediate winning commitGuess for X", () => {
		const { kernel } = compileConfig(
			examplePresets["hidden-simultaneous-guess-who-lite"].config
		);
		const state0 = kernel.initialState(42);
		const secretO = state0.deduction!.secret.O;
		const rosterIds = kernel.config.deduction!.roster.map((c) => c.id);
		const state = {
			...state0,
			deduction: {
				...state0.deduction!,
				eliminated: {
					X: rosterIds.filter((id) => id !== secretO),
					O: [] as string[]
				}
			}
		};
		const agent = createTinyMctsAgent(7, { rolloutsPerAction: 8 });
		const xCommit = agent.act(kernel, state, 0);
		expect(xCommit).toEqual({
			type: "commitGuess",
			player: "X",
			id: secretO
		});
		const afterX = kernel.stepSync(state, xCommit!).nextState;
		const oCommit = agent.act(kernel, afterX, 1);
		expect(oCommit?.type).toBe("commitGuess");
		const revealed = kernel.stepSync(afterX, oCommit!).nextState;
		expect(revealed.status).toBe("won");
		expect(revealed.winner).toBe("X");
	});

	it("uct completes a short hidden-simultaneous-guess-who-lite playout", () => {
		const { kernel } = compileConfig(
			examplePresets["hidden-simultaneous-guess-who-lite"].config
		);
		let state = kernel.initialState(13);
		const uct = createUctAgent(13, { simulations: 36, reuseTree: true });
		let guard = 0;
		while (state.status === "playing" && guard < 16) {
			expect(kernel.currentPlayer(state)).toBe("simultaneous");
			const xCommit = uct.act(kernel, state, 0);
			expect(
				xCommit?.type === "commitQuery" ||
					xCommit?.type === "commitGuess"
			).toBe(true);
			state = kernel.stepSync(state, xCommit!).nextState;
			if (state.status !== "playing") break;
			const oCommit = uct.act(kernel, state, 1);
			expect(oCommit?.type).toBe(xCommit!.type);
			state = kernel.stepSync(state, oCommit!).nextState;
			guard += 1;
		}
		expect(state.status === "won" || state.status === "draw").toBe(true);
	});
});
