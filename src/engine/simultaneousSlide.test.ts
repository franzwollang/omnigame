import { describe, expect, it } from "vitest";
import { compileConfig } from "@/compiler";
import { zConfig } from "@/schemas/config";
import { examplePresets } from "@/presets/registry";
import { getCell, setCell, type Grid } from "@/engine/types";
import {
	canJointSimultaneousMoves,
	canOrderedSimultaneousMoves
} from "@/engine/movement";
import { type KernelAction } from "@/engine/kernel";
import { replayActions } from "@/ir/gameIr";
import { validateConfig } from "@/engine/validateConfig";

const SLIDE = {
	adjacency: "orthogonal" as const,
	range: 4,
	capture: "none" as const
};

describe("schema: simultaneous × sliding", () => {
	it("accepts simultaneous-slide-race (joint + range > 1)", () => {
		const ok = zConfig.safeParse(
			examplePresets["simultaneous-slide-race"].config
		);
		expect(ok.success).toBe(true);
		const validated = validateConfig(
			examplePresets["simultaneous-slide-race"].config
		);
		expect(validated.ok).toBe(true);
	});

	it("accepts ordered-simultaneous-slide-race (ordered + range > 1)", () => {
		const ok = zConfig.safeParse(
			examplePresets["ordered-simultaneous-slide-race"].config
		);
		expect(ok.success).toBe(true);
		const validated = validateConfig(
			examplePresets["ordered-simultaneous-slide-race"].config
		);
		expect(validated.ok).toBe(true);
	});

	it("still rejects simultaneous + capture replace", () => {
		const base = examplePresets["simultaneous-slide-race"].config;
		const bad = {
			...base,
			movement: { ...base.movement!, capture: "replace" as const }
		};
		expect(zConfig.safeParse(bad).success).toBe(false);
	});
});

describe("canJointSimultaneousMoves vacated-origin paths", () => {
	it("allows a slide through a cell the opponent vacates", () => {
		const { kernel } = compileConfig({
			...examplePresets["simultaneous-slide-race"].config,
			initial: [
				{ row: 4, col: 2, player: "X" as const, visibility: "public" as const },
				{ row: 2, col: 2, player: "O" as const, visibility: "public" as const }
			]
		});
		const state = kernel.initialState();
		const moves = {
			X: { from: { row: 4, col: 2 }, to: { row: 0, col: 2 } },
			O: { from: { row: 2, col: 2 }, to: { row: 2, col: 3 } }
		};
		expect(canJointSimultaneousMoves(state.grid, moves, SLIDE)).toBe(true);
	});

	it("rejects a slide blocked by a non-moving piece", () => {
		const { kernel } = compileConfig({
			...examplePresets["simultaneous-slide-race"].config,
			initial: [
				{ row: 4, col: 2, player: "X" as const, visibility: "public" as const },
				{ row: 0, col: 0, player: "O" as const, visibility: "public" as const }
			]
		});
		const state = kernel.initialState();
		// Extra static O on X's ray — not part of the joint from-pair.
		const blocked: Grid = {
			...state.grid,
			cells: setCell(state.grid, { row: 2, col: 2 }, "O")
		};
		const moves = {
			X: { from: { row: 4, col: 2 }, to: { row: 0, col: 2 } },
			O: { from: { row: 0, col: 0 }, to: { row: 0, col: 1 } }
		};
		expect(canJointSimultaneousMoves(blocked, moves, SLIDE)).toBe(false);
	});
});

describe("canOrderedSimultaneousMoves sequential path revalidation", () => {
	const blockerSetup = {
		...examplePresets["ordered-simultaneous-slide-race"].config,
		initial: [
			{ row: 4, col: 2, player: "X" as const, visibility: "public" as const },
			{ row: 2, col: 2, player: "O" as const, visibility: "public" as const }
		]
	};
	const moves = {
		X: { from: { row: 4, col: 2 }, to: { row: 0, col: 2 } },
		O: { from: { row: 2, col: 2 }, to: { row: 2, col: 3 } }
	};

	it("rejects x_first when X would slide through O before O steps aside", () => {
		const { kernel } = compileConfig(blockerSetup);
		const state = kernel.initialState();
		expect(
			canOrderedSimultaneousMoves(state.grid, moves, SLIDE, "x_first")
		).toBe(false);
		// Joint still allows the same pair via vacated-origin checks.
		expect(canJointSimultaneousMoves(state.grid, moves, SLIDE)).toBe(true);
	});

	it("allows o_first when O vacates the ray before X slides", () => {
		const { kernel } = compileConfig({
			...blockerSetup,
			turn: {
				mode: "turn" as const,
				schedule: "simultaneous" as const,
				resolveOrder: "o_first" as const
			}
		});
		const state = kernel.initialState();
		expect(
			canOrderedSimultaneousMoves(state.grid, moves, SLIDE, "o_first")
		).toBe(true);
	});

	it("allows ordered slides that do not interact", () => {
		const { kernel } = compileConfig(
			examplePresets["ordered-simultaneous-slide-race"].config
		);
		const state = kernel.initialState();
		const independent = {
			X: { from: { row: 4, col: 2 }, to: { row: 1, col: 2 } },
			O: { from: { row: 0, col: 2 }, to: { row: 0, col: 4 } }
		};
		expect(
			canOrderedSimultaneousMoves(state.grid, independent, SLIDE, "x_first")
		).toBe(true);
	});
});

describe("kernel: simultaneous joint sliding", () => {
	it("applies vacated-origin slide when opponent steps aside", () => {
		const seeded = {
			...examplePresets["simultaneous-slide-race"].config,
			initial: [
				{ row: 4, col: 2, player: "X" as const, visibility: "public" as const },
				{ row: 2, col: 2, player: "O" as const, visibility: "public" as const }
			]
		};
		const { kernel } = compileConfig(seeded);
		let state = kernel.initialState();
		const joint: KernelAction = {
			type: "simultaneousMove",
			moves: {
				X: { from: { row: 4, col: 2 }, to: { row: 0, col: 2 } },
				O: { from: { row: 2, col: 2 }, to: { row: 2, col: 4 } }
			}
		};
		expect(kernel.explainAction(state, 0, joint).legal).toBe(true);
		state = kernel.stepSync(state, joint).nextState;
		expect(getCell(state.grid, { row: 0, col: 2 })).toBe("X");
		expect(getCell(state.grid, { row: 2, col: 4 })).toBe("O");
		expect(getCell(state.grid, { row: 4, col: 2 })).toBe(null);
		expect(getCell(state.grid, { row: 2, col: 2 })).toBe(null);
		expect(state.status).toBe("won");
		expect(state.winner).toBe("X");
	});

	it("rejects off-ray joint slide as illegal / noop", () => {
		const seeded = {
			...examplePresets["simultaneous-slide-race"].config,
			initial: [
				{ row: 4, col: 2, player: "X" as const, visibility: "public" as const },
				{ row: 2, col: 2, player: "O" as const, visibility: "public" as const }
			]
		};
		const { kernel } = compileConfig(seeded);
		const state = kernel.initialState();
		const joint: KernelAction = {
			type: "simultaneousMove",
			moves: {
				X: { from: { row: 4, col: 2 }, to: { row: 3, col: 3 } },
				O: { from: { row: 2, col: 2 }, to: { row: 2, col: 3 } }
			}
		};
		expect(kernel.explainAction(state, 0, joint).legal).toBe(false);
		const next = kernel.stepSync(state, joint).nextState;
		expect(getCell(next.grid, { row: 4, col: 2 })).toBe("X");
		expect(getCell(next.grid, { row: 2, col: 2 })).toBe("O");
	});

	it("same-destination conflict moves neither under joint slide", () => {
		const seeded = {
			...examplePresets["simultaneous-slide-race"].config,
			initial: [
				{ row: 4, col: 0, player: "X" as const, visibility: "public" as const },
				{ row: 4, col: 4, player: "O" as const, visibility: "public" as const }
			]
		};
		const { kernel } = compileConfig(seeded);
		let state = kernel.initialState();
		const joint: KernelAction = {
			type: "simultaneousMove",
			moves: {
				X: { from: { row: 4, col: 0 }, to: { row: 4, col: 2 } },
				O: { from: { row: 4, col: 4 }, to: { row: 4, col: 2 } }
			}
		};
		state = kernel.stepSync(state, joint).nextState;
		expect(getCell(state.grid, { row: 4, col: 2 })).toBe(null);
		expect(getCell(state.grid, { row: 4, col: 0 })).toBe("X");
		expect(getCell(state.grid, { row: 4, col: 4 })).toBe("O");
		expect(state.status).toBe("playing");
	});

	it("allows seat swap on vacated origins", () => {
		const seeded = {
			...examplePresets["simultaneous-step-race"].config,
			initial: [
				{ row: 2, col: 1, player: "X" as const, visibility: "public" as const },
				{ row: 2, col: 2, player: "O" as const, visibility: "public" as const }
			]
		};
		const { kernel } = compileConfig(seeded);
		let state = kernel.initialState();
		const joint: KernelAction = {
			type: "simultaneousMove",
			moves: {
				X: { from: { row: 2, col: 1 }, to: { row: 2, col: 2 } },
				O: { from: { row: 2, col: 2 }, to: { row: 2, col: 1 } }
			}
		};
		expect(kernel.explainAction(state, 0, joint).legal).toBe(true);
		state = kernel.stepSync(state, joint).nextState;
		expect(getCell(state.grid, { row: 2, col: 2 })).toBe("X");
		expect(getCell(state.grid, { row: 2, col: 1 })).toBe("O");
	});

	it("replays simultaneous-slide-race transcript", () => {
		const { kernel, gameConfig } = compileConfig(
			examplePresets["simultaneous-slide-race"].config
		);
		const actions: KernelAction[] = [
			{
				type: "simultaneousMove",
				moves: {
					X: { from: { row: 4, col: 2 }, to: { row: 1, col: 2 } },
					O: { from: { row: 0, col: 2 }, to: { row: 3, col: 2 } }
				}
			}
		];
		const live = actions.reduce(
			(s, a) => kernel.stepSync(s, a).nextState,
			kernel.initialState()
		);
		expect(getCell(live.grid, { row: 1, col: 2 })).toBe("X");
		expect(getCell(live.grid, { row: 3, col: 2 })).toBe("O");

		const replayed = replayActions(gameConfig, actions);
		expect(replayed.finalState.grid.cells).toEqual(live.grid.cells);
		expect(replayed.finalState.moveCount).toBe(live.moveCount);
		expect(replayed.faithful).toBe(true);
	});

	it("normalizes simultaneous-slide-race through compiler", () => {
		const { gameConfig } = compileConfig(
			examplePresets["simultaneous-slide-race"].config
		);
		expect(gameConfig.turnSchedule).toBe("simultaneous");
		expect(gameConfig.movement?.range).toBe(4);
		expect(gameConfig.resolveOrder ?? "joint").toBe("joint");
	});
});

describe("kernel: ordered simultaneous sliding", () => {
	it("x_first rejects slide through opponent who has not yet vacated", () => {
		const seeded = {
			...examplePresets["ordered-simultaneous-slide-race"].config,
			initial: [
				{ row: 4, col: 2, player: "X" as const, visibility: "public" as const },
				{ row: 2, col: 2, player: "O" as const, visibility: "public" as const }
			]
		};
		const { kernel } = compileConfig(seeded);
		const state = kernel.initialState();
		const joint: KernelAction = {
			type: "simultaneousMove",
			moves: {
				X: { from: { row: 4, col: 2 }, to: { row: 0, col: 2 } },
				O: { from: { row: 2, col: 2 }, to: { row: 2, col: 4 } }
			}
		};
		expect(kernel.explainAction(state, 0, joint).legal).toBe(false);
		const next = kernel.stepSync(state, joint).nextState;
		expect(getCell(next.grid, { row: 4, col: 2 })).toBe("X");
		expect(getCell(next.grid, { row: 2, col: 2 })).toBe("O");
	});

	it("o_first applies when O vacates then X slides through", () => {
		const seeded = {
			...examplePresets["ordered-simultaneous-slide-race"].config,
			turn: {
				mode: "turn" as const,
				schedule: "simultaneous" as const,
				resolveOrder: "o_first" as const
			},
			initial: [
				{ row: 4, col: 2, player: "X" as const, visibility: "public" as const },
				{ row: 2, col: 2, player: "O" as const, visibility: "public" as const }
			]
		};
		const { kernel } = compileConfig(seeded);
		let state = kernel.initialState();
		const joint: KernelAction = {
			type: "simultaneousMove",
			moves: {
				X: { from: { row: 4, col: 2 }, to: { row: 0, col: 2 } },
				O: { from: { row: 2, col: 2 }, to: { row: 2, col: 4 } }
			}
		};
		expect(kernel.explainAction(state, 0, joint).legal).toBe(true);
		state = kernel.stepSync(state, joint).nextState;
		expect(getCell(state.grid, { row: 0, col: 2 })).toBe("X");
		expect(getCell(state.grid, { row: 2, col: 4 })).toBe("O");
		expect(state.status).toBe("won");
		expect(state.winner).toBe("X");
	});

	it("ordered same-destination: first seat wins the cell", () => {
		const seeded = {
			...examplePresets["ordered-simultaneous-slide-race"].config,
			initial: [
				{ row: 4, col: 0, player: "X" as const, visibility: "public" as const },
				{ row: 4, col: 4, player: "O" as const, visibility: "public" as const }
			]
		};
		const { kernel } = compileConfig(seeded);
		let state = kernel.initialState();
		const joint: KernelAction = {
			type: "simultaneousMove",
			moves: {
				X: { from: { row: 4, col: 0 }, to: { row: 4, col: 2 } },
				O: { from: { row: 4, col: 4 }, to: { row: 4, col: 2 } }
			}
		};
		expect(kernel.explainAction(state, 0, joint).legal).toBe(true);
		state = kernel.stepSync(state, joint).nextState;
		expect(getCell(state.grid, { row: 4, col: 2 })).toBe("X");
		expect(getCell(state.grid, { row: 4, col: 0 })).toBe(null);
		expect(getCell(state.grid, { row: 4, col: 4 })).toBe("O");
	});

	it("replays ordered-simultaneous-slide-race transcript", () => {
		const { kernel, gameConfig } = compileConfig(
			examplePresets["ordered-simultaneous-slide-race"].config
		);
		const actions: KernelAction[] = [
			{
				type: "simultaneousMove",
				moves: {
					X: { from: { row: 4, col: 2 }, to: { row: 1, col: 2 } },
					O: { from: { row: 0, col: 2 }, to: { row: 0, col: 4 } }
				}
			}
		];
		const live = actions.reduce(
			(s, a) => kernel.stepSync(s, a).nextState,
			kernel.initialState()
		);
		expect(getCell(live.grid, { row: 1, col: 2 })).toBe("X");
		expect(getCell(live.grid, { row: 0, col: 4 })).toBe("O");

		const replayed = replayActions(gameConfig, actions);
		expect(replayed.finalState.grid.cells).toEqual(live.grid.cells);
		expect(replayed.finalState.moveCount).toBe(live.moveCount);
		expect(replayed.faithful).toBe(true);
	});

	it("normalizes ordered-simultaneous-slide-race through compiler", () => {
		const { gameConfig } = compileConfig(
			examplePresets["ordered-simultaneous-slide-race"].config
		);
		expect(gameConfig.turnSchedule).toBe("simultaneous");
		expect(gameConfig.movement?.range).toBe(4);
		expect(gameConfig.resolveOrder).toBe("x_first");
	});
});
