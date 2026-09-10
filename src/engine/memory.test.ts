import { describe, expect, it } from "vitest";
import { compileConfig } from "@/compiler";
import {
	isMemoryMark,
	memoryIndex,
	memoryMark,
	shufflePairDeck
} from "@/engine/memory";
import type { KernelAction } from "@/engine/kernel";
import { createGameKernel } from "@/engine/kernel";
import { createInitialState } from "@/engine/reducer";
import { getCell, toIndex, type Position } from "@/engine/types";
import { examplePresets } from "@/presets/registry";
import { validateConfig } from "@/engine/validateConfig";
import { replayActions } from "@/ir/gameIr";
import { zConfig } from "@/schemas/config";
import { observe } from "@/engine/observation";

describe("memory helpers", () => {
	it("shufflePairDeck is deterministic and balanced", () => {
		const a = shufflePairDeck(4, 4, 8, 42);
		const b = shufflePairDeck(4, 4, 8, 42);
		expect(a).toEqual(b);
		expect(a).toHaveLength(16);
		for (let i = 0; i < 8; i++) {
			expect(a.filter((c) => c === memoryMark(i))).toHaveLength(2);
		}
	});

	it("memoryMark / memoryIndex round-trip", () => {
		expect(isMemoryMark(memoryMark(3))).toBe(true);
		expect(memoryIndex(memoryMark(3))).toBe(3);
		expect(memoryIndex("mine")).toBeNull();
		expect(memoryIndex(2)).toBeNull();
	});
});

describe("Memory Flip Lite (memory_flip)", () => {
	it("validates and compiles the memory-flip-lite preset", () => {
		const cfg = examplePresets["memory-flip-lite"].config;
		expect(validateConfig(cfg).ok).toBe(true);
		const { gameConfig } = compileConfig(cfg);
		expect(gameConfig.observationMode).toBe("memory_flip");
		expect(gameConfig.objectiveMode).toBe("match_pairs");
		expect(gameConfig.inputMode).toBe("flip");
		expect(gameConfig.memory?.pairCount).toBe(8);
		expect(gameConfig.actionsPerTurn).toBe(2);
	});

	it("schema rejects memory_flip without memory / with bad combos", () => {
		const base = {
			...examplePresets["memory-flip-lite"].config,
			memory: undefined
		};
		expect(zConfig.safeParse(base).success).toBe(false);

		const badTurn = {
			...examplePresets["memory-flip-lite"].config,
			turn: { mode: "turn" as const, actionsPerTurn: 1 }
		};
		expect(zConfig.safeParse(badTurn).success).toBe(false);

		const withMovement = {
			...examplePresets["memory-flip-lite"].config,
			movement: { adjacency: "orthogonal" as const, range: 1 }
		};
		expect(zConfig.safeParse(withMovement).success).toBe(false);

		const oddGrid = {
			...examplePresets["memory-flip-lite"].config,
			grid: {
				width: 3,
				height: 3,
				topology: "rectangle" as const,
				wrap: false
			},
			memory: { pairCount: 4, bonusTurnOnMatch: false }
		};
		expect(zConfig.safeParse(oddGrid).success).toBe(false);
	});

	it("init seeds a hidden deck and empty public board", () => {
		const { gameConfig } = compileConfig(
			examplePresets["memory-flip-lite"].config
		);
		const state = createInitialState(gameConfig);
		expect(state.hidden).toBeDefined();
		expect(state.memory?.faceUp).toEqual([]);
		expect(state.memory?.matched.every((m) => !m)).toBe(true);
		expect(state.memory?.scores).toEqual({ X: 0, O: 0 });
		expect(state.grid.cells.every((c) => c === null)).toBe(true);
		expect(state.actionsRemaining).toBe(2);
		const marks = state.hidden!.cells.filter(isMemoryMark);
		expect(marks).toHaveLength(16);
	});

	function findPairPositions(
		hiddenCells: readonly (string | number | null)[],
		width: number
	): { a: Position; b: Position; symbol: string } {
		const first = new Map<string, Position>();
		for (let i = 0; i < hiddenCells.length; i++) {
			const v = hiddenCells[i];
			if (typeof v !== "string" || !v.startsWith("mem:")) continue;
			const pos = { row: Math.floor(i / width), col: i % width };
			const prior = first.get(v);
			if (prior) return { a: prior, b: pos, symbol: v };
			first.set(v, pos);
		}
		throw new Error("no pair found");
	}

	function findMismatch(
		hiddenCells: readonly (string | number | null)[],
		width: number
	): { a: Position; b: Position } {
		const a = { row: 0, col: 0 };
		const symA = hiddenCells[toIndex(a, width)];
		for (let i = 1; i < hiddenCells.length; i++) {
			if (hiddenCells[i] !== symA) {
				return {
					a,
					b: { row: Math.floor(i / width), col: i % width }
				};
			}
		}
		throw new Error("no mismatch found");
	}

	it("single flip reveals a mark and keeps the seat", () => {
		const { gameConfig } = compileConfig(
			examplePresets["memory-flip-lite"].config
		);
		const kernel = createGameKernel(gameConfig);
		let state = createInitialState(gameConfig);
		const pos = { row: 0, col: 0 };
		const step = kernel.stepSync(state, { type: "flip", position: pos });
		expect(step.events.some((e) => e.type === "tilesFlipped")).toBe(true);
		state = step.nextState;
		expect(getCell(state.grid, pos)).toBe(getCell(state.hidden!, pos));
		expect(state.currentPlayer).toBe("X");
		expect(state.actionsRemaining).toBe(1);
		expect(state.memory?.faceUp).toEqual([pos]);
	});

	it("mismatch re-hides and hands off", () => {
		const { gameConfig } = compileConfig(
			examplePresets["memory-flip-lite"].config
		);
		const kernel = createGameKernel(gameConfig);
		let state = createInitialState(gameConfig);
		const { a, b } = findMismatch(state.hidden!.cells, 4);
		state = kernel.stepSync(state, { type: "flip", position: a }).nextState;
		const step = kernel.stepSync(state, { type: "flip", position: b });
		const resolved = step.events.find((e) => e.type === "pairResolved");
		expect(resolved && resolved.type === "pairResolved" && !resolved.matched).toBe(
			true
		);
		state = step.nextState;
		expect(getCell(state.grid, a)).toBeNull();
		expect(getCell(state.grid, b)).toBeNull();
		expect(state.currentPlayer).toBe("O");
		expect(state.actionsRemaining).toBe(2);
		expect(state.memory?.scores).toEqual({ X: 0, O: 0 });
		expect(state.memory?.faceUp).toEqual([]);
	});

	it("match scores and keeps marks visible", () => {
		const { gameConfig } = compileConfig(
			examplePresets["memory-flip-lite"].config
		);
		const kernel = createGameKernel(gameConfig);
		let state = createInitialState(gameConfig);
		const { a, b, symbol } = findPairPositions(state.hidden!.cells, 4);
		state = kernel.stepSync(state, { type: "flip", position: a }).nextState;
		const step = kernel.stepSync(state, { type: "flip", position: b });
		const resolved = step.events.find((e) => e.type === "pairResolved");
		expect(
			resolved &&
				resolved.type === "pairResolved" &&
				resolved.matched &&
				resolved.symbol === symbol &&
				resolved.scorer === "X"
		).toBe(true);
		state = step.nextState;
		expect(getCell(state.grid, a)).toBe(symbol);
		expect(getCell(state.grid, b)).toBe(symbol);
		expect(state.memory?.scores.X).toBe(1);
		expect(state.memory?.matched[toIndex(a, 4)]).toBe(true);
		expect(state.currentPlayer).toBe("O");
	});

	it("illegal flip on matched / face-up cell", () => {
		const { gameConfig } = compileConfig(
			examplePresets["memory-flip-lite"].config
		);
		const kernel = createGameKernel(gameConfig);
		let state = createInitialState(gameConfig);
		const { a, b } = findPairPositions(state.hidden!.cells, 4);
		state = kernel.stepSync(state, { type: "flip", position: a }).nextState;
		state = kernel.stepSync(state, { type: "flip", position: b }).nextState;
		// O's turn — rematch already-matched tile
		const illegal = kernel.stepSync(state, { type: "flip", position: a });
		expect(illegal.events.some((e) => e.type === "ignored")).toBe(true);
	});

	it("observe never leaks face-down symbols", () => {
		const { gameConfig } = compileConfig(
			examplePresets["memory-flip-lite"].config
		);
		const state = createInitialState(gameConfig);
		const view = observe(gameConfig, state, "X");
		expect(view.cells.every((c) => c === null)).toBe(true);
		const hiddenMark = state.hidden!.cells.find(isMemoryMark);
		expect(hiddenMark).toBeDefined();
		expect(view.cells.includes(hiddenMark!)).toBe(false);
	});

	it("replay of flip transcript matches live stepping", () => {
		const { gameConfig } = compileConfig(
			examplePresets["memory-flip-lite"].config
		);
		const kernel = createGameKernel(gameConfig);
		let state = createInitialState(gameConfig);
		const { a, b } = findMismatch(state.hidden!.cells, 4);
		const actions: KernelAction[] = [
			{ type: "flip", position: a },
			{ type: "flip", position: b }
		];
		for (const action of actions) {
			state = kernel.stepSync(state, action).nextState;
		}
		const replayed = replayActions(gameConfig, actions);
		expect(replayed.finalState.grid.cells).toEqual(state.grid.cells);
		expect(replayed.finalState.currentPlayer).toBe(state.currentPlayer);
		expect(replayed.finalState.memory?.scores).toEqual(state.memory?.scores);
		expect(replayed.faithful).toBe(true);
	});

	it("clearing all pairs ends with higher score winning", () => {
		const tiny = zConfig.parse({
			metadata: { name: "Tiny Memory", version: 1 },
			grid: { width: 2, height: 2, topology: "rectangle", wrap: false },
			turn: { mode: "turn", schedule: "alternating", actionsPerTurn: 2 },
			rng: { seed: 1 },
			input: { mode: "flip" },
			placement: { mode: "direct", overflow: "reject" },
			observation: { mode: "memory_flip" },
			memory: { pairCount: 2, bonusTurnOnMatch: false },
			objective: { mode: "match_pairs" },
			tokens: [
				{ id: "pair-0", label: "A", players: ["X", "O"] },
				{ id: "pair-1", label: "B", players: ["X", "O"] }
			],
			placements: [],
			initial: []
		});
		const { gameConfig } = compileConfig(tiny);
		const kernel = createGameKernel(gameConfig);
		let state = createInitialState(gameConfig);

		const claimed = new Set<string>();
		while (state.status === "playing") {
			const pid = state.currentPlayer === "X" ? 0 : 1;
			const flips = kernel
				.legalActions(state, pid)
				.filter((a) => a.type === "flip");
			expect(flips.length).toBeGreaterThan(0);
			// Prefer completing a known pair when one face-up exists
			const faceUp = state.memory?.faceUp ?? [];
			let action = flips[0]!;
			if (faceUp.length === 1 && state.hidden) {
				const need = getCell(state.hidden, faceUp[0]!);
				const match = flips.find((a) => {
					if (a.type !== "flip") return false;
					return getCell(state.hidden!, a.position) === need;
				});
				if (match) action = match;
			} else if (state.hidden) {
				// Pick first of an unclaimed pair
				for (const a of flips) {
					if (a.type !== "flip") continue;
					const key = String(getCell(state.hidden, a.position));
					if (!claimed.has(key)) {
						action = a;
						break;
					}
				}
			}
			if (action.type === "flip" && state.hidden) {
				claimed.add(String(getCell(state.hidden, action.position)));
			}
			state = kernel.stepSync(state, action).nextState;
		}
		expect(state.status === "won" || state.status === "draw").toBe(true);
		expect(state.memory?.matched.every(Boolean)).toBe(true);
		const total =
			(state.memory?.scores.X ?? 0) + (state.memory?.scores.O ?? 0);
		expect(total).toBe(2);
	});
});
