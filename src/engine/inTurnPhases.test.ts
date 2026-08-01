import { describe, expect, it } from "vitest";
import { compileConfig, compileToGameConfig } from "@/compiler";
import { zConfig } from "@/schemas/config";
import { examplePresets } from "@/presets/registry";
import { getCell } from "@/engine/types";
import { type KernelAction } from "@/engine/kernel";
import { replayActions } from "@/ir/gameIr";
import {
	buildFeatureContracts,
	validateConfig
} from "@/engine/validateConfig";

const placeMoveBase = () => {
	const base = structuredClone(examplePresets["tic-tac-toe"].config);
	return {
		...base,
		grid: { ...base.grid, width: 5, height: 5 },
		win: { ...base.win!, length: 4 },
		turn: {
			mode: "turn" as const,
			schedule: "alternating" as const,
			phases: ["place", "move"] as ("place" | "move")[]
		},
		movement: { adjacency: "orthogonal" as const, range: 1 as const }
	};
};

const shortPlaceMove = () => ({
	...examplePresets["place-move-lite"].config,
	grid: {
		width: 3,
		height: 3,
		topology: "rectangle" as const,
		wrap: false
	},
	win: {
		length: 3,
		adjacency: {
			mode: "linear" as const,
			horizontal: true,
			vertical: true,
			backDiagonal: false,
			forwardDiagonal: false
		}
	}
});

describe("schema: turn.phases in-turn sequence", () => {
	it("accepts place→move on alternating n-in-a-row with movement", () => {
		expect(zConfig.safeParse(placeMoveBase()).success).toBe(true);
	});

	it("rejects phases with actionsPerTurn > 1, gravity, or simultaneous", () => {
		expect(
			zConfig.safeParse({
				...placeMoveBase(),
				turn: {
					mode: "turn",
					schedule: "alternating",
					phases: ["place", "move"],
					actionsPerTurn: 2
				}
			}).success
		).toBe(false);

		expect(
			zConfig.safeParse({
				...placeMoveBase(),
				placement: {
					mode: "gravity",
					gravity: { enabled: true, direction: "down", wrap: false },
					overflow: "reject"
				},
				input: { mode: "column" }
			}).success
		).toBe(false);

		expect(
			zConfig.safeParse({
				...placeMoveBase(),
				turn: {
					mode: "turn",
					schedule: "simultaneous",
					phases: ["place", "move"]
				}
			}).success
		).toBe(false);
	});

	it("rejects phases without movement or with move input mode", () => {
		const noMove = placeMoveBase();
		delete (noMove as { movement?: unknown }).movement;
		expect(zConfig.safeParse(noMove).success).toBe(false);

		expect(
			zConfig.safeParse({
				...placeMoveBase(),
				input: { mode: "move" },
				objective: { mode: "reach_row", targetRows: { X: 0, O: 4 } }
			}).success
		).toBe(false);
	});

	it("validates and compiles the place-move-lite preset", () => {
		const cfg = examplePresets["place-move-lite"].config;
		expect(zConfig.safeParse(cfg).success).toBe(true);
		expect(validateConfig(cfg).ok).toBe(true);
		expect(
			buildFeatureContracts(cfg).some((f) => f.id === "ScheduleInTurnPhases")
		).toBe(true);

		const { gameConfig } = compileToGameConfig(cfg);
		expect(gameConfig.turnPhases).toEqual(["place", "move"]);
	expect(gameConfig.movement).toEqual({
		adjacency: "orthogonal",
		range: 1,
		capture: "none"
	});
		expect(gameConfig.inputMode).toBe("cell");
	});
});

describe("kernel: turn.phases place→move", () => {
	it("seeds turnPhaseIndex; place keeps player and advances to move", () => {
		const { kernel, gameConfig } = compileConfig(
			examplePresets["place-move-lite"].config
		);
		expect(gameConfig.turnPhases).toEqual(["place", "move"]);
		let state = kernel.initialState();
		expect(state.turnPhaseIndex).toBe(0);
		expect(kernel.currentPlayer(state)).toBe(0);

		const placeActs = kernel.legalActions(state, 0);
		expect(placeActs.every((a) => a.type === "place")).toBe(true);
		expect(placeActs.length).toBe(25);

		state = kernel.stepSync(state, {
			type: "place",
			position: { row: 2, col: 2 }
		}).nextState;
		expect(getCell(state.grid, { row: 2, col: 2 })).toBe("X");
		expect(state.currentPlayer).toBe("X");
		expect(state.turnPhaseIndex).toBe(1);
		expect(state.moveCount).toBe(1);

		const moveActs = kernel.legalActions(state, 0);
		expect(moveActs.length).toBeGreaterThan(0);
		expect(moveActs.every((a) => a.type === "move")).toBe(true);

		state = kernel.stepSync(state, {
			type: "move",
			from: { row: 2, col: 2 },
			to: { row: 1, col: 2 }
		}).nextState;
		expect(getCell(state.grid, { row: 2, col: 2 })).toBe(null);
		expect(getCell(state.grid, { row: 1, col: 2 })).toBe("X");
		expect(state.currentPlayer).toBe("O");
		expect(state.turnPhaseIndex).toBe(0);
		expect(state.moveCount).toBe(2);
	});

	it("rejects place during move phase and move during place phase", () => {
		const { kernel } = compileConfig(
			examplePresets["place-move-lite"].config
		);
		let state = kernel.initialState();
		const moveEarly = kernel.explainAction(state, 0, {
			type: "move",
			from: { row: 0, col: 0 },
			to: { row: 0, col: 1 }
		});
		expect(moveEarly.legal).toBe(false);
		if (!moveEarly.legal) expect(moveEarly.reason).toBe("wrong_phase");

		state = kernel.stepSync(state, {
			type: "place",
			position: { row: 2, col: 2 }
		}).nextState;
		const placeWhileMove = kernel.explainAction(state, 0, {
			type: "place",
			position: { row: 0, col: 0 }
		});
		expect(placeWhileMove.legal).toBe(false);
		if (!placeWhileMove.legal) expect(placeWhileMove.reason).toBe("wrong_phase");
	});

	it("wins on place when the placed stone completes n-in-a-row", () => {
		const { kernel } = compileConfig(shortPlaceMove());
		let state = kernel.initialState();
		// Build X at (0,0) and (2,0) via place+move, then place (1,0).
		state = kernel.stepSync(state, {
			type: "place",
			position: { row: 0, col: 0 }
		}).nextState;
		state = kernel.stepSync(state, {
			type: "move",
			from: { row: 0, col: 0 },
			to: { row: 1, col: 0 }
		}).nextState;
		state = kernel.stepSync(state, {
			type: "place",
			position: { row: 0, col: 2 }
		}).nextState;
		state = kernel.stepSync(state, {
			type: "move",
			from: { row: 0, col: 2 },
			to: { row: 1, col: 2 }
		}).nextState;
		state = kernel.stepSync(state, {
			type: "place",
			position: { row: 2, col: 0 }
		}).nextState;
		state = kernel.stepSync(state, {
			type: "move",
			from: { row: 1, col: 0 },
			to: { row: 0, col: 0 }
		}).nextState;
		// X: 0,0 + 2,0; O: 1,2
		state = kernel.stepSync(state, {
			type: "place",
			position: { row: 2, col: 2 }
		}).nextState;
		state = kernel.stepSync(state, {
			type: "move",
			from: { row: 2, col: 2 },
			to: { row: 2, col: 1 }
		}).nextState;
		state = kernel.stepSync(state, {
			type: "place",
			position: { row: 1, col: 0 }
		}).nextState;
		expect(state.status).toBe("won");
		expect(state.winner).toBe("X");
	});

	it("can win specifically on the move sub-step", () => {
		const { kernel } = compileConfig(shortPlaceMove());
		let state = kernel.initialState();
		// X → (1,0); O → (1,2); X → (2,0); O dump; X place (0,1) then move to (0,0)
		state = kernel.stepSync(state, {
			type: "place",
			position: { row: 0, col: 0 }
		}).nextState;
		state = kernel.stepSync(state, {
			type: "move",
			from: { row: 0, col: 0 },
			to: { row: 1, col: 0 }
		}).nextState;
		state = kernel.stepSync(state, {
			type: "place",
			position: { row: 0, col: 2 }
		}).nextState;
		state = kernel.stepSync(state, {
			type: "move",
			from: { row: 0, col: 2 },
			to: { row: 1, col: 2 }
		}).nextState;
		state = kernel.stepSync(state, {
			type: "place",
			position: { row: 2, col: 1 }
		}).nextState;
		state = kernel.stepSync(state, {
			type: "move",
			from: { row: 2, col: 1 },
			to: { row: 2, col: 0 }
		}).nextState;
		state = kernel.stepSync(state, {
			type: "place",
			position: { row: 2, col: 2 }
		}).nextState;
		state = kernel.stepSync(state, {
			type: "move",
			from: { row: 2, col: 2 },
			to: { row: 2, col: 1 }
		}).nextState;
		state = kernel.stepSync(state, {
			type: "place",
			position: { row: 0, col: 1 }
		}).nextState;
		expect(state.status).toBe("playing");
		expect(state.turnPhaseIndex).toBe(1);
		state = kernel.stepSync(state, {
			type: "move",
			from: { row: 0, col: 1 },
			to: { row: 0, col: 0 }
		}).nextState;
		expect(state.status).toBe("won");
		expect(state.winner).toBe("X");
		expect(getCell(state.grid, { row: 0, col: 0 })).toBe("X");
		expect(getCell(state.grid, { row: 1, col: 0 })).toBe("X");
		expect(getCell(state.grid, { row: 2, col: 0 })).toBe("X");
	});

	it("replays a place→move transcript through GameIR", () => {
		const { kernel, gameConfig } = compileConfig(
			examplePresets["place-move-lite"].config
		);
		const actions: KernelAction[] = [
			{ type: "place", position: { row: 2, col: 2 } },
			{ type: "move", from: { row: 2, col: 2 }, to: { row: 2, col: 3 } },
			{ type: "place", position: { row: 0, col: 0 } },
			{ type: "move", from: { row: 0, col: 0 }, to: { row: 0, col: 1 } }
		];
		const replay = replayActions(gameConfig, actions, 0);
		expect(replay.finalState.moveCount).toBe(4);
		expect(replay.finalState.currentPlayer).toBe("X");
		expect(replay.finalState.turnPhaseIndex).toBe(0);
		expect(getCell(replay.finalState.grid, { row: 2, col: 3 })).toBe("X");
		expect(getCell(replay.finalState.grid, { row: 0, col: 1 })).toBe("O");

		let state = kernel.initialState();
		for (const a of actions) {
			state = kernel.stepSync(state, a).nextState;
		}
		expect(state.grid.cells).toEqual(replay.finalState.grid.cells);
	});
});
