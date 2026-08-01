import { describe, expect, it } from "vitest";
import { compileConfig, compileToGameConfig } from "@/compiler";
import { zConfig } from "@/schemas/config";
import { examplePresets } from "@/presets/registry";
import { getCell } from "@/engine/types";
import { stepPly, type KernelAction } from "@/engine/kernel";
import { replayActions } from "@/ir/gameIr";
import { validateConfig } from "@/engine/validateConfig";

describe("schema: turn.actionsPerTurn multi-step", () => {
	it("accepts alternating n-in-a-row with actionsPerTurn 2", () => {
		const base = examplePresets["tic-tac-toe"].config;
		const ok = zConfig.safeParse({
			...base,
			turn: { mode: "turn", schedule: "alternating", actionsPerTurn: 2 }
		});
		expect(ok.success).toBe(true);
	});

	it("rejects actionsPerTurn > 1 with gravity; accepts with simultaneous", () => {
		const base = examplePresets["tic-tac-toe"].config;
		const withSim = zConfig.safeParse({
			...base,
			turn: { mode: "turn", schedule: "simultaneous", actionsPerTurn: 2 }
		});
		expect(withSim.success).toBe(true);

		const withGravity = zConfig.safeParse({
			...base,
			turn: { mode: "turn", schedule: "alternating", actionsPerTurn: 2 },
			placement: {
				mode: "gravity",
				gravity: { enabled: true, direction: "down", wrap: false },
				overflow: "reject"
			},
			input: { mode: "column" }
		});
		expect(withGravity.success).toBe(false);
	});

	it("accepts alternating multi-step on hex and graph", () => {
		const hex = zConfig.safeParse(examplePresets["double-move-hex"].config);
		expect(hex.success).toBe(true);

		const graph = zConfig.safeParse(
			examplePresets["double-move-graph"].config
		);
		expect(graph.success).toBe(true);
	});

	it("rejects hit_miss under multi-step", () => {
		const hit = zConfig.safeParse({
			...examplePresets["battleship-lite"].config,
			turn: { mode: "turn", schedule: "alternating", actionsPerTurn: 2 }
		});
		expect(hit.success).toBe(false);
	});
});

describe("kernel: multi-step actionsPerTurn", () => {
	it("seeds actionsRemaining and keeps player after first place", () => {
		const { kernel, gameConfig } = compileConfig(
			examplePresets["double-move-ttt"].config
		);
		expect(gameConfig.actionsPerTurn).toBe(2);
		let state = kernel.initialState();
		expect(state.actionsRemaining).toBe(2);
		expect(kernel.currentPlayer(state)).toBe(0);

		const first = kernel.stepSync(state, {
			type: "place",
			position: { row: 0, col: 0 }
		});
		expect(first.events[0]?.type).toBe("actionApplied");
		state = first.nextState;
		expect(getCell(state.grid, { row: 0, col: 0 })).toBe("X");
		expect(state.currentPlayer).toBe("X");
		expect(state.actionsRemaining).toBe(1);
		expect(state.moveCount).toBe(1);
	});

	it("hands off after second place and resets budget", () => {
		const { kernel } = compileConfig(
			examplePresets["double-move-ttt"].config
		);
		let state = kernel.initialState();
		state = kernel.stepSync(state, {
			type: "place",
			position: { row: 0, col: 0 }
		}).nextState;
		state = kernel.stepSync(state, {
			type: "place",
			position: { row: 0, col: 1 }
		}).nextState;
		expect(getCell(state.grid, { row: 0, col: 1 })).toBe("X");
		expect(state.currentPlayer).toBe("O");
		expect(state.actionsRemaining).toBe(2);
		expect(state.moveCount).toBe(2);
	});

	it("wins mid-turn without requiring the second action", () => {
		const seeded = {
			...examplePresets["double-move-ttt"].config,
			initial: [
				{ row: 0, col: 0, player: "X" as const, visibility: "public" as const },
				{ row: 0, col: 1, player: "X" as const, visibility: "public" as const },
				{ row: 1, col: 0, player: "O" as const, visibility: "public" as const }
			]
		};
		const { kernel } = compileConfig(seeded);
		let state = kernel.initialState();
		// X's first action of the turn completes the line
		const result = kernel.stepSync(state, {
			type: "place",
			position: { row: 0, col: 2 }
		});
		state = result.nextState;
		expect(state.status).toBe("won");
		expect(state.winner).toBe("X");
		expect(state.moveCount).toBe(1);
	});

	it("illegal place leaves budget unchanged", () => {
		const { kernel } = compileConfig(
			examplePresets["double-move-ttt"].config
		);
		let state = kernel.initialState();
		state = kernel.stepSync(state, {
			type: "place",
			position: { row: 1, col: 1 }
		}).nextState;
		expect(state.actionsRemaining).toBe(1);
		const ignored = kernel.stepSync(state, {
			type: "place",
			position: { row: 1, col: 1 }
		});
		expect(ignored.events[0]?.type).toBe("ignored");
		expect(ignored.nextState.actionsRemaining).toBe(1);
		expect(ignored.nextState.currentPlayer).toBe("X");
		expect(ignored.nextState.moveCount).toBe(1);
	});

	it("stepPly keeps the same player for two plies then flips", () => {
		const { kernel } = compileConfig(
			examplePresets["double-move-ttt"].config
		);
		let state = kernel.initialState();
		const r1 = stepPly(kernel, state, () => ({
			type: "place",
			position: { row: 0, col: 0 }
		}));
		expect(r1).not.toBeNull();
		state = r1!.nextState;
		expect(state.currentPlayer).toBe("X");

		const r2 = stepPly(kernel, state, () => ({
			type: "place",
			position: { row: 1, col: 0 }
		}));
		expect(r2).not.toBeNull();
		state = r2!.nextState;
		expect(state.currentPlayer).toBe("O");
		expect(state.actionsRemaining).toBe(2);
	});
});

describe("transcript: Double Move TTT", () => {
	it("replays places with mid-turn handoff to a win", () => {
		const config = compileToGameConfig(
			examplePresets["double-move-ttt"].config
		).gameConfig;
		// X places (0,0)+(0,1); O places (1,0)+(1,1); X places (0,2) wins mid-turn
		const actions: KernelAction[] = [
			{ type: "place", position: { row: 0, col: 0 } },
			{ type: "place", position: { row: 0, col: 1 } },
			{ type: "place", position: { row: 1, col: 0 } },
			{ type: "place", position: { row: 1, col: 1 } },
			{ type: "place", position: { row: 0, col: 2 } }
		];
		const replay = replayActions(config, actions, 0);
		expect(replay.faithful).toBe(true);
		expect(replay.finalState.status).toBe("won");
		expect(replay.finalState.winner).toBe("X");
		expect(replay.finalState.moveCount).toBe(5);
	});
});

describe("validateConfig: multi-step contract", () => {
	it("accepts Double Move TTT / Hex / Graph presets", () => {
		expect(validateConfig(examplePresets["double-move-ttt"].config).ok).toBe(
			true
		);
		expect(validateConfig(examplePresets["double-move-hex"].config).ok).toBe(
			true
		);
		expect(
			validateConfig(examplePresets["double-move-graph"].config).ok
		).toBe(true);
	});
});

describe("kernel: multi-step on hex/graph", () => {
	it("hex: budget handoff + hex-line win mid-turn", () => {
		const { kernel, gameConfig } = compileConfig(
			examplePresets["double-move-hex"].config
		);
		expect(gameConfig.topology).toBe("hex_offset");
		expect(gameConfig.actionsPerTurn).toBe(2);

		let state = kernel.initialState();
		expect(state.actionsRemaining).toBe(2);
		expect(kernel.currentPlayer(state)).toBe(0);

		state = kernel.stepSync(state, {
			type: "place",
			position: { row: 0, col: 0 }
		}).nextState;
		expect(state.currentPlayer).toBe("X");
		expect(state.actionsRemaining).toBe(1);

		state = kernel.stepSync(state, {
			type: "place",
			position: { row: 0, col: 1 }
		}).nextState;
		expect(state.currentPlayer).toBe("O");
		expect(state.actionsRemaining).toBe(2);

		state = kernel.stepSync(state, {
			type: "place",
			position: { row: 2, col: 0 }
		}).nextState;
		state = kernel.stepSync(state, {
			type: "place",
			position: { row: 1, col: 1 }
		}).nextState;
		expect(state.currentPlayer).toBe("X");

		const win = kernel.stepSync(state, {
			type: "place",
			position: { row: 0, col: 2 }
		});
		state = win.nextState;
		expect(state.status).toBe("won");
		expect(state.winner).toBe("X");
		expect(getCell(state.grid, { row: 0, col: 0 })).toBe("X");
		expect(getCell(state.grid, { row: 0, col: 1 })).toBe("X");
		expect(getCell(state.grid, { row: 0, col: 2 })).toBe("X");
	});

	it("graph: multi-step on active nodes; inactive illegal; composite win", () => {
		const { kernel, gameConfig } = compileConfig(
			examplePresets["double-move-graph"].config
		);
		expect(gameConfig.topology).toBe("graph");
		expect(gameConfig.actionsPerTurn).toBe(2);

		let state = kernel.initialState();
		const inactive = kernel.stepSync(state, {
			type: "place",
			position: { row: 1, col: 0 }
		});
		expect(inactive.events[0]?.type).toBe("ignored");
		expect(inactive.nextState.actionsRemaining).toBe(2);

		// Path 0,0 — 0,1 — 0,2 is a composite line of length 3
		state = kernel.stepSync(state, {
			type: "place",
			position: { row: 0, col: 0 }
		}).nextState;
		expect(state.actionsRemaining).toBe(1);
		state = kernel.stepSync(state, {
			type: "place",
			position: { row: 0, col: 1 }
		}).nextState;
		expect(state.currentPlayer).toBe("O");

		state = kernel.stepSync(state, {
			type: "place",
			position: { row: 2, col: 0 }
		}).nextState;
		state = kernel.stepSync(state, {
			type: "place",
			position: { row: 2, col: 2 }
		}).nextState;
		expect(state.currentPlayer).toBe("X");

		const win = kernel.stepSync(state, {
			type: "place",
			position: { row: 0, col: 2 }
		});
		state = win.nextState;
		expect(state.status).toBe("won");
		expect(state.winner).toBe("X");
		expect(state.moveCount).toBe(5);
	});
});

describe("transcript: Double Move Hex / Graph", () => {
	it("replays hex multi-step to a row win", () => {
		const config = compileToGameConfig(
			examplePresets["double-move-hex"].config
		).gameConfig;
		const actions: KernelAction[] = [
			{ type: "place", position: { row: 0, col: 0 } },
			{ type: "place", position: { row: 0, col: 1 } },
			{ type: "place", position: { row: 2, col: 0 } },
			{ type: "place", position: { row: 1, col: 1 } },
			{ type: "place", position: { row: 0, col: 2 } }
		];
		const replay = replayActions(config, actions, 0);
		expect(replay.faithful).toBe(true);
		expect(replay.finalState.status).toBe("won");
		expect(replay.finalState.winner).toBe("X");
	});

	it("replays graph multi-step composite-path win", () => {
		const config = compileToGameConfig(
			examplePresets["double-move-graph"].config
		).gameConfig;
		const actions: KernelAction[] = [
			{ type: "place", position: { row: 0, col: 0 } },
			{ type: "place", position: { row: 0, col: 1 } },
			{ type: "place", position: { row: 2, col: 0 } },
			{ type: "place", position: { row: 2, col: 2 } },
			{ type: "place", position: { row: 0, col: 2 } }
		];
		const replay = replayActions(config, actions, 0);
		expect(replay.faithful).toBe(true);
		expect(replay.finalState.status).toBe("won");
		expect(replay.finalState.winner).toBe("X");
	});
});
