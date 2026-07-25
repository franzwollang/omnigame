import { describe, expect, it } from "vitest";
import { Effect } from "effect";
import {
	createInitialState,
	reduce,
	type GameConfig
} from "@/engine/reducer";
import { getCell } from "@/engine/types";
import { Rng, runWithSeed, seededSequence } from "@/engine/rng";
import { examplePresets } from "@/presets/registry";
import { zConfig } from "@/schemas/config";

const adjacencyAll = {
	mode: "linear" as const,
	horizontal: true,
	vertical: true,
	backDiagonal: true,
	forwardDiagonal: true
};

function tttConfig(): GameConfig {
	return {
		gridWidth: 3,
		gridHeight: 3,
		winLength: 3,
		adjacency: adjacencyAll,
		inputMode: "cell",
		placementMode: "direct"
	};
}

function connect4Config(): GameConfig {
	return {
		gridWidth: 7,
		gridHeight: 6,
		winLength: 4,
		adjacency: adjacencyAll,
		inputMode: "column",
		placementMode: "gravity",
		gravityDirection: "down"
	};
}

function captureConfig(): GameConfig {
	return {
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
}

describe("schema honesty", () => {
	it("accepts all built-in presets", () => {
		for (const preset of Object.values(examplePresets)) {
			const parsed = zConfig.safeParse(preset.config);
			expect(parsed.success, preset.id).toBe(true);
		}
	});

	it("rejects deferred knobs (wrap, realtime, non-down gravity, pop_out_top)", () => {
		const base = examplePresets["tic-tac-toe"].config;
		expect(
			zConfig.safeParse({
				...base,
				grid: { ...base.grid, wrap: true }
			}).success
		).toBe(false);
		expect(
			zConfig.safeParse({
				...base,
				turn: { mode: "realtime" }
			}).success
		).toBe(false);
		expect(
			zConfig.safeParse({
				...examplePresets["connect-4"].config,
				placement: {
					...examplePresets["connect-4"].config.placement,
					gravity: {
						enabled: true,
						direction: "up",
						wrap: false
					}
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
});

describe("transcript: Tic-Tac-Toe win", () => {
	it("X wins on top row", () => {
		const config = tttConfig();
		let state = createInitialState(config);
		const moves = [
			{ row: 0, col: 0 }, // X
			{ row: 1, col: 0 }, // O
			{ row: 0, col: 1 }, // X
			{ row: 1, col: 1 }, // O
			{ row: 0, col: 2 } // X wins
		];
		for (const position of moves) {
			state = reduce(state, { type: "place", position }, config);
		}
		expect(state.status).toBe("won");
		expect(state.winner).toBe("X");
		expect(getCell(state.grid, { row: 0, col: 0 })).toBe("X");
		expect(getCell(state.grid, { row: 0, col: 1 })).toBe("X");
		expect(getCell(state.grid, { row: 0, col: 2 })).toBe("X");
	});
});

describe("transcript: Connect 4 gravity", () => {
	it("drops to the bottom of an empty column then stacks", () => {
		const config = connect4Config();
		let state = createInitialState(config);
		state = reduce(state, { type: "activateColumn", col: 3 }, config);
		expect(getCell(state.grid, { row: 5, col: 3 })).toBe("X");
		expect(state.currentPlayer).toBe("O");
		state = reduce(state, { type: "activateColumn", col: 3 }, config);
		expect(getCell(state.grid, { row: 4, col: 3 })).toBe("O");
		expect(getCell(state.grid, { row: 5, col: 3 })).toBe("X");
	});

	it("X wins with four in a horizontal row via gravity", () => {
		const config = connect4Config();
		let state = createInitialState(config);
		// X: cols 0,1,2,3 at bottom; O: cols 0,1,2 stacked above to alternate
		const cols = [0, 0, 1, 1, 2, 2, 3];
		for (const col of cols) {
			state = reduce(state, { type: "activateColumn", col }, config);
		}
		expect(state.status).toBe("won");
		expect(state.winner).toBe("X");
	});
});

describe("transcript: capture flip", () => {
	it("flips a sandwiched opponent disc", () => {
		const config = captureConfig();
		let state = createInitialState(config);
		// Opening: O at (3,3), X at (3,4), X at (4,3), O at (4,4)
		// X places at (2,4) — vertical sandwich of O? Wait: (3,4)=X already.
		// Classic: X places at (2,3) to flip O at (3,3) using X at (4,3).
		state = reduce(
			state,
			{ type: "place", position: { row: 2, col: 3 } },
			config
		);
		expect(getCell(state.grid, { row: 2, col: 3 })).toBe("X");
		expect(getCell(state.grid, { row: 3, col: 3 })).toBe("X"); // flipped
		expect(getCell(state.grid, { row: 4, col: 3 })).toBe("X");
		expect(state.currentPlayer).toBe("O");
	});
});

describe("Effect RNG foothold", () => {
	it("seededSequence is deterministic", () => {
		expect(seededSequence(42, 5)).toEqual(seededSequence(42, 5));
		expect(seededSequence(42, 3)).not.toEqual(seededSequence(99, 3));
	});

	it("runWithSeed provides Effect Rng service", () => {
		const program = Effect.gen(function* () {
			const rng = yield* Rng;
			const x = yield* rng.next;
			const y = yield* rng.nextInt(10);
			return [x, y] as const;
		});
		const a = runWithSeed(7, program);
		const b = runWithSeed(7, program);
		expect(a).toEqual(b);
		expect(a[0]).toBeGreaterThanOrEqual(0);
		expect(a[0]).toBeLessThan(1);
		expect(a[1]).toBeGreaterThanOrEqual(0);
		expect(a[1]).toBeLessThan(10);
	});
});
