import { describe, expect, it } from "vitest";
import { createInitialState, reduce, type GameConfig } from "@/engine/reducer";
import { getCell } from "@/engine/types";
import { runSeeded } from "@/engine/rng";
import { zConfig } from "@/schemas/config";
import { examplePresets } from "@/presets/registry";

const adjacencyAll = {
	mode: "linear" as const,
	horizontal: true,
	vertical: true,
	backDiagonal: true,
	forwardDiagonal: true
};

function play(
	config: GameConfig,
	events: Parameters<typeof reduce>[1][]
) {
	let state = createInitialState(config);
	for (const event of events) {
		state = reduce(state, event, config);
	}
	return state;
}

describe("schema honesty (M0)", () => {
	it("rejects unsupported knobs", () => {
		const base = examplePresets["tic-tac-toe"].config;
		expect(
			zConfig.safeParse({
				...base,
				turn: { mode: "realtime" }
			}).success
		).toBe(false);
		expect(
			zConfig.safeParse({
				...base,
				grid: { ...base.grid, wrap: true }
			}).success
		).toBe(false);
		expect(
			zConfig.safeParse({
				...base,
				placement: {
					mode: "gravity",
					gravity: { enabled: true, direction: "up", wrap: false },
					overflow: "reject"
				}
			}).success
		).toBe(false);
		expect(
			zConfig.safeParse({
				...examplePresets["connect-4"].config,
				placement: {
					...examplePresets["connect-4"].config.placement,
					overflow: "pop_out_top"
				}
			}).success
		).toBe(false);
	});

	it("accepts all shipped presets", () => {
		for (const preset of Object.values(examplePresets)) {
			const parsed = zConfig.safeParse(preset.config);
			expect(parsed.success, preset.id).toBe(true);
		}
	});
});

describe("transcript: Tic-Tac-Toe win", () => {
	const config: GameConfig = {
		gridWidth: 3,
		gridHeight: 3,
		winLength: 3,
		adjacency: adjacencyAll,
		inputMode: "cell",
		placementMode: "direct"
	};

	it("X wins on top row", () => {
		const state = play(config, [
			{ type: "place", position: { row: 0, col: 0 } },
			{ type: "place", position: { row: 1, col: 0 } },
			{ type: "place", position: { row: 0, col: 1 } },
			{ type: "place", position: { row: 1, col: 1 } },
			{ type: "place", position: { row: 0, col: 2 } }
		]);
		expect(state.status).toBe("won");
		expect(state.winner).toBe("X");
	});
});

describe("transcript: Connect 4 gravity drop", () => {
	const config: GameConfig = {
		gridWidth: 7,
		gridHeight: 6,
		winLength: 4,
		adjacency: adjacencyAll,
		inputMode: "column",
		placementMode: "gravity",
		gravityDirection: "down"
	};

	it("drops to the bottom and stacks", () => {
		let state = createInitialState(config);
		state = reduce(state, { type: "activateColumn", col: 3 }, config);
		expect(getCell(state.grid, { row: 5, col: 3 })).toBe("X");
		state = reduce(state, { type: "activateColumn", col: 3 }, config);
		expect(getCell(state.grid, { row: 4, col: 3 })).toBe("O");
		expect(state.currentPlayer).toBe("X");
	});

	it("vertical four-in-a-column wins", () => {
		const state = play(config, [
			{ type: "activateColumn", col: 0 }, // X
			{ type: "activateColumn", col: 1 }, // O
			{ type: "activateColumn", col: 0 }, // X
			{ type: "activateColumn", col: 1 }, // O
			{ type: "activateColumn", col: 0 }, // X
			{ type: "activateColumn", col: 1 }, // O
			{ type: "activateColumn", col: 0 } // X wins
		]);
		expect(state.status).toBe("won");
		expect(state.winner).toBe("X");
	});
});

describe("transcript: capture flip sequence", () => {
	const config: GameConfig = {
		gridWidth: 8,
		gridHeight: 8,
		winLength: 5,
		adjacency: adjacencyAll,
		inputMode: "cell",
		placementMode: "direct",
		captureEnabled: true,
		initial: [
			{ row: 3, col: 3, player: "O" },
			{ row: 3, col: 4, player: "X" },
			{ row: 4, col: 3, player: "X" },
			{ row: 4, col: 4, player: "O" }
		]
	};

	it("flips a sandwiched opponent disc", () => {
		let state = createInitialState(config);
		// Classic opening: X places at (2,3) and flips (3,3) O → X
		state = reduce(
			state,
			{ type: "place", position: { row: 2, col: 3 } },
			config
		);
		expect(getCell(state.grid, { row: 2, col: 3 })).toBe("X");
		expect(getCell(state.grid, { row: 3, col: 3 })).toBe("X");
		expect(state.currentPlayer).toBe("O");
	});

	it("rejects a place that captures nothing", () => {
		const before = createInitialState(config);
		const after = reduce(
			before,
			{ type: "place", position: { row: 0, col: 0 } },
			config
		);
		expect(after).toEqual(before);
	});
});

describe("Effect RNG foothold", () => {
	it("is deterministic for a seed", () => {
		expect(runSeeded(42, 5)).toEqual(runSeeded(42, 5));
		expect(runSeeded(42, 3)).not.toEqual(runSeeded(99, 3));
	});
});
