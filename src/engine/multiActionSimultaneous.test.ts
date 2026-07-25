import { describe, expect, it } from "vitest";
import { compileConfig, compileToGameConfig } from "@/compiler";
import { zConfig } from "@/schemas/config";
import { examplePresets } from "@/presets/registry";
import { getCell } from "@/engine/types";
import {
	jointPlacesFromActions,
	stepPly,
	type KernelAction
} from "@/engine/kernel";
import { replayActions } from "@/ir/gameIr";
import { validateConfig } from "@/engine/validateConfig";

describe("schema: multi-action simultaneous (actionsPerTurn > 1)", () => {
	it("accepts simultaneous + actionsPerTurn 2 on rectangle", () => {
		const base = examplePresets["tic-tac-toe"].config;
		const ok = zConfig.safeParse({
			...base,
			turn: { mode: "turn", schedule: "simultaneous", actionsPerTurn: 2 }
		});
		expect(ok.success).toBe(true);
	});

	it("accepts simultaneous + actionsPerTurn > 1 on hex and graph", () => {
		const hex = zConfig.safeParse(
			examplePresets["double-place-simultaneous-hex"].config
		);
		expect(hex.success).toBe(true);

		const graph = zConfig.safeParse(
			examplePresets["double-place-simultaneous-graph"].config
		);
		expect(graph.success).toBe(true);
	});

	it("still rejects alternating multi-step on hex", () => {
		const base = examplePresets["hex-connect-lite"].config;
		const bad = zConfig.safeParse({
			...base,
			turn: { mode: "turn", schedule: "alternating", actionsPerTurn: 2 }
		});
		expect(bad.success).toBe(false);
	});

	it("wires ScheduleMultiActionSimultaneous on the preset", () => {
		const result = validateConfig(
			examplePresets["double-place-simultaneous-ttt"].config
		);
		expect(result.ok).toBe(true);
		const { gameConfig } = compileToGameConfig(
			examplePresets["double-place-simultaneous-ttt"].config
		);
		expect(gameConfig.turnSchedule).toBe("simultaneous");
		expect(gameConfig.actionsPerTurn).toBe(2);
	});
});

describe("kernel: multi-action simultaneous rounds", () => {
	it("places four stones in one round (2 per seat)", () => {
		const { kernel } = compileConfig(
			examplePresets["double-place-simultaneous-ttt"].config
		);
		let state = kernel.initialState();
		expect(kernel.currentPlayer(state)).toBe("simultaneous");
		expect(state.actionsRemaining).toBeUndefined();

		const result = kernel.stepSync(state, {
			type: "simultaneousPlace",
			placements: {
				X: [
					{ row: 0, col: 0 },
					{ row: 0, col: 1 }
				],
				O: [
					{ row: 2, col: 0 },
					{ row: 2, col: 1 }
				]
			}
		});
		state = result.nextState;
		expect(getCell(state.grid, { row: 0, col: 0 })).toBe("X");
		expect(getCell(state.grid, { row: 0, col: 1 })).toBe("X");
		expect(getCell(state.grid, { row: 2, col: 0 })).toBe("O");
		expect(getCell(state.grid, { row: 2, col: 1 })).toBe("O");
		expect(state.moveCount).toBe(1);
		expect(state.status).toBe("playing");
	});

	it("same-cell at index 0 under joint places neither there; index 1 still applies", () => {
		const { kernel } = compileConfig(
			examplePresets["double-place-simultaneous-ttt"].config
		);
		let state = kernel.initialState();
		state = kernel.stepSync(state, {
			type: "simultaneousPlace",
			placements: {
				X: [
					{ row: 1, col: 1 },
					{ row: 0, col: 0 }
				],
				O: [
					{ row: 1, col: 1 },
					{ row: 2, col: 2 }
				]
			}
		}).nextState;
		expect(getCell(state.grid, { row: 1, col: 1 })).toBe(null);
		expect(getCell(state.grid, { row: 0, col: 0 })).toBe("X");
		expect(getCell(state.grid, { row: 2, col: 2 })).toBe("O");
		expect(state.moveCount).toBe(1);
	});

	it("mid-round win ends before later sub-steps", () => {
		const { kernel } = compileConfig(
			examplePresets["double-place-simultaneous-ttt"].config
		);
		// Seed a near-win: X has (0,0)(0,1); first pair places X(0,2) winning.
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
			}
		};
		state = kernel.stepSync(state, {
			type: "simultaneousPlace",
			placements: {
				X: [
					{ row: 0, col: 2 },
					{ row: 1, col: 0 }
				],
				O: [
					{ row: 2, col: 0 },
					{ row: 2, col: 1 }
				]
			}
		}).nextState;
		expect(state.status).toBe("won");
		expect(state.winner).toBe("X");
		// Second-index cells must not have been applied after the win.
		expect(getCell(state.grid, { row: 1, col: 0 })).toBe(null);
		expect(getCell(state.grid, { row: 2, col: 1 })).toBe(null);
		expect(getCell(state.grid, { row: 0, col: 2 })).toBe("X");
		expect(getCell(state.grid, { row: 2, col: 0 })).toBe("O");
	});

	it("rejects within-seat duplicates and wrong-length payloads", () => {
		const { kernel } = compileConfig(
			examplePresets["double-place-simultaneous-ttt"].config
		);
		const state = kernel.initialState();
		const dup = kernel.stepSync(state, {
			type: "simultaneousPlace",
			placements: {
				X: [
					{ row: 0, col: 0 },
					{ row: 0, col: 0 }
				],
				O: [
					{ row: 1, col: 0 },
					{ row: 1, col: 1 }
				]
			}
		});
		expect(dup.events[0]?.type).toBe("ignored");

		const short = kernel.stepSync(state, {
			type: "simultaneousPlace",
			placements: {
				X: { row: 0, col: 0 },
				O: { row: 1, col: 0 }
			}
		});
		expect(short.events[0]?.type).toBe("ignored");
	});

	it("jointPlacesFromActions + stepPly collect N per seat", () => {
		const { kernel } = compileConfig(
			examplePresets["double-place-simultaneous-ttt"].config
		);
		const state = kernel.initialState();
		const joint = jointPlacesFromActions(
			[
				{ type: "place", position: { row: 0, col: 0 } },
				{ type: "place", position: { row: 1, col: 0 } }
			],
			[
				{ type: "place", position: { row: 0, col: 2 } },
				{ type: "place", position: { row: 1, col: 2 } }
			]
		);
		expect(joint).not.toBeNull();
		const after = kernel.stepSync(state, joint!).nextState;
		expect(getCell(after.grid, { row: 0, col: 0 })).toBe("X");
		expect(getCell(after.grid, { row: 1, col: 0 })).toBe("X");
		expect(getCell(after.grid, { row: 0, col: 2 })).toBe("O");
		expect(getCell(after.grid, { row: 1, col: 2 })).toBe("O");

		const queues: Record<0 | 1, KernelAction[]> = {
			0: [
				{ type: "place", position: { row: 0, col: 0 } },
				{ type: "place", position: { row: 1, col: 0 } }
			],
			1: [
				{ type: "place", position: { row: 0, col: 2 } },
				{ type: "place", position: { row: 1, col: 2 } }
			]
		};
		const ply = stepPly(kernel, state, (pid, legal) => {
			const next = queues[pid].shift();
			if (!next) return null;
			expect(legal.some((a) => a.type === "place")).toBe(true);
			return next;
		});
		expect(ply).not.toBeNull();
		expect(ply!.nextState.moveCount).toBe(1);
	});

	it("commit-reveal with actionsPerTurn 2 reveals after four commits", () => {
		const base = examplePresets["double-place-simultaneous-ttt"].config;
		const cfg = {
			...base,
			turn: {
				mode: "turn" as const,
				schedule: "simultaneous" as const,
				actionsPerTurn: 2,
				commitReveal: true
			}
		};
		expect(zConfig.safeParse(cfg).success).toBe(true);
		const { kernel } = compileConfig(cfg);
		let state = kernel.initialState();
		state = kernel.stepSync(state, {
			type: "commitPlace",
			player: "X",
			position: { row: 0, col: 0 }
		}).nextState;
		expect(state.moveCount).toBe(0);
		expect(state.committedPlacements?.X).toHaveLength(1);
		expect(kernel.legalActions(state, 0).length).toBeGreaterThan(0);

		state = kernel.stepSync(state, {
			type: "commitPlace",
			player: "X",
			position: { row: 0, col: 1 }
		}).nextState;
		expect(state.committedPlacements?.X).toHaveLength(2);
		expect(kernel.legalActions(state, 0)).toHaveLength(0);

		state = kernel.stepSync(state, {
			type: "commitPlace",
			player: "O",
			position: { row: 2, col: 0 }
		}).nextState;
		expect(state.moveCount).toBe(0);

		state = kernel.stepSync(state, {
			type: "commitPlace",
			player: "O",
			position: { row: 2, col: 1 }
		}).nextState;
		expect(state.moveCount).toBe(1);
		expect(state.committedPlacements).toBeUndefined();
		expect(getCell(state.grid, { row: 0, col: 0 })).toBe("X");
		expect(getCell(state.grid, { row: 0, col: 1 })).toBe("X");
		expect(getCell(state.grid, { row: 2, col: 0 })).toBe("O");
		expect(getCell(state.grid, { row: 2, col: 1 })).toBe("O");
	});

	it("replays multi-action simultaneousPlace faithfully", () => {
		const { gameConfig } = compileToGameConfig(
			examplePresets["double-place-simultaneous-ttt"].config
		);
		const actions: KernelAction[] = [
			{
				type: "simultaneousPlace",
				placements: {
					X: [
						{ row: 0, col: 0 },
						{ row: 1, col: 0 }
					],
					O: [
						{ row: 0, col: 2 },
						{ row: 1, col: 2 }
					]
				}
			}
		];
		const replay = replayActions(gameConfig, actions, 0);
		expect(replay.faithful).toBe(true);
		expect(getCell(replay.finalState.grid, { row: 0, col: 0 })).toBe("X");
		expect(getCell(replay.finalState.grid, { row: 1, col: 2 })).toBe("O");
	});
});

describe("kernel: multi-action simultaneous on hex/graph", () => {
	it("hex: two-per-seat round + hex-line win + mid-round stop", () => {
		const seeded = {
			...examplePresets["double-place-simultaneous-hex"].config,
			initial: [
				{
					row: 0,
					col: 0,
					player: "X" as const,
					visibility: "public" as const
				}
			]
		};
		const { kernel, gameConfig } = compileConfig(seeded);
		expect(gameConfig.topology).toBe("hex_offset");
		expect(gameConfig.actionsPerTurn).toBe(2);
		expect(gameConfig.turnSchedule).toBe("simultaneous");

		let state = kernel.initialState();
		const result = kernel.stepSync(state, {
			type: "simultaneousPlace",
			placements: {
				X: [
					{ row: 0, col: 1 },
					{ row: 0, col: 2 }
				],
				O: [
					{ row: 2, col: 0 },
					{ row: 2, col: 1 }
				]
			}
		});
		state = result.nextState;
		expect(state.status).toBe("won");
		expect(state.winner).toBe("X");
		expect(getCell(state.grid, { row: 0, col: 0 })).toBe("X");
		expect(getCell(state.grid, { row: 0, col: 1 })).toBe("X");
		expect(getCell(state.grid, { row: 0, col: 2 })).toBe("X");
		// Win after index 1 completes the line; O's index-1 cell still applied
		// only if checked after each pair — both of O's first and the win
		// happen within the same round; index 1 places both before win check
		// per sub-step. After index 1 win, later sub-steps must not run:
		// with budget 2, index 1 is last — both O cells applied.
		expect(getCell(state.grid, { row: 2, col: 0 })).toBe("O");
		expect(getCell(state.grid, { row: 2, col: 1 })).toBe("O");

		const actions: KernelAction[] = [
			{
				type: "simultaneousPlace",
				placements: {
					X: [
						{ row: 0, col: 1 },
						{ row: 0, col: 2 }
					],
					O: [
						{ row: 2, col: 0 },
						{ row: 2, col: 1 }
					]
				}
			}
		];
		const config = compileToGameConfig(seeded).gameConfig;
		const replay = replayActions(config, actions, 0);
		expect(replay.faithful).toBe(true);
		expect(replay.finalState.winner).toBe("X");
	});

	it("hex: two rounds without seed — X wins hex line across rounds", () => {
		const { kernel } = compileConfig(
			examplePresets["double-place-simultaneous-hex"].config
		);
		let state = kernel.initialState();
		state = kernel.stepSync(state, {
			type: "simultaneousPlace",
			placements: {
				X: [
					{ row: 0, col: 0 },
					{ row: 0, col: 1 }
				],
				O: [
					{ row: 2, col: 0 },
					{ row: 1, col: 1 }
				]
			}
		}).nextState;
		expect(state.status).toBe("playing");
		expect(state.moveCount).toBe(1);

		state = kernel.stepSync(state, {
			type: "simultaneousPlace",
			placements: {
				X: [
					{ row: 0, col: 2 },
					{ row: 1, col: 0 }
				],
				O: [
					{ row: 2, col: 2 },
					{ row: 1, col: 2 }
				]
			}
		}).nextState;
		expect(state.status).toBe("won");
		expect(state.winner).toBe("X");
		// Mid-round: X wins at index 0; index 1 must not apply
		expect(getCell(state.grid, { row: 0, col: 2 })).toBe("X");
		expect(getCell(state.grid, { row: 1, col: 0 })).toBe(null);
		expect(getCell(state.grid, { row: 1, col: 2 })).toBe(null);
		expect(getCell(state.grid, { row: 2, col: 2 })).toBe("O");
	});

	it("graph: multi-action on active nodes; composite-path win; inactive illegal", () => {
		const seeded = {
			...examplePresets["double-place-simultaneous-graph"].config,
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
		expect(gameConfig.actionsPerTurn).toBe(2);

		let state = kernel.initialState();
		// Inactive embedding cell (1,0) is not a graph node
		const illegal = kernel.stepSync(state, {
			type: "simultaneousPlace",
			placements: {
				X: [
					{ row: 1, col: 0 },
					{ row: 0, col: 2 }
				],
				O: [
					{ row: 2, col: 2 },
					{ row: 1, col: 1 }
				]
			}
		});
		expect(illegal.events[0]?.type).toBe("ignored");

		const result = kernel.stepSync(state, {
			type: "simultaneousPlace",
			placements: {
				X: [
					{ row: 0, col: 2 },
					{ row: 1, col: 1 }
				],
				O: [
					{ row: 2, col: 2 },
					{ row: 1, col: 1 }
				]
			}
		});
		state = result.nextState;
		expect(state.status).toBe("won");
		expect(state.winner).toBe("X");
		expect(getCell(state.grid, { row: 0, col: 0 })).toBe("X");
		expect(getCell(state.grid, { row: 0, col: 1 })).toBe("X");
		expect(getCell(state.grid, { row: 0, col: 2 })).toBe("X");
		// Win after index 0; index 1 must not apply (same-cell would conflict anyway)
		expect(getCell(state.grid, { row: 2, col: 2 })).toBe("O");
		expect(getCell(state.grid, { row: 1, col: 1 })).toBe(null);

		const actions: KernelAction[] = [
			{
				type: "simultaneousPlace",
				placements: {
					X: [
						{ row: 0, col: 2 },
						{ row: 1, col: 1 }
					],
					O: [
						{ row: 2, col: 2 },
						{ row: 1, col: 1 }
					]
				}
			}
		];
		const config = compileToGameConfig(seeded).gameConfig;
		const replay = replayActions(config, actions, 0);
		expect(replay.faithful).toBe(true);
		expect(replay.finalState.winner).toBe("X");
	});
});
