import { describe, expect, it } from "vitest";
import { getCell } from "@/engine/types";
import type { GameConfig } from "@/engine/reducer";
import { createGameKernel } from "@/engine/kernel";
import {
	actionsFromEventLog,
	createTranscript,
	parseTranscript,
	replayActions,
	replayTranscript,
	serializeTranscript
} from "@/ir/gameIr";

const adjacencyAll = {
	mode: "linear" as const,
	horizontal: true,
	vertical: true,
	backDiagonal: true,
	forwardDiagonal: true
};

const tttConfig: GameConfig = {
	gridWidth: 3,
	gridHeight: 3,
	winLength: 3,
	adjacency: adjacencyAll,
	inputMode: "cell",
	placementMode: "direct"
};

const c4Config: GameConfig = {
	gridWidth: 7,
	gridHeight: 6,
	winLength: 4,
	adjacency: adjacencyAll,
	inputMode: "column",
	placementMode: "gravity",
	gravityDirection: "down"
};

describe("GameIR transcript round-trip", () => {
	it("serializes and parses actions + seed", () => {
		const transcript = createTranscript(
			[
				{ type: "place", position: { row: 0, col: 0 } },
				{ type: "place", position: { row: 1, col: 1 } }
			],
			42
		);
		const round = parseTranscript(serializeTranscript(transcript));
		expect(round).toEqual(transcript);
	});

	it("rejects unsupported version", () => {
		expect(() =>
			parseTranscript(JSON.stringify({ version: 99, seed: 0, actions: [] }))
		).toThrow(/unsupported version/);
	});
});

describe("GameIR deterministic replay", () => {
	it("seed + TTT actions → same win state twice", () => {
		const actions = [
			{ type: "place" as const, position: { row: 0, col: 0 } },
			{ type: "place" as const, position: { row: 1, col: 0 } },
			{ type: "place" as const, position: { row: 0, col: 1 } },
			{ type: "place" as const, position: { row: 1, col: 1 } },
			{ type: "place" as const, position: { row: 0, col: 2 } }
		];
		const a = replayActions(tttConfig, actions, 7);
		const b = replayActions(tttConfig, actions, 7);
		expect(a.finalState).toEqual(b.finalState);
		expect(a.finalState.status).toBe("won");
		expect(a.finalState.winner).toBe("X");
		expect(a.faithful).toBe(true);
	});

	it("Connect 4 column drops replay to the same cells", () => {
		const actions = [
			{ type: "activateColumn" as const, col: 3 },
			{ type: "activateColumn" as const, col: 3 },
			{ type: "activateColumn" as const, col: 0 }
		];
		const { finalState, faithful } = replayActions(c4Config, actions, 0);
		expect(faithful).toBe(true);
		expect(getCell(finalState.grid, { row: 5, col: 3 })).toBe("X");
		expect(getCell(finalState.grid, { row: 4, col: 3 })).toBe("O");
		expect(getCell(finalState.grid, { row: 5, col: 0 })).toBe("X");
	});

	it("actionsFromEventLog + replay matches live kernel play", () => {
		const kernel = createGameKernel(tttConfig);
		let state = kernel.initialState(1);
		const liveEvents = [];
		const liveActions = [
			{ type: "place" as const, position: { row: 0, col: 0 } },
			{ type: "place" as const, position: { row: 2, col: 2 } },
			{ type: "place" as const, position: { row: 0, col: 1 } }
		];
		for (const action of liveActions) {
			const step = kernel.stepSync(state, action, 1);
			state = step.nextState;
			liveEvents.push(...step.events);
		}
		const transcript = createTranscript(actionsFromEventLog(liveEvents), 1);
		const replayed = replayTranscript(kernel, transcript);
		expect(replayed.finalState).toEqual(state);
		expect(replayed.faithful).toBe(true);
	});

	it("marks unfaithful when an illegal action is in the log", () => {
		const { faithful, events } = replayActions(
			tttConfig,
			[
				{ type: "place", position: { row: 0, col: 0 } },
				{ type: "place", position: { row: 0, col: 0 } } // occupied
			],
			0
		);
		expect(faithful).toBe(false);
		expect(events.some((e) => e.type === "ignored")).toBe(true);
	});
});
