import { describe, expect, it } from "vitest";
import { compileConfig } from "@/compiler";
import { createAgent, createGreedyAgent, createRandomAgent } from "@/agents";
import { examplePresets } from "@/presets/registry";
import type { KernelAction } from "@/engine/kernel";

describe("kernel agents (M6)", () => {
	it("random agent only picks from legalActions", () => {
		const { kernel } = compileConfig(examplePresets["tic-tac-toe"].config);
		let state = kernel.initialState(7);
		const agent = createRandomAgent(7);
		for (let i = 0; i < 5; i++) {
			const player = kernel.currentPlayer(state);
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
		expect(createAgent("mcts").kind).toBe("mcts");
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
});
