import { describe, expect, it } from "vitest";
import { compileConfig } from "@/compiler";
import {
	createAgent,
	createGreedyAgent,
	createHuntAgent,
	createRandomAgent,
	createUctAgent,
	pickHuntFireAction
} from "@/agents";
import { examplePresets } from "@/presets/registry";
import type { KernelAction } from "@/engine/kernel";
import type { CellValue } from "@/engine/types";

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
