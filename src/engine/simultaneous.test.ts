import { describe, expect, it } from "vitest";
import { compileConfig, compileToGameConfig } from "@/compiler";
import { zConfig } from "@/schemas/config";
import { examplePresets } from "@/presets/registry";
import { getCell } from "@/engine/types";
import {
	jointPlaceFromActions,
	stepPly,
	type KernelAction
} from "@/engine/kernel";
import { replayActions } from "@/ir/gameIr";
import { validateConfig } from "@/engine/validateConfig";

describe("schema: turn.schedule simultaneous", () => {
	it("accepts rectangle n-in-a-row simultaneous and rejects gravity", () => {
		const base = examplePresets["tic-tac-toe"].config;
		const ok = zConfig.safeParse({
			...base,
			turn: { mode: "turn", schedule: "simultaneous" }
		});
		expect(ok.success).toBe(true);

		const bad = zConfig.safeParse({
			...base,
			turn: { mode: "turn", schedule: "simultaneous" },
			placement: {
				mode: "gravity",
				gravity: { enabled: true, direction: "down", wrap: false },
				overflow: "reject"
			},
			input: { mode: "column" }
		});
		expect(bad.success).toBe(false);
	});

	it("accepts hex/graph simultaneous; rejects hit_miss under simultaneous", () => {
		const hex = zConfig.safeParse({
			...examplePresets["hex-connect-lite"].config,
			turn: { mode: "turn", schedule: "simultaneous" }
		});
		expect(hex.success).toBe(true);

		const graph = zConfig.safeParse({
			...examplePresets["graph-connect-lite"].config,
			turn: { mode: "turn", schedule: "simultaneous" }
		});
		expect(graph.success).toBe(true);

		const hit = zConfig.safeParse({
			...examplePresets["battleship-lite"].config,
			turn: { mode: "turn", schedule: "simultaneous" }
		});
		expect(hit.success).toBe(false);
	});
});

describe("kernel: simultaneous joint place", () => {
	it("lists per-player places and currentPlayer is simultaneous", () => {
		const { kernel, gameConfig } = compileConfig(
			examplePresets["simultaneous-ttt"].config
		);
		expect(gameConfig.turnSchedule).toBe("simultaneous");
		const state = kernel.initialState();
		expect(kernel.currentPlayer(state)).toBe("simultaneous");
		expect(kernel.legalActions(state, 0)).toHaveLength(9);
		expect(kernel.legalActions(state, 1)).toHaveLength(9);
	});

	it("places both stones when cells differ", () => {
		const { kernel } = compileConfig(
			examplePresets["simultaneous-ttt"].config
		);
		let state = kernel.initialState();
		const joint: KernelAction = {
			type: "simultaneousPlace",
			placements: {
				X: { row: 0, col: 0 },
				O: { row: 1, col: 1 }
			}
		};
		const result = kernel.stepSync(state, joint);
		expect(result.events[0]?.type).toBe("actionApplied");
		if (result.events[0]?.type === "actionApplied") {
			expect(result.events[0].player).toBe("simultaneous");
		}
		state = result.nextState;
		expect(getCell(state.grid, { row: 0, col: 0 })).toBe("X");
		expect(getCell(state.grid, { row: 1, col: 1 })).toBe("O");
		expect(state.moveCount).toBe(1);
		expect(kernel.currentPlayer(state)).toBe("simultaneous");
	});

	it("same-cell conflict places neither but advances the round", () => {
		const { kernel } = compileConfig(
			examplePresets["simultaneous-ttt"].config
		);
		let state = kernel.initialState();
		const joint: KernelAction = {
			type: "simultaneousPlace",
			placements: {
				X: { row: 1, col: 1 },
				O: { row: 1, col: 1 }
			}
		};
		const result = kernel.stepSync(state, joint);
		expect(result.events.some((e) => e.type === "actionApplied")).toBe(true);
		state = result.nextState;
		expect(getCell(state.grid, { row: 1, col: 1 })).toBe(null);
		expect(state.moveCount).toBe(1);
		expect(state.status).toBe("playing");
	});

	it("single place is ignored under simultaneous schedule", () => {
		const { kernel } = compileConfig(
			examplePresets["simultaneous-ttt"].config
		);
		const state = kernel.initialState();
		const result = kernel.stepSync(state, {
			type: "place",
			position: { row: 0, col: 0 }
		});
		expect(result.events[0]?.type).toBe("ignored");
		expect(result.nextState.moveCount).toBe(0);
	});

	it("stepJoint builds simultaneousPlace from two places", () => {
		const { kernel } = compileConfig(
			examplePresets["simultaneous-ttt"].config
		);
		const state = kernel.initialState();
		const built = jointPlaceFromActions(
			{ type: "place", position: { row: 0, col: 0 } },
			{ type: "place", position: { row: 2, col: 2 } }
		);
		expect(built?.type).toBe("simultaneousPlace");
		const result = kernel.stepJointSync(state, {
			0: { type: "place", position: { row: 0, col: 0 } },
			1: { type: "place", position: { row: 2, col: 2 } }
		});
		expect(getCell(result.nextState.grid, { row: 0, col: 0 })).toBe("X");
		expect(getCell(result.nextState.grid, { row: 2, col: 2 })).toBe("O");
	});

	it("mutual win in one round is a draw", () => {
		// Seed a board where one more X and O each complete a line.
		const seeded = {
			...examplePresets["simultaneous-ttt"].config,
			initial: [
				{ row: 0, col: 0, player: "X" as const, visibility: "public" as const },
				{ row: 0, col: 1, player: "X" as const, visibility: "public" as const },
				{ row: 2, col: 0, player: "O" as const, visibility: "public" as const },
				{ row: 2, col: 1, player: "O" as const, visibility: "public" as const }
			]
		};
		const cfg = compileToGameConfig(seeded).gameConfig;
		const { kernel } = compileConfig(seeded);
		expect(cfg.turnSchedule).toBe("simultaneous");
		const state = kernel.initialState();
		const result = kernel.stepSync(state, {
			type: "simultaneousPlace",
			placements: {
				X: { row: 0, col: 2 },
				O: { row: 2, col: 2 }
			}
		});
		expect(result.nextState.status).toBe("draw");
		expect(result.nextState.winner).toBe(null);
	});

	it("stepPly advances a simultaneous round via picks", () => {
		const { kernel } = compileConfig(
			examplePresets["simultaneous-ttt"].config
		);
		const state = kernel.initialState();
		const result = stepPly(kernel, state, (player) => ({
			type: "place",
			position: player === 0 ? { row: 0, col: 0 } : { row: 0, col: 1 }
		}));
		expect(result).not.toBeNull();
		expect(getCell(result!.nextState.grid, { row: 0, col: 0 })).toBe("X");
		expect(getCell(result!.nextState.grid, { row: 0, col: 1 })).toBe("O");
	});
});

describe("transcript: Simultaneous TTT", () => {
	it("replays joint places to a win", () => {
		const config = compileToGameConfig(
			examplePresets["simultaneous-ttt"].config
		).gameConfig;
		const actions: KernelAction[] = [
			{
				type: "simultaneousPlace",
				placements: {
					X: { row: 0, col: 0 },
					O: { row: 1, col: 0 }
				}
			},
			{
				type: "simultaneousPlace",
				placements: {
					X: { row: 0, col: 1 },
					O: { row: 1, col: 1 }
				}
			},
			{
				type: "simultaneousPlace",
				placements: {
					X: { row: 0, col: 2 },
					O: { row: 2, col: 0 }
				}
			}
		];
		const replay = replayActions(config, actions, 0);
		expect(replay.faithful).toBe(true);
		expect(replay.finalState.status).toBe("won");
		expect(replay.finalState.winner).toBe("X");
	});
});

describe("validateConfig: simultaneous contract", () => {
	it("accepts Simultaneous TTT preset", () => {
		const result = validateConfig(examplePresets["simultaneous-ttt"].config);
		expect(result.ok).toBe(true);
	});

	it("accepts Simultaneous Hex / Graph Connect Lite presets", () => {
		expect(
			validateConfig(examplePresets["simultaneous-hex-connect-lite"].config)
				.ok
		).toBe(true);
		expect(
			validateConfig(
				examplePresets["simultaneous-graph-connect-lite"].config
			).ok
		).toBe(true);
	});
});

describe("kernel: simultaneous on hex/graph topologies", () => {
	it("hex: legal cells, joint place, hex-line win, replay faithful", () => {
		const { kernel, gameConfig } = compileConfig(
			examplePresets["simultaneous-hex-connect-lite"].config
		);
		expect(gameConfig.topology).toBe("hex_offset");
		expect(gameConfig.turnSchedule).toBe("simultaneous");

		let state = kernel.initialState();
		expect(kernel.legalActions(state, 0)).toHaveLength(9);
		expect(kernel.legalActions(state, 1)).toHaveLength(9);

		const rounds: KernelAction[] = [
			{
				type: "simultaneousPlace",
				placements: {
					X: { row: 0, col: 0 },
					O: { row: 1, col: 0 }
				}
			},
			{
				type: "simultaneousPlace",
				placements: {
					X: { row: 0, col: 1 },
					O: { row: 1, col: 1 }
				}
			},
			{
				type: "simultaneousPlace",
				placements: {
					X: { row: 0, col: 2 },
					O: { row: 2, col: 0 }
				}
			}
		];

		for (const action of rounds) {
			const result = kernel.stepSync(state, action);
			expect(result.events[0]?.type).toBe("actionApplied");
			state = result.nextState;
		}

		expect(state.status).toBe("won");
		expect(state.winner).toBe("X");
		expect(getCell(state.grid, { row: 0, col: 0 })).toBe("X");
		expect(getCell(state.grid, { row: 0, col: 1 })).toBe("X");
		expect(getCell(state.grid, { row: 0, col: 2 })).toBe("X");

		const config = compileToGameConfig(
			examplePresets["simultaneous-hex-connect-lite"].config
		).gameConfig;
		const replay = replayActions(config, rounds, 0);
		expect(replay.faithful).toBe(true);
		expect(replay.finalState.status).toBe("won");
		expect(replay.finalState.winner).toBe("X");
	});

	it("graph: active nodes only; composite-path win; inactive illegal", () => {
		const seeded = {
			...examplePresets["simultaneous-graph-connect-lite"].config,
			initial: [
				{
					row: 0,
					col: 0,
					player: "X" as const,
					visibility: "public" as const
				},
				{
					row: 0,
					col: 1,
					player: "X" as const,
					visibility: "public" as const
				},
				{
					row: 2,
					col: 0,
					player: "O" as const,
					visibility: "public" as const
				}
			]
		};
		const { kernel, gameConfig } = compileConfig(seeded);
		expect(gameConfig.topology).toBe("graph");
		expect(gameConfig.turnSchedule).toBe("simultaneous");

		let state = kernel.initialState();
		// 6 nodes − 3 occupied
		expect(kernel.legalActions(state, 0)).toHaveLength(3);
		expect(kernel.legalActions(state, 1)).toHaveLength(3);
		// Inactive embedding cell (1,0) is not a graph node
		expect(
			kernel.legalActions(state, 0).some(
				(a) =>
					a.type === "place" && a.position.row === 1 && a.position.col === 0
			)
		).toBe(false);

		const rounds: KernelAction[] = [
			{
				type: "simultaneousPlace",
				placements: {
					X: { row: 0, col: 2 },
					O: { row: 2, col: 2 }
				}
			}
		];

		const result = kernel.stepSync(state, rounds[0]!);
		expect(result.events[0]?.type).toBe("actionApplied");
		state = result.nextState;

		expect(state.status).toBe("won");
		expect(state.winner).toBe("X");
		// O only has two stones — no composite path of 3
		expect(getCell(state.grid, { row: 2, col: 0 })).toBe("O");
		expect(getCell(state.grid, { row: 2, col: 2 })).toBe("O");

		const config = compileToGameConfig(seeded).gameConfig;
		const replay = replayActions(config, rounds, 0);
		expect(replay.faithful).toBe(true);
		expect(replay.finalState.winner).toBe("X");
	});

	it("same-cell conflict places neither on hex", () => {
		const { kernel } = compileConfig(
			examplePresets["simultaneous-hex-connect-lite"].config
		);
		const state = kernel.initialState();
		const result = kernel.stepSync(state, {
			type: "simultaneousPlace",
			placements: {
				X: { row: 1, col: 1 },
				O: { row: 1, col: 1 }
			}
		});
		expect(getCell(result.nextState.grid, { row: 1, col: 1 })).toBeNull();
		expect(result.nextState.status).toBe("playing");
		expect(result.nextState.moveCount).toBe(1);
	});
});

describe("kernel: ordered simultaneous resolve", () => {
	it("accepts resolveOrder and rejects without simultaneous", () => {
		const ok = zConfig.safeParse(
			examplePresets["ordered-simultaneous-ttt"].config
		);
		expect(ok.success).toBe(true);

		const bad = zConfig.safeParse({
			...examplePresets["tic-tac-toe"].config,
			turn: {
				mode: "turn",
				schedule: "alternating",
				resolveOrder: "x_first"
			}
		});
		expect(bad.success).toBe(false);
	});

	it("normalizes resolveOrder and wires ScheduleOrderedResolve", () => {
		const { gameConfig } = compileConfig(
			examplePresets["ordered-simultaneous-ttt"].config
		);
		expect(gameConfig.resolveOrder).toBe("x_first");
		expect(gameConfig.turnSchedule).toBe("simultaneous");
		const v = validateConfig(examplePresets["ordered-simultaneous-ttt"].config);
		expect(v.ok).toBe(true);
	});

	it("x_first same-cell conflict places X only", () => {
		const { kernel } = compileConfig(
			examplePresets["ordered-simultaneous-ttt"].config
		);
		let state = kernel.initialState();
		const result = kernel.stepSync(state, {
			type: "simultaneousPlace",
			placements: {
				X: { row: 1, col: 1 },
				O: { row: 1, col: 1 }
			}
		});
		state = result.nextState;
		expect(getCell(state.grid, { row: 1, col: 1 })).toBe("X");
		expect(state.moveCount).toBe(1);
		expect(state.status).toBe("playing");
	});

	it("o_first same-cell conflict places O only", () => {
		const cfg = {
			...examplePresets["ordered-simultaneous-ttt"].config,
			turn: {
				mode: "turn" as const,
				schedule: "simultaneous" as const,
				resolveOrder: "o_first" as const
			}
		};
		const { kernel } = compileConfig(cfg);
		const result = kernel.stepSync(kernel.initialState(), {
			type: "simultaneousPlace",
			placements: {
				X: { row: 0, col: 0 },
				O: { row: 0, col: 0 }
			}
		});
		expect(getCell(result.nextState.grid, { row: 0, col: 0 })).toBe("O");
		expect(result.nextState.moveCount).toBe(1);
	});

	it("ordered same-cell can win where joint conflict cannot", () => {
		const seeded = {
			...examplePresets["ordered-simultaneous-ttt"].config,
			initial: [
				{ row: 0, col: 0, player: "X" as const, visibility: "public" as const },
				{ row: 0, col: 1, player: "X" as const, visibility: "public" as const }
			]
		};
		const { kernel: ordered } = compileConfig(seeded);
		const orderedResult = ordered.stepSync(ordered.initialState(), {
			type: "simultaneousPlace",
			placements: {
				X: { row: 0, col: 2 },
				O: { row: 0, col: 2 }
			}
		});
		expect(orderedResult.nextState.status).toBe("won");
		expect(orderedResult.nextState.winner).toBe("X");
		expect(getCell(orderedResult.nextState.grid, { row: 0, col: 2 })).toBe(
			"X"
		);

		const jointCfg = {
			...seeded,
			turn: { mode: "turn" as const, schedule: "simultaneous" as const }
		};
		const { kernel: joint } = compileConfig(jointCfg);
		const jointResult = joint.stepSync(joint.initialState(), {
			type: "simultaneousPlace",
			placements: {
				X: { row: 0, col: 2 },
				O: { row: 0, col: 2 }
			}
		});
		expect(getCell(jointResult.nextState.grid, { row: 0, col: 2 })).toBeNull();
		expect(jointResult.nextState.status).toBe("playing");
	});

	it("places both when cells differ under ordered resolve", () => {
		const { kernel } = compileConfig(
			examplePresets["ordered-simultaneous-ttt"].config
		);
		const result = kernel.stepSync(kernel.initialState(), {
			type: "simultaneousPlace",
			placements: {
				X: { row: 0, col: 0 },
				O: { row: 2, col: 2 }
			}
		});
		expect(getCell(result.nextState.grid, { row: 0, col: 0 })).toBe("X");
		expect(getCell(result.nextState.grid, { row: 2, col: 2 })).toBe("O");
	});

	it("replays ordered simultaneousPlace faithfully", () => {
		const { kernel } = compileConfig(
			examplePresets["ordered-simultaneous-ttt"].config
		);
		const actions: KernelAction[] = [
			{
				type: "simultaneousPlace",
				placements: {
					X: { row: 1, col: 1 },
					O: { row: 1, col: 1 }
				}
			},
			{
				type: "simultaneousPlace",
				placements: {
					X: { row: 0, col: 0 },
					O: { row: 2, col: 2 }
				}
			}
		];
		const live = actions.reduce(
			(s, a) => kernel.stepSync(s, a).nextState,
			kernel.initialState()
		);
		const replayed = replayActions(kernel, actions);
		expect(replayed.grid.cells).toEqual(live.grid.cells);
		expect(getCell(replayed.grid, { row: 1, col: 1 })).toBe("X");
	});
});
