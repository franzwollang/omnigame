import { describe, expect, it } from "vitest";
import { compileConfig } from "@/compiler";
import {
	applyLibertyCapture,
	boardPositionHash,
	countLiberties,
	countTrueEyes,
	enumerateGroups,
	findBensonAliveGroupIds,
	findBensonDeadStoneCells,
	findDameCells,
	findDeadStoneCells,
	findGroup,
	findLadderDeadCells,
	findNakadeDeadCells,
	findLNakadeDeadCells,
	findSquareNakadeDeadCells,
	findPyramidNakadeDeadCells,
	findTwistedNakadeDeadCells,
	findL4NakadeDeadCells,
	findStraight4NakadeDeadCells,
	findBulky5NakadeDeadCells,
	findPlusNakadeDeadCells,
	findNetDeadCells,
	findLooseNetDeadCells,
	findSenteLadderDeadCells,
	findApproachNetDeadCells,
	findSemeaiDeadCells,
	isLadderDeadGroup,
	isNakadeVulnerableRegion,
	isLNakadeVulnerableRegion,
	isSquareNakadeVulnerableRegion,
	isPyramidNakadeVulnerableRegion,
	isTwistedNakadeVulnerableRegion,
	isL4NakadeVulnerableRegion,
	isStraight4NakadeVulnerableRegion,
	isBulky5NakadeVulnerableRegion,
	isPlusNakadeVulnerableRegion,
	isNetDeadGroup,
	isLooseNetDeadGroup,
	isSenteLadderDeadGroup,
	isApproachNetDeadGroup,
	isLegalLibertyPlace,
	orthogonalNeighbors,
	removeBensonDeadStones,
	removeDeadStones,
	removeLadderDeadStones,
	removeNakadeDeadStones,
	removeLNakadeDeadStones,
	removeSquareNakadeDeadStones,
	removePyramidNakadeDeadStones,
	removeTwistedNakadeDeadStones,
	removeL4NakadeDeadStones,
	removeStraight4NakadeDeadStones,
	removeBulky5NakadeDeadStones,
	removePlusNakadeDeadStones,
	removeNetDeadStones,
	removeLooseNetDeadStones,
	removeSenteLadderDeadStones,
	removeApproachNetDeadStones,
	removeSemeaiDeadStones,
	removeMarkedDeadStones,
	scoreArea,
	scoreTerritory,
	areaOutcome,
	findSekiNeutralCells,
	simulateLibertyPlace,
	situationHash
} from "@/engine/liberties";
import { createInitialState, type GameConfig } from "@/engine/reducer";
import { getCell, setCell, type Grid } from "@/engine/types";
import { playerIdOf, type KernelAction } from "@/engine/kernel";
import { examplePresets } from "@/presets/registry";
import { validateConfig } from "@/engine/validateConfig";
import { replayActions } from "@/ir/gameIr";
import { buildGraphTopologyData } from "@/engine/topology";

function gridOf(width: number, height: number, cells: (string | null)[]): Grid {
	return {
		width,
		height,
		cells: cells.map((c) => (c === "X" || c === "O" ? c : null))
	};
}

describe("liberties helpers", () => {
	it("lists orthogonal neighbors only", () => {
		const g = gridOf(3, 3, Array(9).fill(null));
		expect(orthogonalNeighbors(g, { row: 1, col: 1 })).toHaveLength(4);
		expect(orthogonalNeighbors(g, { row: 0, col: 0 })).toEqual([
			{ row: 1, col: 0 },
			{ row: 0, col: 1 }
		]);
	});

	it("counts liberties for a single stone", () => {
		let cells = Array(9).fill(null);
		const base = gridOf(3, 3, cells);
		cells = setCell(base, { row: 1, col: 1 }, "X");
		const g = { ...base, cells };
		const group = findGroup(g, { row: 1, col: 1 });
		expect(group).toHaveLength(1);
		expect(countLiberties(g, group)).toBe(4);
	});

	it("captures a surrounded single stone", () => {
		// O at center, X on three sides; place X on fourth → capture O
		const cells = Array(9).fill(null);
		let g = gridOf(3, 3, cells);
		g = { ...g, cells: setCell(g, { row: 1, col: 1 }, "O") };
		g = { ...g, cells: setCell(g, { row: 0, col: 1 }, "X") };
		g = { ...g, cells: setCell(g, { row: 1, col: 0 }, "X") };
		g = { ...g, cells: setCell(g, { row: 1, col: 2 }, "X") };
		const placed = { row: 2, col: 1 };
		expect(isLegalLibertyPlace(g, placed, "X")).toBe(true);
		const afterPlace = setCell(g, placed, "X");
		const after = applyLibertyCapture({ ...g, cells: afterPlace }, placed, "X");
		expect(getCell({ ...g, cells: after.cells }, { row: 1, col: 1 })).toBe(null);
		expect(getCell({ ...g, cells: after.cells }, placed)).toBe("X");
		expect(after.removed).toEqual([{ row: 1, col: 1 }]);
	});

	it("rejects suicide (no liberty after place)", () => {
		// Fill all liberties of empty center with O; X cannot place there
		let g = gridOf(3, 3, Array(9).fill(null));
		for (const p of [
			{ row: 0, col: 1 },
			{ row: 1, col: 0 },
			{ row: 1, col: 2 },
			{ row: 2, col: 1 }
		]) {
			g = { ...g, cells: setCell(g, p, "O") };
		}
		expect(isLegalLibertyPlace(g, { row: 1, col: 1 }, "X")).toBe(false);
	});

	it("rejects immediate ko recapture when koEnabled", () => {
		// Classic point-ko shape (4×3):
		// . X O .
		// X O . O
		// . X O .
		let g = gridOf(4, 3, Array(12).fill(null));
		const stones: Array<[number, number, "X" | "O"]> = [
			[0, 1, "X"],
			[0, 2, "O"],
			[1, 0, "X"],
			[1, 1, "O"],
			[1, 3, "O"],
			[2, 1, "X"],
			[2, 2, "O"]
		];
		for (const [row, col, p] of stones) {
			g = { ...g, cells: setCell(g, { row, col }, p) };
		}
		const captureAt = { row: 1, col: 2 };
		expect(isLegalLibertyPlace(g, captureAt, "X")).toBe(true);
		const afterPlace = setCell(g, captureAt, "X");
		const capture = applyLibertyCapture(
			{ ...g, cells: afterPlace },
			captureAt,
			"X"
		);
		expect(capture.removed).toEqual([{ row: 1, col: 1 }]);
		const afterGrid = { ...g, cells: capture.cells };
		expect(
			isLegalLibertyPlace(afterGrid, { row: 1, col: 1 }, "O", false, {
				koEnabled: true,
				koPoint: { row: 1, col: 1 }
			})
		).toBe(false);
		expect(
			isLegalLibertyPlace(afterGrid, { row: 1, col: 1 }, "O", false, {
				koEnabled: false,
				koPoint: { row: 1, col: 1 }
			})
		).toBe(true);
	});

	it("positional superko forbids recreating a hashed board without koPoint", () => {
		let g = gridOf(3, 3, Array(9).fill(null));
		g = { ...g, cells: setCell(g, { row: 0, col: 0 }, "X") };
		const pos = { row: 1, col: 1 };
		const simulated = simulateLibertyPlace(g, pos, "O");
		expect(simulated).not.toBeNull();
		const hash = boardPositionHash({ ...g, cells: simulated!.cells });
		expect(
			isLegalLibertyPlace(g, pos, "O", false, {
				koRule: "positional",
				positionHistory: [hash]
			})
		).toBe(false);
		expect(
			isLegalLibertyPlace(g, pos, "O", false, {
				koRule: "point",
				koPoint: null,
				positionHistory: [hash]
			})
		).toBe(true);
	});

	it("situational allows same board with different side-to-move; positional forbids", () => {
		let g = gridOf(3, 3, Array(9).fill(null));
		g = { ...g, cells: setCell(g, { row: 0, col: 0 }, "X") };
		const pos = { row: 1, col: 1 };
		const simulated = simulateLibertyPlace(g, pos, "O");
		expect(simulated).not.toBeNull();
		const after = { ...g, cells: simulated!.cells };
		// O's place would yield (after, X). History only has (after, O).
		expect(
			isLegalLibertyPlace(g, pos, "O", false, {
				koRule: "situational",
				positionHistory: [situationHash(after, "O")]
			})
		).toBe(true);
		expect(
			isLegalLibertyPlace(g, pos, "O", false, {
				koRule: "situational",
				positionHistory: [situationHash(after, "X")]
			})
		).toBe(false);
		expect(
			isLegalLibertyPlace(g, pos, "O", false, {
				koRule: "positional",
				positionHistory: [boardPositionHash(after)]
			})
		).toBe(false);
	});

	it("scores stones plus enclosed territory", () => {
		// X owns left column + enclosed empties on left of a wall
		let g = gridOf(3, 2, Array(6).fill(null));
		g = { ...g, cells: setCell(g, { row: 0, col: 1 }, "X") };
		g = { ...g, cells: setCell(g, { row: 1, col: 1 }, "X") };
		// empties at (0,0)(1,0) bordered only by X → territory; (0,2)(1,2) open to edge with X border only from left
		const score = scoreArea(g);
		expect(score.X).toBeGreaterThanOrEqual(2);
		expect(score.O).toBe(0);
	});
});

describe("Go Lite (liberties + area_control)", () => {
	it("validates and compiles the go-lite preset", () => {
		const cfg = examplePresets["go-lite"].config;
		expect(validateConfig(cfg).ok).toBe(true);
		const { kernel, gameConfig } = compileConfig(cfg);
		expect(gameConfig.captureEnabled).toBe(true);
		expect(gameConfig.captureMode).toBe("liberties");
		expect(gameConfig.koEnabled).toBe(true);
		expect(gameConfig.koRule).toBe("point");
		expect(gameConfig.objectiveMode).toBe("area_control");
		const state = kernel.initialState(cfg.rng.seed);
		expect(state.koPoint).toBeNull();
		expect(state.positionHistory).toBeUndefined();
		const legal = kernel.legalActions(state, 0);
		expect(legal.some((a) => a.type === "pass")).toBe(true);
		expect(legal.some((a) => a.type === "place")).toBe(true);
	});

	it("validates and compiles the go-lite-superko preset", () => {
		const cfg = examplePresets["go-lite-superko"].config;
		expect(validateConfig(cfg).ok).toBe(true);
		const { kernel, gameConfig } = compileConfig(cfg);
		expect(gameConfig.koRule).toBe("positional");
		expect(gameConfig.koEnabled).toBe(true);
		const state = kernel.initialState(cfg.rng.seed);
		expect(state.koPoint).toBeNull();
		expect(state.positionHistory).toEqual([
			boardPositionHash(state.grid)
		]);
	});

	it("validates and compiles the go-lite-situational-superko preset", () => {
		const cfg = examplePresets["go-lite-situational-superko"].config;
		expect(validateConfig(cfg).ok).toBe(true);
		const { kernel, gameConfig } = compileConfig(cfg);
		expect(gameConfig.koRule).toBe("situational");
		expect(gameConfig.koEnabled).toBe(true);
		const state = kernel.initialState(cfg.rng.seed);
		expect(state.koPoint).toBeNull();
		expect(state.positionHistory).toEqual([
			situationHash(state.grid, state.currentPlayer)
		]);
	});

	it("validates and compiles the go-lite-komi preset", () => {
		const cfg = examplePresets["go-lite-komi"].config;
		expect(validateConfig(cfg).ok).toBe(true);
		const { kernel, gameConfig } = compileConfig(cfg);
		expect(gameConfig.objectiveMode).toBe("area_control");
		expect(gameConfig.komi).toBe(0.5);
		expect(gameConfig.captureMode).toBe("liberties");
		const state = kernel.initialState(cfg.rng.seed);
		expect(kernel.legalActions(state, 0).some((a) => a.type === "pass")).toBe(
			true
		);
	});

	it("rejects objective.komi outside area_control", () => {
		const bad = structuredClone(examplePresets["tic-tac-toe"].config) as {
			objective: { mode: string; komi?: number };
		};
		bad.objective = { mode: "n_in_a_row", komi: 0.5 };
		expect(validateConfig(bad as never).ok).toBe(false);
	});

	it("areaOutcome applies komi to O (empty board → O wins)", () => {
		const g = gridOf(3, 3, Array(9).fill(null));
		expect(areaOutcome(g).status).toBe("draw");
		expect(areaOutcome(g, false, "rectangle", undefined, 0.5)).toEqual({
			status: "won",
			winner: "O",
			score: { X: 0, O: 0.5 }
		});
	});

	it("areaOutcome: X still wins when ahead by more than komi", () => {
		let g = gridOf(3, 1, [null, null, null]);
		g = { ...g, cells: setCell(g, { row: 0, col: 0 }, "X") };
		g = { ...g, cells: setCell(g, { row: 0, col: 1 }, "X") };
		// stones X=2 + mono-border empty (0,2) → raw X=3; + komi 0.5 → O=0.5
		const out = areaOutcome(g, false, "rectangle", undefined, 0.5);
		expect(out.status).toBe("won");
		expect(out.winner).toBe("X");
		expect(out.score).toEqual({ X: 3, O: 0.5 });
	});

	it("go-lite-komi: empty double-pass awards O; replay faithful", () => {
		const cfg = examplePresets["go-lite-komi"].config;
		const { kernel, gameConfig } = compileConfig(cfg);
		const script: KernelAction[] = [
			{ type: "pass" },
			{ type: "pass" }
		];
		let state = kernel.initialState(cfg.rng.seed);
		for (const action of script) {
			const result = kernel.stepSync(state, action);
			expect(result.events[0]?.type).toBe("actionApplied");
			state = result.nextState;
		}
		expect(state.status).toBe("won");
		expect(state.winner).toBe("O");
		expect(state.consecutivePasses).toBe(2);

		const withoutKomi = structuredClone(cfg);
		withoutKomi.objective = { mode: "area_control" };
		const baseline = compileConfig(withoutKomi);
		let drawState = baseline.kernel.initialState(cfg.rng.seed);
		for (const action of script) {
			drawState = baseline.kernel.stepSync(drawState, action).nextState;
		}
		expect(drawState.status).toBe("draw");
		expect(drawState.winner).toBeNull();

		const replay = replayActions(gameConfig, script, cfg.rng.seed);
		expect(replay.faithful).toBe(true);
		expect(replay.finalState.status).toBe("won");
		expect(replay.finalState.winner).toBe("O");
	});

	it("validates and compiles the go-lite-seki preset", () => {
		const cfg = examplePresets["go-lite-seki"].config;
		expect(validateConfig(cfg).ok).toBe(true);
		const { kernel, gameConfig } = compileConfig(cfg);
		expect(gameConfig.objectiveMode).toBe("area_control");
		expect(gameConfig.sekiScoring).toBe(true);
		expect(gameConfig.captureMode).toBe("liberties");
		const state = kernel.initialState(cfg.rng.seed);
		expect(kernel.legalActions(state, 0).some((a) => a.type === "pass")).toBe(
			true
		);
	});

	it("rejects objective.seki outside area_control", () => {
		const bad = structuredClone(examplePresets["tic-tac-toe"].config) as {
			objective: { mode: string; seki?: boolean };
		};
		bad.objective = { mode: "n_in_a_row", seki: true };
		expect(validateConfig(bad as never).ok).toBe(false);
	});

	it("findSekiNeutralCells + scoreArea: seki eye is neutral", () => {
		// Seeded go-lite-seki layout:
		// ..O..
		// OXXXO
		// .X.X.
		// .OXO.
		// ..O..
		const cells = Array(25).fill(null) as (string | null)[];
		const put = (row: number, col: number, p: string) => {
			cells[row * 5 + col] = p;
		};
		put(0, 2, "O");
		put(1, 0, "O");
		put(1, 1, "X");
		put(1, 2, "X");
		put(1, 3, "X");
		put(1, 4, "O");
		put(2, 1, "X");
		put(2, 3, "X");
		put(3, 1, "O");
		put(3, 2, "X");
		put(3, 3, "O");
		put(4, 2, "O");
		const g = gridOf(5, 5, cells);

		expect(scoreArea(g)).toEqual({ X: 7, O: 6 });
		const neutral = findSekiNeutralCells(g);
		expect(neutral.has("2,2")).toBe(true);
		expect(scoreArea(g, false, "rectangle", undefined, neutral)).toEqual({
			X: 6,
			O: 6
		});
		expect(areaOutcome(g).winner).toBe("X");
		expect(
			areaOutcome(g, false, "rectangle", undefined, 0, true)
		).toEqual({
			status: "draw",
			winner: null,
			score: { X: 6, O: 6 }
		});
	});

	it("true eye outside seki still counts with sekiScoring", () => {
		// 3×3 X ring — mono-border center eye; no opponent → not seki
		let g = gridOf(3, 3, Array(9).fill(null));
		for (const [row, col] of [
			[0, 0],
			[0, 1],
			[0, 2],
			[1, 0],
			[1, 2],
			[2, 0],
			[2, 1],
			[2, 2]
		] as const) {
			g = { ...g, cells: setCell(g, { row, col }, "X") };
		}
		expect(scoreArea(g)).toEqual({ X: 9, O: 0 });
		const neutral = findSekiNeutralCells(g);
		expect(neutral.size).toBe(0);
		expect(
			areaOutcome(g, false, "rectangle", undefined, 0, true).score
		).toEqual({ X: 9, O: 0 });
	});

	it("go-lite-seki: seeded double-pass draws; without seki X wins; replay faithful", () => {
		const cfg = examplePresets["go-lite-seki"].config;
		const { kernel, gameConfig } = compileConfig(cfg);
		const script: KernelAction[] = [
			{ type: "pass" },
			{ type: "pass" }
		];
		let state = kernel.initialState(cfg.rng.seed);
		for (const action of script) {
			const result = kernel.stepSync(state, action);
			expect(result.events[0]?.type).toBe("actionApplied");
			state = result.nextState;
		}
		expect(state.status).toBe("draw");
		expect(state.winner).toBeNull();
		expect(state.consecutivePasses).toBe(2);

		const withoutSeki = structuredClone(cfg);
		withoutSeki.objective = { mode: "area_control" };
		const baseline = compileConfig(withoutSeki);
		let winState = baseline.kernel.initialState(cfg.rng.seed);
		for (const action of script) {
			winState = baseline.kernel.stepSync(winState, action).nextState;
		}
		expect(winState.status).toBe("won");
		expect(winState.winner).toBe("X");

		const replay = replayActions(gameConfig, script, cfg.rng.seed);
		expect(replay.faithful).toBe(true);
		expect(replay.finalState.status).toBe("draw");
		expect(replay.finalState.winner).toBeNull();
	});

	it("validates and compiles the go-lite-dead-stones preset", () => {
		const cfg = examplePresets["go-lite-dead-stones"].config;
		expect(validateConfig(cfg).ok).toBe(true);
		const { kernel, gameConfig } = compileConfig(cfg);
		expect(gameConfig.objectiveMode).toBe("area_control");
		expect(gameConfig.deadStones).toBe(true);
		expect(gameConfig.captureMode).toBe("liberties");
		const state = kernel.initialState(cfg.rng.seed);
		expect(kernel.legalActions(state, 0).some((a) => a.type === "pass")).toBe(
			true
		);
	});

	it("rejects objective.deadStones outside area_control", () => {
		const bad = structuredClone(examplePresets["tic-tac-toe"].config) as {
			objective: { mode: string; deadStones?: boolean };
		};
		bad.objective = { mode: "n_in_a_row", deadStones: true };
		expect(validateConfig(bad as never).ok).toBe(false);
	});

	it("findDeadStoneCells: interior <2-eye group removed; edge ring kept", () => {
		// 7×7 O ring + interior X with center eye
		const cells = Array(49).fill(null) as (string | null)[];
		const put = (row: number, col: number, p: string) => {
			cells[row * 7 + col] = p;
		};
		for (let row = 0; row < 7; row++) {
			for (let col = 0; col < 7; col++) {
				const onRing = row === 0 || row === 6 || col === 0 || col === 6;
				if (onRing) put(row, col, "O");
				else if (!(row === 3 && col === 3)) put(row, col, "X");
			}
		}
		const g = gridOf(7, 7, cells);
		expect(scoreArea(g)).toEqual({ X: 25, O: 24 });
		const dead = findDeadStoneCells(g);
		expect(dead.length).toBe(24);
		expect(dead.every((p) => getCell(g, p) === "X")).toBe(true);
		const cleared = removeDeadStones(g);
		expect(scoreArea(cleared)).toEqual({ X: 0, O: 49 });
		expect(areaOutcome(g).winner).toBe("X");
		expect(
			areaOutcome(g, false, "rectangle", undefined, 0, false, true)
		).toEqual({
			status: "won",
			winner: "O",
			score: { X: 0, O: 49 }
		});
	});

	it("two-eyed interior group is not dead", () => {
		// 7×7 O edge ring; interior X with true eyes at (2,2) and (2,4)
		const cells = Array(49).fill(null) as (string | null)[];
		const put = (row: number, col: number, p: string) => {
			cells[row * 7 + col] = p;
		};
		for (let row = 0; row < 7; row++) {
			for (let col = 0; col < 7; col++) {
				const onRing = row === 0 || row === 6 || col === 0 || col === 6;
				if (onRing) put(row, col, "O");
			}
		}
		for (const [row, col] of [
			[1, 1],
			[1, 2],
			[1, 3],
			[1, 4],
			[1, 5],
			[2, 1],
			[2, 3],
			[2, 5],
			[3, 1],
			[3, 2],
			[3, 3],
			[3, 4],
			[3, 5],
			[4, 1],
			[4, 2],
			[4, 3],
			[4, 4],
			[4, 5],
			[5, 1],
			[5, 2],
			[5, 3],
			[5, 4],
			[5, 5]
		] as const) {
			put(row, col, "X");
		}
		const alive = gridOf(7, 7, cells);
		expect(
			countTrueEyes(
				alive,
				enumerateGroups(alive).find((gr) => gr.color === "X")!.stones,
				"X"
			)
		).toBe(2);
		expect(findDeadStoneCells(alive).length).toBe(0);
	});

	it("go-lite-dead-stones: seeded double-pass O wins; without removal X wins; replay faithful", () => {
		const cfg = examplePresets["go-lite-dead-stones"].config;
		const { kernel, gameConfig } = compileConfig(cfg);
		const script: KernelAction[] = [
			{ type: "pass" },
			{ type: "pass" }
		];
		let state = kernel.initialState(cfg.rng.seed);
		for (const action of script) {
			const result = kernel.stepSync(state, action);
			expect(result.events[0]?.type).toBe("actionApplied");
			state = result.nextState;
		}
		expect(state.status).toBe("won");
		expect(state.winner).toBe("O");
		expect(state.consecutivePasses).toBe(2);

		const withoutDead = structuredClone(cfg);
		withoutDead.objective = { mode: "area_control" };
		const baseline = compileConfig(withoutDead);
		let winState = baseline.kernel.initialState(cfg.rng.seed);
		for (const action of script) {
			winState = baseline.kernel.stepSync(winState, action).nextState;
		}
		expect(winState.status).toBe("won");
		expect(winState.winner).toBe("X");

		const replay = replayActions(gameConfig, script, cfg.rng.seed);
		expect(replay.faithful).toBe(true);
		expect(replay.finalState.status).toBe("won");
		expect(replay.finalState.winner).toBe("O");
	});

	it("validates and compiles the go-lite-benson preset", () => {
		const cfg = examplePresets["go-lite-benson"].config;
		expect(validateConfig(cfg).ok).toBe(true);
		const { kernel, gameConfig } = compileConfig(cfg);
		expect(gameConfig.objectiveMode).toBe("area_control");
		expect(gameConfig.bensonLife).toBe(true);
		expect(gameConfig.captureMode).toBe("liberties");
		const state = kernel.initialState(cfg.rng.seed);
		expect(kernel.legalActions(state, 0).some((a) => a.type === "pass")).toBe(
			true
		);
	});

	it("rejects objective.bensonLife outside area_control", () => {
		const bad = structuredClone(examplePresets["tic-tac-toe"].config) as {
			objective: { mode: string; bensonLife?: boolean };
		};
		bad.objective = { mode: "n_in_a_row", bensonLife: true };
		expect(validateConfig(bad as never).ok).toBe(false);
	});

	it("Benson keeps dual one-eyed groups that deadStones clears", () => {
		// 9×5: two interior X blocks, each with 1 true eye + shared corridor
		const w = 9;
		const h = 5;
		const cells = Array(w * h).fill(null) as (string | null)[];
		const put = (row: number, col: number, p: string) => {
			cells[row * w + col] = p;
		};
		for (const [row, col] of [
			[1, 1],
			[1, 2],
			[1, 3],
			[2, 1],
			[2, 3],
			[3, 1],
			[3, 2],
			[3, 3],
			[1, 5],
			[1, 6],
			[1, 7],
			[2, 5],
			[2, 7],
			[3, 5],
			[3, 6],
			[3, 7]
		] as const) {
			put(row, col, "X");
		}
		const g = gridOf(w, h, cells);
		const xGroups = enumerateGroups(g).filter((gr) => gr.color === "X");
		expect(xGroups.length).toBe(2);
		expect(
			xGroups.every((gr) => countTrueEyes(g, gr.stones, "X") === 1)
		).toBe(true);
		expect(findDeadStoneCells(g).length).toBe(16);
		const alive = findBensonAliveGroupIds(g, "X");
		expect(alive.size).toBe(2);
		expect(findBensonDeadStoneCells(g).length).toBe(0);
		// 16 stones + all empties mono-border X (edge-open regions award to X)
		expect(scoreArea(g)).toEqual({ X: 45, O: 0 });
		expect(scoreArea(removeDeadStones(g))).toEqual({ X: 0, O: 0 });
		expect(scoreArea(removeBensonDeadStones(g))).toEqual({ X: 45, O: 0 });
		expect(
			areaOutcome(g, false, "rectangle", undefined, 0, false, true)
		).toEqual({
			status: "draw",
			winner: null,
			score: { X: 0, O: 0 }
		});
		expect(
			areaOutcome(g, false, "rectangle", undefined, 0, false, false, true)
		).toEqual({
			status: "won",
			winner: "X",
			score: { X: 45, O: 0 }
		});
	});

	it("go-lite-benson: seeded double-pass X wins; deadStones would draw; replay faithful", () => {
		const cfg = examplePresets["go-lite-benson"].config;
		const { kernel, gameConfig } = compileConfig(cfg);
		const script: KernelAction[] = [
			{ type: "pass" },
			{ type: "pass" }
		];
		let state = kernel.initialState(cfg.rng.seed);
		for (const action of script) {
			const result = kernel.stepSync(state, action);
			expect(result.events[0]?.type).toBe("actionApplied");
			state = result.nextState;
		}
		expect(state.status).toBe("won");
		expect(state.winner).toBe("X");
		expect(state.consecutivePasses).toBe(2);

		const asDeadStones = structuredClone(cfg);
		asDeadStones.objective = { mode: "area_control", deadStones: true };
		const deadKernel = compileConfig(asDeadStones);
		let deadState = deadKernel.kernel.initialState(cfg.rng.seed);
		for (const action of script) {
			deadState = deadKernel.kernel.stepSync(deadState, action).nextState;
		}
		expect(deadState.status).toBe("draw");
		expect(deadState.winner).toBeNull();

		const without = structuredClone(cfg);
		without.objective = { mode: "area_control" };
		const baseline = compileConfig(without);
		let rawState = baseline.kernel.initialState(cfg.rng.seed);
		for (const action of script) {
			rawState = baseline.kernel.stepSync(rawState, action).nextState;
		}
		expect(rawState.status).toBe("won");
		expect(rawState.winner).toBe("X");

		const replay = replayActions(gameConfig, script, cfg.rng.seed);
		expect(replay.faithful).toBe(true);
		expect(replay.finalState.status).toBe("won");
		expect(replay.finalState.winner).toBe("X");
	});

	it("validates and compiles the go-lite-ladders preset", () => {
		const cfg = examplePresets["go-lite-ladders"].config;
		expect(validateConfig(cfg).ok).toBe(true);
		const { kernel, gameConfig } = compileConfig(cfg);
		expect(gameConfig.objectiveMode).toBe("area_control");
		expect(gameConfig.ladderDeath).toBe(true);
		expect(gameConfig.captureMode).toBe("liberties");
		const state = kernel.initialState(cfg.rng.seed);
		expect(kernel.legalActions(state, 0).some((a) => a.type === "pass")).toBe(
			true
		);
	});

	it("rejects objective.ladderDeath outside area_control", () => {
		const bad = structuredClone(examplePresets["tic-tac-toe"].config) as {
			objective: { mode: string; ladderDeath?: boolean };
		};
		bad.objective = { mode: "n_in_a_row", ladderDeath: true };
		expect(validateConfig(bad as never).ok).toBe(false);
	});

	it("two-eyed interior group is not ladder-dead", () => {
		// 7×7 O edge ring; interior X with true eyes at (2,2) and (2,4).
		// O may be 0-lib (artificial seed) — only assert the X group is safe.
		const cells = Array(49).fill(null) as (string | null)[];
		const put = (row: number, col: number, p: string) => {
			cells[row * 7 + col] = p;
		};
		for (let row = 0; row < 7; row++) {
			for (let col = 0; col < 7; col++) {
				const onRing = row === 0 || row === 6 || col === 0 || col === 6;
				if (onRing) put(row, col, "O");
			}
		}
		for (const [row, col] of [
			[1, 1],
			[1, 2],
			[1, 3],
			[1, 4],
			[1, 5],
			[2, 1],
			[2, 3],
			[2, 5],
			[3, 1],
			[3, 2],
			[3, 3],
			[3, 4],
			[3, 5],
			[4, 1],
			[4, 2],
			[4, 3],
			[4, 4],
			[4, 5],
			[5, 1],
			[5, 2],
			[5, 3],
			[5, 4],
			[5, 5]
		] as const) {
			put(row, col, "X");
		}
		const alive = gridOf(7, 7, cells);
		const xGroup = enumerateGroups(alive).find((gr) => gr.color === "X")!;
		expect(countTrueEyes(alive, xGroup.stones, "X")).toBe(2);
		expect(isLadderDeadGroup(alive, xGroup.stones, "X")).toBe(false);
		expect(
			findLadderDeadCells(alive).every((p) => getCell(alive, p) !== "X")
		).toBe(true);
	});

	it("findLadderDeadCells: edge atari runner removed; deadStones/Benson keep it", () => {
		const cfg = examplePresets["go-lite-ladders"].config;
		const { kernel } = compileConfig(cfg);
		const state = kernel.initialState(cfg.rng.seed);
		const g = state.grid;
		const runner = { row: 0, col: 2 };
		expect(getCell(g, runner)).toBe("X");
		expect(isLadderDeadGroup(g, [runner], "X")).toBe(true);
		expect(findLadderDeadCells(g)).toEqual([runner]);
		expect(findDeadStoneCells(g).some((p) => p.row === 0 && p.col === 2)).toBe(
			false
		);
		expect(
			findBensonDeadStoneCells(g).some((p) => p.row === 0 && p.col === 2)
		).toBe(false);
		expect(areaOutcome(g).status).toBe("draw");
		expect(
			areaOutcome(g, false, "rectangle", undefined, 0, false, true)
		).toEqual({
			status: "draw",
			winner: null,
			score: { X: 15, O: 15 }
		});
		expect(
			areaOutcome(g, false, "rectangle", undefined, 0, false, false, true)
		).toEqual({
			status: "draw",
			winner: null,
			score: { X: 15, O: 15 }
		});
		expect(
			areaOutcome(
				g,
				false,
				"rectangle",
				undefined,
				0,
				false,
				false,
				false,
				true
			)
		).toEqual({
			status: "won",
			winner: "O",
			score: { X: 14, O: 15 }
		});
		expect(scoreArea(removeLadderDeadStones(g))).toEqual({ X: 14, O: 15 });
	});

	it("go-lite-ladders: seeded double-pass O wins; without flag draws; replay faithful", () => {
		const cfg = examplePresets["go-lite-ladders"].config;
		const { kernel, gameConfig } = compileConfig(cfg);
		const script: KernelAction[] = [{ type: "pass" }, { type: "pass" }];
		let state = kernel.initialState(cfg.rng.seed);
		for (const action of script) {
			const result = kernel.stepSync(state, action);
			expect(result.events[0]?.type).toBe("actionApplied");
			state = result.nextState;
		}
		expect(state.status).toBe("won");
		expect(state.winner).toBe("O");
		expect(state.consecutivePasses).toBe(2);

		const without = structuredClone(cfg);
		without.objective = { mode: "area_control" };
		const baseline = compileConfig(without);
		let rawState = baseline.kernel.initialState(cfg.rng.seed);
		for (const action of script) {
			rawState = baseline.kernel.stepSync(rawState, action).nextState;
		}
		expect(rawState.status).toBe("draw");
		expect(rawState.winner).toBeNull();

		const asDeadStones = structuredClone(cfg);
		asDeadStones.objective = { mode: "area_control", deadStones: true };
		const deadKernel = compileConfig(asDeadStones);
		let deadState = deadKernel.kernel.initialState(cfg.rng.seed);
		for (const action of script) {
			deadState = deadKernel.kernel.stepSync(deadState, action).nextState;
		}
		expect(deadState.status).toBe("draw");

		const asBenson = structuredClone(cfg);
		asBenson.objective = { mode: "area_control", bensonLife: true };
		const bensonKernel = compileConfig(asBenson);
		let bensonState = bensonKernel.kernel.initialState(cfg.rng.seed);
		for (const action of script) {
			bensonState = bensonKernel.kernel.stepSync(bensonState, action).nextState;
		}
		expect(bensonState.status).toBe("draw");

		const replay = replayActions(gameConfig, script, cfg.rng.seed);
		expect(replay.faithful).toBe(true);
		expect(replay.finalState.status).toBe("won");
		expect(replay.finalState.winner).toBe("O");
	});

	it("scoreTerritory omits on-board stones", () => {
		const g = gridOf(3, 2, [
			"X",
			"X",
			"X",
			"X",
			null,
			"X" // mono-border empty at (1,1)
		]);
		expect(scoreArea(g)).toEqual({ X: 6, O: 0 }); // 5 stones + 1 empty
		expect(scoreTerritory(g)).toEqual({ X: 1, O: 0 });
	});

	it("areaOutcome territoryPrisoners adds prisoners to territory", () => {
		const g = gridOf(3, 2, ["X", "X", "X", "X", null, "X"]);
		expect(
			areaOutcome(
				g,
				false,
				"rectangle",
				undefined,
				0,
				false,
				false,
				false,
				false,
				true,
				{ X: 0, O: 3 }
			)
		).toEqual({
			status: "won",
			winner: "O",
			score: { X: 1, O: 3 }
		});
		expect(areaOutcome(g).winner).toBe("X");
	});

	it("validates and compiles the go-lite-territory-prisoners preset", () => {
		const cfg = examplePresets["go-lite-territory-prisoners"].config;
		expect(validateConfig(cfg).ok).toBe(true);
		const { kernel, gameConfig } = compileConfig(cfg);
		expect(gameConfig.objectiveMode).toBe("area_control");
		expect(gameConfig.territoryPrisoners).toBe(true);
		expect(gameConfig.captureMode).toBe("liberties");
		const state = kernel.initialState(cfg.rng.seed);
		expect(state.prisoners).toEqual({ X: 0, O: 0 });
		expect(kernel.legalActions(state, 0).some((a) => a.type === "pass")).toBe(
			true
		);
	});

	it("rejects objective.territoryPrisoners outside area_control", () => {
		const bad = structuredClone(examplePresets["tic-tac-toe"].config) as {
			objective: { mode: string; territoryPrisoners?: boolean };
		};
		bad.objective = { mode: "n_in_a_row", territoryPrisoners: true };
		expect(validateConfig(bad as never).ok).toBe(false);
	});

	it("go-lite-territory-prisoners: capture then double-pass O wins; area awards X; replay faithful", () => {
		const cfg = examplePresets["go-lite-territory-prisoners"].config;
		const { kernel, gameConfig } = compileConfig(cfg);
		const script: KernelAction[] = [
			{ type: "pass" },
			{ type: "place", position: { row: 3, col: 3 } },
			{ type: "pass" },
			{ type: "pass" }
		];
		let state = kernel.initialState(cfg.rng.seed);
		for (const action of script) {
			const result = kernel.stepSync(state, action);
			expect(result.events[0]?.type).toBe("actionApplied");
			state = result.nextState;
		}
		expect(state.prisoners).toEqual({ X: 0, O: 3 });
		expect(state.status).toBe("won");
		expect(state.winner).toBe("O");
		expect(state.consecutivePasses).toBe(2);

		const without = structuredClone(cfg);
		without.objective = { mode: "area_control" };
		const baseline = compileConfig(without);
		let rawState = baseline.kernel.initialState(cfg.rng.seed);
		for (const action of script) {
			rawState = baseline.kernel.stepSync(rawState, action).nextState;
		}
		expect(rawState.prisoners).toEqual({ X: 0, O: 3 });
		expect(rawState.status).toBe("won");
		expect(rawState.winner).toBe("X");

		const replay = replayActions(gameConfig, script, cfg.rng.seed);
		expect(replay.faithful).toBe(true);
		expect(replay.finalState.status).toBe("won");
		expect(replay.finalState.winner).toBe("O");
		expect(replay.finalState.prisoners).toEqual({ X: 0, O: 3 });
	});

	it("validates and compiles the go-lite-semeai preset", () => {
		const cfg = examplePresets["go-lite-semeai"].config;
		expect(validateConfig(cfg).ok).toBe(true);
		const { kernel, gameConfig } = compileConfig(cfg);
		expect(gameConfig.objectiveMode).toBe("area_control");
		expect(gameConfig.semeaiDeath).toBe(true);
		expect(gameConfig.captureMode).toBe("liberties");
		const state = kernel.initialState(cfg.rng.seed);
		expect(kernel.legalActions(state, 0).some((a) => a.type === "pass")).toBe(
			true
		);
	});

	it("rejects objective.semeaiDeath outside area_control", () => {
		const bad = structuredClone(examplePresets["tic-tac-toe"].config) as {
			objective: { mode: string; semeaiDeath?: boolean };
		};
		bad.objective = { mode: "n_in_a_row", semeaiDeath: true };
		expect(validateConfig(bad as never).ok).toBe(false);
	});

	it("findSemeaiDeadCells: race X cleared; equal liberties kept; ladder/eyes skip", () => {
		const cfg = examplePresets["go-lite-semeai"].config;
		const { kernel } = compileConfig(cfg);
		const state = kernel.initialState(cfg.rng.seed);
		const g = state.grid;
		const raceX = enumerateGroups(g).find(
			(gr) => gr.color === "X" && gr.stones.some((p) => p.row === 0)
		)!;
		expect(raceX.liberties.size).toBe(3);
		expect(isLadderDeadGroup(g, raceX.stones, "X")).toBe(false);
		const dead = findSemeaiDeadCells(g);
		expect(dead.length).toBe(9);
		expect(dead.every((p) => getCell(g, p) === "X")).toBe(true);
		expect(dead.every((p) => p.row <= 2)).toBe(true);
		expect(findDeadStoneCells(g).length).toBe(0);
		expect(findBensonDeadStoneCells(g).length).toBe(0);
		expect(findLadderDeadCells(g).length).toBe(0);
		expect(areaOutcome(g).winner).toBe("X");
		expect(
			areaOutcome(
				g,
				false,
				"rectangle",
				undefined,
				0,
				false,
				false,
				false,
				false,
				false,
				{ X: 0, O: 0 },
				true
			).winner
		).toBe("O");
		const cleared = scoreArea(removeSemeaiDeadStones(g));
		expect(cleared.O).toBeGreaterThan(cleared.X);

		// Equal-liberty corridor: fill one O private liberty → both have 3 → keep.
		const equal = { ...g, cells: setCell(g, { row: 1, col: 5 }, "O") };
		const xEq = enumerateGroups(equal).find(
			(gr) => gr.color === "X" && gr.stones.some((p) => p.row === 0)
		)!;
		const oEq = enumerateGroups(equal).find(
			(gr) => gr.color === "O" && gr.stones.some((p) => p.row === 0)
		)!;
		expect(xEq.liberties.size).toBe(3);
		expect(oEq.liberties.size).toBe(3);
		expect(findSemeaiDeadCells(equal).length).toBe(0);
	});

	it("go-lite-semeai: seeded double-pass O wins; without flag X wins; contrasts; replay faithful", () => {
		const cfg = examplePresets["go-lite-semeai"].config;
		const { kernel, gameConfig } = compileConfig(cfg);
		const script: KernelAction[] = [{ type: "pass" }, { type: "pass" }];
		let state = kernel.initialState(cfg.rng.seed);
		for (const action of script) {
			const result = kernel.stepSync(state, action);
			expect(result.events[0]?.type).toBe("actionApplied");
			state = result.nextState;
		}
		expect(state.status).toBe("won");
		expect(state.winner).toBe("O");
		expect(state.consecutivePasses).toBe(2);

		const without = structuredClone(cfg);
		without.objective = { mode: "area_control" };
		const baseline = compileConfig(without);
		let rawState = baseline.kernel.initialState(cfg.rng.seed);
		for (const action of script) {
			rawState = baseline.kernel.stepSync(rawState, action).nextState;
		}
		expect(rawState.status).toBe("won");
		expect(rawState.winner).toBe("X");

		for (const flag of [
			{ deadStones: true },
			{ bensonLife: true },
			{ ladderDeath: true },
			{ seki: true }
		] as const) {
			const alt = structuredClone(cfg);
			alt.objective = { mode: "area_control", ...flag };
			const altKernel = compileConfig(alt);
			let altState = altKernel.kernel.initialState(cfg.rng.seed);
			for (const action of script) {
				altState = altKernel.kernel.stepSync(altState, action).nextState;
			}
			expect(altState.winner).toBe("X");
		}

		const replay = replayActions(gameConfig, script, cfg.rng.seed);
		expect(replay.faithful).toBe(true);
		expect(replay.finalState.status).toBe("won");
		expect(replay.finalState.winner).toBe("O");
	});

	it("validates and compiles the go-lite-nakade preset", () => {
		const cfg = examplePresets["go-lite-nakade"].config;
		expect(validateConfig(cfg).ok).toBe(true);
		const { kernel, gameConfig } = compileConfig(cfg);
		expect(gameConfig.objectiveMode).toBe("area_control");
		expect(gameConfig.nakadeDeath).toBe(true);
		expect(gameConfig.captureMode).toBe("liberties");
		const state = kernel.initialState(cfg.rng.seed);
		expect(kernel.legalActions(state, 0).some((a) => a.type === "pass")).toBe(
			true
		);
	});

	it("rejects objective.nakadeDeath outside area_control", () => {
		const bad = structuredClone(examplePresets["tic-tac-toe"].config) as {
			objective: { mode: string; nakadeDeath?: boolean };
		};
		bad.objective = { mode: "n_in_a_row", nakadeDeath: true };
		expect(validateConfig(bad as never).ok).toBe(false);
	});

	it("findNakadeDeadCells: T1 corridor clears Benson-alive one-eyed shell; siblings skip", () => {
		const cfg = examplePresets["go-lite-nakade"].config;
		const { kernel } = compileConfig(cfg);
		const state = kernel.initialState(cfg.rng.seed);
		const g = state.grid;
		const xGroups = enumerateGroups(g).filter((gr) => gr.color === "X");
		expect(xGroups.length).toBe(1);
		expect(countTrueEyes(g, xGroups[0]!.stones, "X")).toBe(1);
		expect(findBensonAliveGroupIds(g, "X").size).toBe(1);
		expect(findDeadStoneCells(g).length).toBe(xGroups[0]!.stones.length);
		expect(findSemeaiDeadCells(g).length).toBe(0);
		// Edge O may be ladder-tagged; X shell must not be (nakade is the seam).
		expect(
			findLadderDeadCells(g).every((p) => getCell(g, p) !== "X")
		).toBe(true);
		expect(
			isNakadeVulnerableRegion([
				{ row: 2, col: 4 },
				{ row: 3, col: 4 },
				{ row: 4, col: 4 }
			])
		).toEqual({ vital: { row: 3, col: 4 } });
		const dead = findNakadeDeadCells(g);
		expect(dead.length).toBe(xGroups[0]!.stones.length);
		expect(dead.every((p) => getCell(g, p) === "X")).toBe(true);
		expect(areaOutcome(g).winner).toBe("X");
		expect(
			areaOutcome(
				g,
				false,
				"rectangle",
				undefined,
				0,
				false,
				false,
				false,
				false,
				false,
				{ X: 0, O: 0 },
				false,
				true
			).winner
		).toBe("O");
		expect(
			areaOutcome(
				g,
				false,
				"rectangle",
				undefined,
				0,
				false,
				false,
				true
			).winner
		).toBe("X");
		const cleared = scoreArea(removeNakadeDeadStones(g));
		expect(cleared.O).toBeGreaterThan(cleared.X);
		// L-shape 3-cell region is not T1 (straight-only in M76).
		expect(
			isNakadeVulnerableRegion([
				{ row: 1, col: 1 },
				{ row: 1, col: 2 },
				{ row: 2, col: 1 }
			])
		).toBeNull();
	});

	it("go-lite-nakade: seeded double-pass O wins; without flag X wins; contrasts; replay faithful", () => {
		const cfg = examplePresets["go-lite-nakade"].config;
		const { kernel, gameConfig } = compileConfig(cfg);
		const script: KernelAction[] = [{ type: "pass" }, { type: "pass" }];
		let state = kernel.initialState(cfg.rng.seed);
		for (const action of script) {
			const result = kernel.stepSync(state, action);
			expect(result.events[0]?.type).toBe("actionApplied");
			state = result.nextState;
		}
		expect(state.status).toBe("won");
		expect(state.winner).toBe("O");
		expect(state.consecutivePasses).toBe(2);

		const without = structuredClone(cfg);
		without.objective = { mode: "area_control" };
		const baseline = compileConfig(without);
		let rawState = baseline.kernel.initialState(cfg.rng.seed);
		for (const action of script) {
			rawState = baseline.kernel.stepSync(rawState, action).nextState;
		}
		expect(rawState.status).toBe("won");
		expect(rawState.winner).toBe("X");

		for (const flag of [
			{ bensonLife: true },
			{ semeaiDeath: true },
			{ ladderDeath: true },
			{ seki: true }
		] as const) {
			const alt = structuredClone(cfg);
			alt.objective = { mode: "area_control", ...flag };
			const altKernel = compileConfig(alt);
			let altState = altKernel.kernel.initialState(cfg.rng.seed);
			for (const action of script) {
				altState = altKernel.kernel.stepSync(altState, action).nextState;
			}
			expect(altState.winner).toBe("X");
		}

		const replay = replayActions(gameConfig, script, cfg.rng.seed);
		expect(replay.faithful).toBe(true);
		expect(replay.finalState.status).toBe("won");
		expect(replay.finalState.winner).toBe("O");
	});

	it("validates and compiles the go-lite-l-nakade preset", () => {
		const cfg = examplePresets["go-lite-l-nakade"].config;
		expect(validateConfig(cfg).ok).toBe(true);
		const { kernel, gameConfig } = compileConfig(cfg);
		expect(gameConfig.objectiveMode).toBe("area_control");
		expect(gameConfig.lNakadeDeath).toBe(true);
		expect(gameConfig.captureMode).toBe("liberties");
		const state = kernel.initialState(cfg.rng.seed);
		expect(kernel.legalActions(state, 0).some((a) => a.type === "pass")).toBe(
			true
		);
	});

	it("rejects objective.lNakadeDeath outside area_control", () => {
		const bad = structuredClone(examplePresets["tic-tac-toe"].config) as {
			objective: { mode: string; lNakadeDeath?: boolean };
		};
		bad.objective = { mode: "n_in_a_row", lNakadeDeath: true };
		expect(validateConfig(bad as never).ok).toBe(false);
	});

	it("findLNakadeDeadCells: L corridor clears Benson-alive one-eyed shell; T1 misses", () => {
		const cfg = examplePresets["go-lite-l-nakade"].config;
		const { kernel } = compileConfig(cfg);
		const state = kernel.initialState(cfg.rng.seed);
		const g = state.grid;
		const xGroups = enumerateGroups(g).filter((gr) => gr.color === "X");
		expect(xGroups.length).toBe(1);
		expect(countTrueEyes(g, xGroups[0]!.stones, "X")).toBe(1);
		expect(findBensonAliveGroupIds(g, "X").size).toBe(1);
		expect(findDeadStoneCells(g).length).toBe(xGroups[0]!.stones.length);
		expect(findSemeaiDeadCells(g).length).toBe(0);
		expect(findNakadeDeadCells(g).every((p) => getCell(g, p) !== "X")).toBe(
			true
		);
		expect(
			findSquareNakadeDeadCells(g).every((p) => getCell(g, p) !== "X")
		).toBe(true);
		expect(
			findNetDeadCells(g).every((p) => getCell(g, p) !== "X")
		).toBe(true);
		expect(
			findLooseNetDeadCells(g).every((p) => getCell(g, p) !== "X")
		).toBe(true);
		expect(
			findSenteLadderDeadCells(g).every((p) => getCell(g, p) !== "X")
		).toBe(true);
		expect(
			findApproachNetDeadCells(g).every((p) => getCell(g, p) !== "X")
		).toBe(true);
		// Edge O may be ladder-tagged; X shell must not be.
		expect(
			findLadderDeadCells(g).every((p) => getCell(g, p) !== "X")
		).toBe(true);
		expect(
			isLNakadeVulnerableRegion([
				{ row: 3, col: 4 },
				{ row: 4, col: 4 },
				{ row: 4, col: 3 }
			])
		).toEqual({ vital: { row: 4, col: 4 } });
		expect(
			isNakadeVulnerableRegion([
				{ row: 3, col: 4 },
				{ row: 4, col: 4 },
				{ row: 4, col: 3 }
			])
		).toBeNull();
		const dead = findLNakadeDeadCells(g);
		expect(dead.length).toBe(xGroups[0]!.stones.length);
		expect(dead.every((p) => getCell(g, p) === "X")).toBe(true);
		expect(areaOutcome(g).winner).toBe("X");
		expect(
			areaOutcome(
				g,
				false,
				"rectangle",
				undefined,
				0,
				false,
				false,
				false,
				false,
				false,
				{ X: 0, O: 0 },
				false,
				false,
				false,
				false,
				false,
				false,
				true
			).winner
		).toBe("O");
		expect(
			areaOutcome(
				g,
				false,
				"rectangle",
				undefined,
				0,
				false,
				false,
				true
			).winner
		).toBe("X");
		expect(
			areaOutcome(
				g,
				false,
				"rectangle",
				undefined,
				0,
				false,
				false,
				false,
				false,
				false,
				{ X: 0, O: 0 },
				false,
				true
			).winner
		).toBe("X");
		const cleared = scoreArea(removeLNakadeDeadStones(g));
		expect(cleared.O).toBeGreaterThan(cleared.X);
		// Straight T1 is not L.
		expect(
			isLNakadeVulnerableRegion([
				{ row: 2, col: 4 },
				{ row: 3, col: 4 },
				{ row: 4, col: 4 }
			])
		).toBeNull();
	});

	it("go-lite-l-nakade: seeded double-pass O wins; without flag X wins; contrasts; replay faithful", () => {
		const cfg = examplePresets["go-lite-l-nakade"].config;
		const { kernel, gameConfig } = compileConfig(cfg);
		const script: KernelAction[] = [{ type: "pass" }, { type: "pass" }];
		let state = kernel.initialState(cfg.rng.seed);
		for (const action of script) {
			const result = kernel.stepSync(state, action);
			expect(result.events[0]?.type).toBe("actionApplied");
			state = result.nextState;
		}
		expect(state.status).toBe("won");
		expect(state.winner).toBe("O");
		expect(state.consecutivePasses).toBe(2);

		const without = structuredClone(cfg);
		without.objective = { mode: "area_control" };
		const baseline = compileConfig(without);
		let rawState = baseline.kernel.initialState(cfg.rng.seed);
		for (const action of script) {
			rawState = baseline.kernel.stepSync(rawState, action).nextState;
		}
		expect(rawState.status).toBe("won");
		expect(rawState.winner).toBe("X");

		for (const flag of [
			{ bensonLife: true },
			{ nakadeDeath: true },
			{ squareNakadeDeath: true },
			{ pyramidNakadeDeath: true },
			{ twistedNakadeDeath: true },
			{ l4NakadeDeath: true },
			{ straight4NakadeDeath: true },
			{ semeaiDeath: true },
			{ netDeath: true },
			{ looseNetDeath: true },
			{ senteLadderDeath: true },
			{ approachNetDeath: true },
			{ ladderDeath: true },
			{ seki: true }
		] as const) {
			const alt = structuredClone(cfg);
			alt.objective = { mode: "area_control", ...flag };
			const altKernel = compileConfig(alt);
			let altState = altKernel.kernel.initialState(cfg.rng.seed);
			for (const action of script) {
				altState = altKernel.kernel.stepSync(altState, action).nextState;
			}
			expect(altState.winner).toBe("X");
		}

		const replay = replayActions(gameConfig, script, cfg.rng.seed);
		expect(replay.faithful).toBe(true);
		expect(replay.finalState.status).toBe("won");
		expect(replay.finalState.winner).toBe("O");
	});

	it("validates and compiles the go-lite-square-nakade preset", () => {
		const cfg = examplePresets["go-lite-square-nakade"].config;
		expect(validateConfig(cfg).ok).toBe(true);
		const { kernel, gameConfig } = compileConfig(cfg);
		expect(gameConfig.objectiveMode).toBe("area_control");
		expect(gameConfig.squareNakadeDeath).toBe(true);
		expect(gameConfig.captureMode).toBe("liberties");
		const state = kernel.initialState(cfg.rng.seed);
		expect(kernel.legalActions(state, 0).some((a) => a.type === "pass")).toBe(
			true
		);
	});

	it("rejects objective.squareNakadeDeath outside area_control", () => {
		const bad = structuredClone(examplePresets["tic-tac-toe"].config) as {
			objective: { mode: string; squareNakadeDeath?: boolean };
		};
		bad.objective = { mode: "n_in_a_row", squareNakadeDeath: true };
		expect(validateConfig(bad as never).ok).toBe(false);
	});

	it("findSquareNakadeDeadCells: 2×2 corridor clears Benson-alive one-eyed shell; T1/L miss", () => {
		const cfg = examplePresets["go-lite-square-nakade"].config;
		const { kernel } = compileConfig(cfg);
		const state = kernel.initialState(cfg.rng.seed);
		const g = state.grid;
		const xGroups = enumerateGroups(g).filter((gr) => gr.color === "X");
		expect(xGroups.length).toBe(1);
		expect(countTrueEyes(g, xGroups[0]!.stones, "X")).toBe(1);
		expect(findBensonAliveGroupIds(g, "X").size).toBe(1);
		expect(findDeadStoneCells(g).length).toBe(xGroups[0]!.stones.length);
		expect(findSemeaiDeadCells(g).length).toBe(0);
		expect(findNakadeDeadCells(g).every((p) => getCell(g, p) !== "X")).toBe(
			true
		);
		expect(findLNakadeDeadCells(g).every((p) => getCell(g, p) !== "X")).toBe(
			true
		);
		expect(
			findNetDeadCells(g).every((p) => getCell(g, p) !== "X")
		).toBe(true);
		expect(
			findLooseNetDeadCells(g).every((p) => getCell(g, p) !== "X")
		).toBe(true);
		expect(
			findSenteLadderDeadCells(g).every((p) => getCell(g, p) !== "X")
		).toBe(true);
		expect(
			findApproachNetDeadCells(g).every((p) => getCell(g, p) !== "X")
		).toBe(true);
		expect(
			findLadderDeadCells(g).every((p) => getCell(g, p) !== "X")
		).toBe(true);
		expect(
			isSquareNakadeVulnerableRegion([
				{ row: 3, col: 3 },
				{ row: 3, col: 4 },
				{ row: 4, col: 3 },
				{ row: 4, col: 4 }
			])
		).toEqual({ vital: { row: 3, col: 3 } });
		expect(
			isNakadeVulnerableRegion([
				{ row: 3, col: 3 },
				{ row: 3, col: 4 },
				{ row: 4, col: 3 },
				{ row: 4, col: 4 }
			])
		).toBeNull();
		expect(
			isLNakadeVulnerableRegion([
				{ row: 3, col: 3 },
				{ row: 3, col: 4 },
				{ row: 4, col: 3 },
				{ row: 4, col: 4 }
			])
		).toBeNull();
		const dead = findSquareNakadeDeadCells(g);
		expect(dead.length).toBe(xGroups[0]!.stones.length);
		expect(dead.every((p) => getCell(g, p) === "X")).toBe(true);
		expect(areaOutcome(g).winner).toBe("X");
		expect(
			areaOutcome(
				g,
				false,
				"rectangle",
				undefined,
				0,
				false,
				false,
				false,
				false,
				false,
				{ X: 0, O: 0 },
				false,
				false,
				false,
				false,
				false,
				false,
				false,
				true
			).winner
		).toBe("O");
		expect(
			areaOutcome(
				g,
				false,
				"rectangle",
				undefined,
				0,
				false,
				false,
				true
			).winner
		).toBe("X");
		expect(
			areaOutcome(
				g,
				false,
				"rectangle",
				undefined,
				0,
				false,
				false,
				false,
				false,
				false,
				{ X: 0, O: 0 },
				false,
				true
			).winner
		).toBe("X");
		expect(
			areaOutcome(
				g,
				false,
				"rectangle",
				undefined,
				0,
				false,
				false,
				false,
				false,
				false,
				{ X: 0, O: 0 },
				false,
				false,
				false,
				false,
				false,
				false,
				true
			).winner
		).toBe("X");
		const cleared = scoreArea(removeSquareNakadeDeadStones(g));
		expect(cleared.O).toBeGreaterThan(cleared.X);
		// Bent-3 is not square-4.
		expect(
			isSquareNakadeVulnerableRegion([
				{ row: 3, col: 4 },
				{ row: 4, col: 4 },
				{ row: 4, col: 3 }
			])
		).toBeNull();
		// Straight T1 is not square-4.
		expect(
			isSquareNakadeVulnerableRegion([
				{ row: 2, col: 4 },
				{ row: 3, col: 4 },
				{ row: 4, col: 4 }
			])
		).toBeNull();
	});

	it("go-lite-square-nakade: seeded double-pass O wins; without flag X wins; contrasts; replay faithful", () => {
		const cfg = examplePresets["go-lite-square-nakade"].config;
		const { kernel, gameConfig } = compileConfig(cfg);
		const script: KernelAction[] = [{ type: "pass" }, { type: "pass" }];
		let state = kernel.initialState(cfg.rng.seed);
		for (const action of script) {
			const result = kernel.stepSync(state, action);
			expect(result.events[0]?.type).toBe("actionApplied");
			state = result.nextState;
		}
		expect(state.status).toBe("won");
		expect(state.winner).toBe("O");
		expect(state.consecutivePasses).toBe(2);

		const without = structuredClone(cfg);
		without.objective = { mode: "area_control" };
		const baseline = compileConfig(without);
		let rawState = baseline.kernel.initialState(cfg.rng.seed);
		for (const action of script) {
			rawState = baseline.kernel.stepSync(rawState, action).nextState;
		}
		expect(rawState.status).toBe("won");
		expect(rawState.winner).toBe("X");

		for (const flag of [
			{ bensonLife: true },
			{ nakadeDeath: true },
			{ lNakadeDeath: true },
			{ pyramidNakadeDeath: true },
			{ twistedNakadeDeath: true },
			{ l4NakadeDeath: true },
			{ straight4NakadeDeath: true },
			{ semeaiDeath: true },
			{ netDeath: true },
			{ looseNetDeath: true },
			{ senteLadderDeath: true },
			{ approachNetDeath: true },
			{ ladderDeath: true },
			{ seki: true }
		] as const) {
			const alt = structuredClone(cfg);
			alt.objective = { mode: "area_control", ...flag };
			const altKernel = compileConfig(alt);
			let altState = altKernel.kernel.initialState(cfg.rng.seed);
			for (const action of script) {
				altState = altKernel.kernel.stepSync(altState, action).nextState;
			}
			expect(altState.winner).toBe("X");
		}

		const replay = replayActions(gameConfig, script, cfg.rng.seed);
		expect(replay.faithful).toBe(true);
		expect(replay.finalState.status).toBe("won");
		expect(replay.finalState.winner).toBe("O");
	});

	it("validates and compiles the go-lite-pyramid-nakade preset", () => {
		const cfg = examplePresets["go-lite-pyramid-nakade"].config;
		expect(validateConfig(cfg).ok).toBe(true);
		const { kernel, gameConfig } = compileConfig(cfg);
		expect(gameConfig.objectiveMode).toBe("area_control");
		expect(gameConfig.pyramidNakadeDeath).toBe(true);
		expect(gameConfig.captureMode).toBe("liberties");
		const state = kernel.initialState(cfg.rng.seed);
		expect(kernel.legalActions(state, 0).some((a) => a.type === "pass")).toBe(
			true
		);
	});

	it("rejects objective.pyramidNakadeDeath outside area_control", () => {
		const bad = structuredClone(examplePresets["tic-tac-toe"].config) as {
			objective: { mode: string; pyramidNakadeDeath?: boolean };
		};
		bad.objective = { mode: "n_in_a_row", pyramidNakadeDeath: true };
		expect(validateConfig(bad as never).ok).toBe(false);
	});

	it("findPyramidNakadeDeadCells: T corridor clears Benson-alive one-eyed shell; T1/L/square miss", () => {
		const cfg = examplePresets["go-lite-pyramid-nakade"].config;
		const { kernel } = compileConfig(cfg);
		const state = kernel.initialState(cfg.rng.seed);
		const g = state.grid;
		const xGroups = enumerateGroups(g).filter((gr) => gr.color === "X");
		expect(xGroups.length).toBe(1);
		expect(countTrueEyes(g, xGroups[0]!.stones, "X")).toBe(1);
		expect(findBensonAliveGroupIds(g, "X").size).toBe(1);
		expect(findDeadStoneCells(g).length).toBe(xGroups[0]!.stones.length);
		expect(findSemeaiDeadCells(g).length).toBe(0);
		expect(findNakadeDeadCells(g).every((p) => getCell(g, p) !== "X")).toBe(
			true
		);
		expect(findLNakadeDeadCells(g).every((p) => getCell(g, p) !== "X")).toBe(
			true
		);
		expect(
			findSquareNakadeDeadCells(g).every((p) => getCell(g, p) !== "X")
		).toBe(true);
		expect(
			findTwistedNakadeDeadCells(g).every((p) => getCell(g, p) !== "X")
		).toBe(true);
		expect(
			findNetDeadCells(g).every((p) => getCell(g, p) !== "X")
		).toBe(true);
		expect(
			findLooseNetDeadCells(g).every((p) => getCell(g, p) !== "X")
		).toBe(true);
		expect(
			findSenteLadderDeadCells(g).every((p) => getCell(g, p) !== "X")
		).toBe(true);
		expect(
			findApproachNetDeadCells(g).every((p) => getCell(g, p) !== "X")
		).toBe(true);
		expect(
			findLadderDeadCells(g).every((p) => getCell(g, p) !== "X")
		).toBe(true);
		expect(
			isPyramidNakadeVulnerableRegion([
				{ row: 3, col: 3 },
				{ row: 4, col: 2 },
				{ row: 4, col: 3 },
				{ row: 4, col: 4 }
			])
		).toEqual({ vital: { row: 4, col: 3 } });
		expect(
			isNakadeVulnerableRegion([
				{ row: 3, col: 3 },
				{ row: 4, col: 2 },
				{ row: 4, col: 3 },
				{ row: 4, col: 4 }
			])
		).toBeNull();
		expect(
			isLNakadeVulnerableRegion([
				{ row: 3, col: 3 },
				{ row: 4, col: 2 },
				{ row: 4, col: 3 },
				{ row: 4, col: 4 }
			])
		).toBeNull();
		expect(
			isSquareNakadeVulnerableRegion([
				{ row: 3, col: 3 },
				{ row: 4, col: 2 },
				{ row: 4, col: 3 },
				{ row: 4, col: 4 }
			])
		).toBeNull();
		const dead = findPyramidNakadeDeadCells(g);
		expect(dead.length).toBe(xGroups[0]!.stones.length);
		expect(dead.every((p) => getCell(g, p) === "X")).toBe(true);
		expect(areaOutcome(g).winner).toBe("X");
		expect(
			areaOutcome(
				g,
				false,
				"rectangle",
				undefined,
				0,
				false,
				false,
				false,
				false,
				false,
				{ X: 0, O: 0 },
				false,
				false,
				false,
				false,
				false,
				false,
				false,
				false,
				true
			).winner
		).toBe("O");
		expect(
			areaOutcome(
				g,
				false,
				"rectangle",
				undefined,
				0,
				false,
				false,
				true
			).winner
		).toBe("X");
		expect(
			areaOutcome(
				g,
				false,
				"rectangle",
				undefined,
				0,
				false,
				false,
				false,
				false,
				false,
				{ X: 0, O: 0 },
				false,
				true
			).winner
		).toBe("X");
		expect(
			areaOutcome(
				g,
				false,
				"rectangle",
				undefined,
				0,
				false,
				false,
				false,
				false,
				false,
				{ X: 0, O: 0 },
				false,
				false,
				false,
				false,
				false,
				false,
				true
			).winner
		).toBe("X");
		expect(
			areaOutcome(
				g,
				false,
				"rectangle",
				undefined,
				0,
				false,
				false,
				false,
				false,
				false,
				{ X: 0, O: 0 },
				false,
				false,
				false,
				false,
				false,
				false,
				false,
				true
			).winner
		).toBe("X");
		const cleared = scoreArea(removePyramidNakadeDeadStones(g));
		expect(cleared.O).toBeGreaterThan(cleared.X);
		// Square-4 is not pyramid-4.
		expect(
			isPyramidNakadeVulnerableRegion([
				{ row: 3, col: 3 },
				{ row: 3, col: 4 },
				{ row: 4, col: 3 },
				{ row: 4, col: 4 }
			])
		).toBeNull();
		// Bent-3 is not pyramid-4.
		expect(
			isPyramidNakadeVulnerableRegion([
				{ row: 3, col: 4 },
				{ row: 4, col: 4 },
				{ row: 4, col: 3 }
			])
		).toBeNull();
		// Straight T1 is not pyramid-4.
		expect(
			isPyramidNakadeVulnerableRegion([
				{ row: 2, col: 4 },
				{ row: 3, col: 4 },
				{ row: 4, col: 4 }
			])
		).toBeNull();
	});

	it("go-lite-pyramid-nakade: seeded double-pass O wins; without flag X wins; contrasts; replay faithful", () => {
		const cfg = examplePresets["go-lite-pyramid-nakade"].config;
		const { kernel, gameConfig } = compileConfig(cfg);
		const script: KernelAction[] = [{ type: "pass" }, { type: "pass" }];
		let state = kernel.initialState(cfg.rng.seed);
		for (const action of script) {
			const result = kernel.stepSync(state, action);
			expect(result.events[0]?.type).toBe("actionApplied");
			state = result.nextState;
		}
		expect(state.status).toBe("won");
		expect(state.winner).toBe("O");
		expect(state.consecutivePasses).toBe(2);

		const without = structuredClone(cfg);
		without.objective = { mode: "area_control" };
		const baseline = compileConfig(without);
		let rawState = baseline.kernel.initialState(cfg.rng.seed);
		for (const action of script) {
			rawState = baseline.kernel.stepSync(rawState, action).nextState;
		}
		expect(rawState.status).toBe("won");
		expect(rawState.winner).toBe("X");

		for (const flag of [
			{ bensonLife: true },
			{ nakadeDeath: true },
			{ lNakadeDeath: true },
			{ squareNakadeDeath: true },
			{ twistedNakadeDeath: true },
			{ l4NakadeDeath: true },
			{ straight4NakadeDeath: true },
			{ semeaiDeath: true },
			{ netDeath: true },
			{ looseNetDeath: true },
			{ senteLadderDeath: true },
			{ approachNetDeath: true },
			{ ladderDeath: true },
			{ seki: true }
		] as const) {
			const alt = structuredClone(cfg);
			alt.objective = { mode: "area_control", ...flag };
			const altKernel = compileConfig(alt);
			let altState = altKernel.kernel.initialState(cfg.rng.seed);
			for (const action of script) {
				altState = altKernel.kernel.stepSync(altState, action).nextState;
			}
			expect(altState.winner).toBe("X");
		}

		const replay = replayActions(gameConfig, script, cfg.rng.seed);
		expect(replay.faithful).toBe(true);
		expect(replay.finalState.status).toBe("won");
		expect(replay.finalState.winner).toBe("O");
	});

	it("validates and compiles the go-lite-twisted-nakade preset", () => {
		const cfg = examplePresets["go-lite-twisted-nakade"].config;
		expect(validateConfig(cfg).ok).toBe(true);
		const { kernel, gameConfig } = compileConfig(cfg);
		expect(gameConfig.objectiveMode).toBe("area_control");
		expect(gameConfig.twistedNakadeDeath).toBe(true);
		expect(gameConfig.captureMode).toBe("liberties");
		const state = kernel.initialState(cfg.rng.seed);
		expect(kernel.legalActions(state, 0).some((a) => a.type === "pass")).toBe(
			true
		);
	});

	it("rejects objective.twistedNakadeDeath outside area_control", () => {
		const bad = structuredClone(examplePresets["tic-tac-toe"].config) as {
			objective: { mode: string; twistedNakadeDeath?: boolean };
		};
		bad.objective = { mode: "n_in_a_row", twistedNakadeDeath: true };
		expect(validateConfig(bad as never).ok).toBe(false);
	});

	it("findTwistedNakadeDeadCells: Z corridor clears Benson-alive one-eyed shell; T1/L/square/pyramid miss", () => {
		const cfg = examplePresets["go-lite-twisted-nakade"].config;
		const { kernel } = compileConfig(cfg);
		const state = kernel.initialState(cfg.rng.seed);
		const g = state.grid;
		const xGroups = enumerateGroups(g).filter((gr) => gr.color === "X");
		expect(xGroups.length).toBe(1);
		expect(countTrueEyes(g, xGroups[0]!.stones, "X")).toBe(1);
		expect(findBensonAliveGroupIds(g, "X").size).toBe(1);
		expect(findDeadStoneCells(g).length).toBe(xGroups[0]!.stones.length);
		expect(findSemeaiDeadCells(g).length).toBe(0);
		expect(findNakadeDeadCells(g).every((p) => getCell(g, p) !== "X")).toBe(
			true
		);
		expect(findLNakadeDeadCells(g).every((p) => getCell(g, p) !== "X")).toBe(
			true
		);
		expect(
			findSquareNakadeDeadCells(g).every((p) => getCell(g, p) !== "X")
		).toBe(true);
		expect(
			findPyramidNakadeDeadCells(g).every((p) => getCell(g, p) !== "X")
		).toBe(true);
		expect(
			findNetDeadCells(g).every((p) => getCell(g, p) !== "X")
		).toBe(true);
		expect(
			findLooseNetDeadCells(g).every((p) => getCell(g, p) !== "X")
		).toBe(true);
		expect(
			findSenteLadderDeadCells(g).every((p) => getCell(g, p) !== "X")
		).toBe(true);
		expect(
			findApproachNetDeadCells(g).every((p) => getCell(g, p) !== "X")
		).toBe(true);
		expect(
			findLadderDeadCells(g).every((p) => getCell(g, p) !== "X")
		).toBe(true);
		expect(
			isTwistedNakadeVulnerableRegion([
				{ row: 3, col: 3 },
				{ row: 3, col: 4 },
				{ row: 4, col: 2 },
				{ row: 4, col: 3 }
			])
		).toEqual({ vital: { row: 3, col: 3 } });
		expect(
			isNakadeVulnerableRegion([
				{ row: 3, col: 3 },
				{ row: 3, col: 4 },
				{ row: 4, col: 2 },
				{ row: 4, col: 3 }
			])
		).toBeNull();
		expect(
			isLNakadeVulnerableRegion([
				{ row: 3, col: 3 },
				{ row: 3, col: 4 },
				{ row: 4, col: 2 },
				{ row: 4, col: 3 }
			])
		).toBeNull();
		expect(
			isSquareNakadeVulnerableRegion([
				{ row: 3, col: 3 },
				{ row: 3, col: 4 },
				{ row: 4, col: 2 },
				{ row: 4, col: 3 }
			])
		).toBeNull();
		expect(
			isPyramidNakadeVulnerableRegion([
				{ row: 3, col: 3 },
				{ row: 3, col: 4 },
				{ row: 4, col: 2 },
				{ row: 4, col: 3 }
			])
		).toBeNull();
		const dead = findTwistedNakadeDeadCells(g);
		expect(dead.length).toBe(xGroups[0]!.stones.length);
		expect(dead.every((p) => getCell(g, p) === "X")).toBe(true);
		expect(areaOutcome(g).winner).toBe("X");
		expect(
			areaOutcome(
				g,
				false,
				"rectangle",
				undefined,
				0,
				false,
				false,
				false,
				false,
				false,
				{ X: 0, O: 0 },
				false,
				false,
				false,
				false,
				false,
				false,
				false,
				false,
				false,
				true
			).winner
		).toBe("O");
		expect(
			areaOutcome(
				g,
				false,
				"rectangle",
				undefined,
				0,
				false,
				false,
				true
			).winner
		).toBe("X");
		expect(
			areaOutcome(
				g,
				false,
				"rectangle",
				undefined,
				0,
				false,
				false,
				false,
				false,
				false,
				{ X: 0, O: 0 },
				false,
				false,
				false,
				false,
				false,
				false,
				false,
				false,
				true
			).winner
		).toBe("X");
		const cleared = scoreArea(removeTwistedNakadeDeadStones(g));
		expect(cleared.O).toBeGreaterThan(cleared.X);
		// Square-4 is not twisted-4.
		expect(
			isTwistedNakadeVulnerableRegion([
				{ row: 3, col: 3 },
				{ row: 3, col: 4 },
				{ row: 4, col: 3 },
				{ row: 4, col: 4 }
			])
		).toBeNull();
		// Pyramid-4 T is not twisted-4.
		expect(
			isTwistedNakadeVulnerableRegion([
				{ row: 3, col: 3 },
				{ row: 4, col: 2 },
				{ row: 4, col: 3 },
				{ row: 4, col: 4 }
			])
		).toBeNull();
		// L4 (same-side bbox holes) is not twisted-4.
		expect(
			isTwistedNakadeVulnerableRegion([
				{ row: 3, col: 4 },
				{ row: 4, col: 2 },
				{ row: 4, col: 3 },
				{ row: 4, col: 4 }
			])
		).toBeNull();
		expect(
			isL4NakadeVulnerableRegion([
				{ row: 3, col: 4 },
				{ row: 4, col: 2 },
				{ row: 4, col: 3 },
				{ row: 4, col: 4 }
			])
		).toEqual({ vital: { row: 4, col: 3 } });
		// Straight T1 is not twisted-4.
		expect(
			isTwistedNakadeVulnerableRegion([
				{ row: 2, col: 4 },
				{ row: 3, col: 4 },
				{ row: 4, col: 4 }
			])
		).toBeNull();
	});

	it("go-lite-twisted-nakade: seeded double-pass O wins; without flag X wins; contrasts; replay faithful", () => {
		const cfg = examplePresets["go-lite-twisted-nakade"].config;
		const { kernel, gameConfig } = compileConfig(cfg);
		const script: KernelAction[] = [{ type: "pass" }, { type: "pass" }];
		let state = kernel.initialState(cfg.rng.seed);
		for (const action of script) {
			const result = kernel.stepSync(state, action);
			expect(result.events[0]?.type).toBe("actionApplied");
			state = result.nextState;
		}
		expect(state.status).toBe("won");
		expect(state.winner).toBe("O");
		expect(state.consecutivePasses).toBe(2);

		const without = structuredClone(cfg);
		without.objective = { mode: "area_control" };
		const baseline = compileConfig(without);
		let rawState = baseline.kernel.initialState(cfg.rng.seed);
		for (const action of script) {
			rawState = baseline.kernel.stepSync(rawState, action).nextState;
		}
		expect(rawState.status).toBe("won");
		expect(rawState.winner).toBe("X");

		for (const flag of [
			{ bensonLife: true },
			{ nakadeDeath: true },
			{ lNakadeDeath: true },
			{ squareNakadeDeath: true },
			{ pyramidNakadeDeath: true },
			{ l4NakadeDeath: true },
			{ straight4NakadeDeath: true },
			{ semeaiDeath: true },
			{ netDeath: true },
			{ looseNetDeath: true },
			{ senteLadderDeath: true },
			{ approachNetDeath: true },
			{ ladderDeath: true },
			{ seki: true }
		] as const) {
			const alt = structuredClone(cfg);
			alt.objective = { mode: "area_control", ...flag };
			const altKernel = compileConfig(alt);
			let altState = altKernel.kernel.initialState(cfg.rng.seed);
			for (const action of script) {
				altState = altKernel.kernel.stepSync(altState, action).nextState;
			}
			expect(altState.winner).toBe("X");
		}

		const replay = replayActions(gameConfig, script, cfg.rng.seed);
		expect(replay.faithful).toBe(true);
		expect(replay.finalState.status).toBe("won");
		expect(replay.finalState.winner).toBe("O");
	});

	it("validates and compiles the go-lite-l4-nakade preset", () => {
		const cfg = examplePresets["go-lite-l4-nakade"].config;
		expect(validateConfig(cfg).ok).toBe(true);
		const { kernel, gameConfig } = compileConfig(cfg);
		expect(gameConfig.objectiveMode).toBe("area_control");
		expect(gameConfig.l4NakadeDeath).toBe(true);
		expect(gameConfig.captureMode).toBe("liberties");
		const state = kernel.initialState(cfg.rng.seed);
		expect(kernel.legalActions(state, 0).some((a) => a.type === "pass")).toBe(
			true
		);
	});

	it("rejects objective.l4NakadeDeath outside area_control", () => {
		const bad = structuredClone(examplePresets["tic-tac-toe"].config) as {
			objective: { mode: string; l4NakadeDeath?: boolean };
		};
		bad.objective = { mode: "n_in_a_row", l4NakadeDeath: true };
		expect(validateConfig(bad as never).ok).toBe(false);
	});

	it("findL4NakadeDeadCells: L corridor clears Benson-alive one-eyed shell; T1/L/square/pyramid/twisted miss", () => {
		const cfg = examplePresets["go-lite-l4-nakade"].config;
		const { kernel } = compileConfig(cfg);
		const state = kernel.initialState(cfg.rng.seed);
		const g = state.grid;
		const xGroups = enumerateGroups(g).filter((gr) => gr.color === "X");
		expect(xGroups.length).toBe(1);
		expect(countTrueEyes(g, xGroups[0]!.stones, "X")).toBe(1);
		expect(findBensonAliveGroupIds(g, "X").size).toBe(1);
		expect(findDeadStoneCells(g).length).toBe(xGroups[0]!.stones.length);
		expect(findSemeaiDeadCells(g).length).toBe(0);
		expect(findNakadeDeadCells(g).every((p) => getCell(g, p) !== "X")).toBe(
			true
		);
		expect(findLNakadeDeadCells(g).every((p) => getCell(g, p) !== "X")).toBe(
			true
		);
		expect(
			findSquareNakadeDeadCells(g).every((p) => getCell(g, p) !== "X")
		).toBe(true);
		expect(
			findPyramidNakadeDeadCells(g).every((p) => getCell(g, p) !== "X")
		).toBe(true);
		expect(
			findTwistedNakadeDeadCells(g).every((p) => getCell(g, p) !== "X")
		).toBe(true);
		expect(
			findNetDeadCells(g).every((p) => getCell(g, p) !== "X")
		).toBe(true);
		expect(
			findLooseNetDeadCells(g).every((p) => getCell(g, p) !== "X")
		).toBe(true);
		expect(
			findSenteLadderDeadCells(g).every((p) => getCell(g, p) !== "X")
		).toBe(true);
		expect(
			findApproachNetDeadCells(g).every((p) => getCell(g, p) !== "X")
		).toBe(true);
		expect(
			findLadderDeadCells(g).every((p) => getCell(g, p) !== "X")
		).toBe(true);
		expect(
			isL4NakadeVulnerableRegion([
				{ row: 3, col: 4 },
				{ row: 4, col: 2 },
				{ row: 4, col: 3 },
				{ row: 4, col: 4 }
			])
		).toEqual({ vital: { row: 4, col: 3 } });
		expect(
			isNakadeVulnerableRegion([
				{ row: 3, col: 4 },
				{ row: 4, col: 2 },
				{ row: 4, col: 3 },
				{ row: 4, col: 4 }
			])
		).toBeNull();
		expect(
			isLNakadeVulnerableRegion([
				{ row: 3, col: 4 },
				{ row: 4, col: 2 },
				{ row: 4, col: 3 },
				{ row: 4, col: 4 }
			])
		).toBeNull();
		expect(
			isSquareNakadeVulnerableRegion([
				{ row: 3, col: 4 },
				{ row: 4, col: 2 },
				{ row: 4, col: 3 },
				{ row: 4, col: 4 }
			])
		).toBeNull();
		expect(
			isPyramidNakadeVulnerableRegion([
				{ row: 3, col: 4 },
				{ row: 4, col: 2 },
				{ row: 4, col: 3 },
				{ row: 4, col: 4 }
			])
		).toBeNull();
		expect(
			isTwistedNakadeVulnerableRegion([
				{ row: 3, col: 4 },
				{ row: 4, col: 2 },
				{ row: 4, col: 3 },
				{ row: 4, col: 4 }
			])
		).toBeNull();
		const dead = findL4NakadeDeadCells(g);
		expect(dead.length).toBe(xGroups[0]!.stones.length);
		expect(dead.every((p) => getCell(g, p) === "X")).toBe(true);
		expect(areaOutcome(g).winner).toBe("X");
		expect(
			areaOutcome(
				g,
				false,
				"rectangle",
				undefined,
				0,
				false,
				false,
				false,
				false,
				false,
				{ X: 0, O: 0 },
				false,
				false,
				false,
				false,
				false,
				false,
				false,
				false,
				false,
				false,
				true
			).winner
		).toBe("O");
		expect(
			areaOutcome(
				g,
				false,
				"rectangle",
				undefined,
				0,
				false,
				false,
				true
			).winner
		).toBe("X");
		expect(
			areaOutcome(
				g,
				false,
				"rectangle",
				undefined,
				0,
				false,
				false,
				false,
				false,
				false,
				{ X: 0, O: 0 },
				false,
				false,
				false,
				false,
				false,
				false,
				false,
				false,
				false,
				true
			).winner
		).toBe("X");
		const cleared = scoreArea(removeL4NakadeDeadStones(g));
		expect(cleared.O).toBeGreaterThan(cleared.X);
		// Twisted-4 Z is not L4.
		expect(
			isL4NakadeVulnerableRegion([
				{ row: 3, col: 3 },
				{ row: 3, col: 4 },
				{ row: 4, col: 2 },
				{ row: 4, col: 3 }
			])
		).toBeNull();
		// Square-4 is not L4.
		expect(
			isL4NakadeVulnerableRegion([
				{ row: 3, col: 3 },
				{ row: 3, col: 4 },
				{ row: 4, col: 3 },
				{ row: 4, col: 4 }
			])
		).toBeNull();
		// Pyramid-4 T is not L4.
		expect(
			isL4NakadeVulnerableRegion([
				{ row: 3, col: 3 },
				{ row: 4, col: 2 },
				{ row: 4, col: 3 },
				{ row: 4, col: 4 }
			])
		).toBeNull();
		// Straight T1 is not L4.
		expect(
			isL4NakadeVulnerableRegion([
				{ row: 2, col: 4 },
				{ row: 3, col: 4 },
				{ row: 4, col: 4 }
			])
		).toBeNull();
	});

	it("go-lite-l4-nakade: seeded double-pass O wins; without flag X wins; contrasts; replay faithful", () => {
		const cfg = examplePresets["go-lite-l4-nakade"].config;
		const { kernel, gameConfig } = compileConfig(cfg);
		const script: KernelAction[] = [{ type: "pass" }, { type: "pass" }];
		let state = kernel.initialState(cfg.rng.seed);
		for (const action of script) {
			const result = kernel.stepSync(state, action);
			expect(result.events[0]?.type).toBe("actionApplied");
			state = result.nextState;
		}
		expect(state.status).toBe("won");
		expect(state.winner).toBe("O");
		expect(state.consecutivePasses).toBe(2);

		const without = structuredClone(cfg);
		without.objective = { mode: "area_control" };
		const baseline = compileConfig(without);
		let rawState = baseline.kernel.initialState(cfg.rng.seed);
		for (const action of script) {
			rawState = baseline.kernel.stepSync(rawState, action).nextState;
		}
		expect(rawState.status).toBe("won");
		expect(rawState.winner).toBe("X");

		for (const flag of [
			{ bensonLife: true },
			{ nakadeDeath: true },
			{ lNakadeDeath: true },
			{ squareNakadeDeath: true },
			{ pyramidNakadeDeath: true },
			{ twistedNakadeDeath: true },
			{ straight4NakadeDeath: true },
			{ semeaiDeath: true },
			{ netDeath: true },
			{ looseNetDeath: true },
			{ senteLadderDeath: true },
			{ approachNetDeath: true },
			{ ladderDeath: true },
			{ seki: true }
		] as const) {
			const alt = structuredClone(cfg);
			alt.objective = { mode: "area_control", ...flag };
			const altKernel = compileConfig(alt);
			let altState = altKernel.kernel.initialState(cfg.rng.seed);
			for (const action of script) {
				altState = altKernel.kernel.stepSync(altState, action).nextState;
			}
			expect(altState.winner).toBe("X");
		}

		const replay = replayActions(gameConfig, script, cfg.rng.seed);
		expect(replay.faithful).toBe(true);
		expect(replay.finalState.status).toBe("won");
		expect(replay.finalState.winner).toBe("O");
	});

	it("validates and compiles the go-lite-straight4-nakade preset", () => {
		const cfg = examplePresets["go-lite-straight4-nakade"].config;
		expect(validateConfig(cfg).ok).toBe(true);
		const { kernel, gameConfig } = compileConfig(cfg);
		expect(gameConfig.objectiveMode).toBe("area_control");
		expect(gameConfig.straight4NakadeDeath).toBe(true);
		expect(gameConfig.captureMode).toBe("liberties");
		const state = kernel.initialState(cfg.rng.seed);
		expect(kernel.legalActions(state, 0).some((a) => a.type === "pass")).toBe(
			true
		);
	});

	it("rejects objective.straight4NakadeDeath outside area_control", () => {
		const bad = structuredClone(examplePresets["tic-tac-toe"].config) as {
			objective: { mode: string; straight4NakadeDeath?: boolean };
		};
		bad.objective = { mode: "n_in_a_row", straight4NakadeDeath: true };
		expect(validateConfig(bad as never).ok).toBe(false);
	});

	it("findStraight4NakadeDeadCells: I corridor clears Benson-alive one-eyed shell; prior nakade + chase miss", () => {
		const cfg = examplePresets["go-lite-straight4-nakade"].config;
		const { kernel } = compileConfig(cfg);
		const state = kernel.initialState(cfg.rng.seed);
		const g = state.grid;
		const xGroups = enumerateGroups(g).filter((gr) => gr.color === "X");
		expect(xGroups.length).toBe(1);
		expect(countTrueEyes(g, xGroups[0]!.stones, "X")).toBe(1);
		expect(findBensonAliveGroupIds(g, "X").size).toBe(1);
		expect(findDeadStoneCells(g).length).toBe(xGroups[0]!.stones.length);
		expect(findSemeaiDeadCells(g).length).toBe(0);
		expect(findNakadeDeadCells(g).every((p) => getCell(g, p) !== "X")).toBe(
			true
		);
		expect(findLNakadeDeadCells(g).every((p) => getCell(g, p) !== "X")).toBe(
			true
		);
		expect(
			findSquareNakadeDeadCells(g).every((p) => getCell(g, p) !== "X")
		).toBe(true);
		expect(
			findPyramidNakadeDeadCells(g).every((p) => getCell(g, p) !== "X")
		).toBe(true);
		expect(
			findTwistedNakadeDeadCells(g).every((p) => getCell(g, p) !== "X")
		).toBe(true);
		expect(
			findL4NakadeDeadCells(g).every((p) => getCell(g, p) !== "X")
		).toBe(true);
		expect(
			findNetDeadCells(g).every((p) => getCell(g, p) !== "X")
		).toBe(true);
		expect(
			findLooseNetDeadCells(g).every((p) => getCell(g, p) !== "X")
		).toBe(true);
		expect(
			findSenteLadderDeadCells(g).every((p) => getCell(g, p) !== "X")
		).toBe(true);
		expect(
			findApproachNetDeadCells(g).every((p) => getCell(g, p) !== "X")
		).toBe(true);
		expect(
			findLadderDeadCells(g).every((p) => getCell(g, p) !== "X")
		).toBe(true);
		const I = [
			{ row: 2, col: 2 },
			{ row: 3, col: 2 },
			{ row: 4, col: 2 },
			{ row: 5, col: 2 }
		];
		expect(isStraight4NakadeVulnerableRegion(I)).toEqual({
			vital: { row: 3, col: 2 }
		});
		expect(isNakadeVulnerableRegion(I)).toBeNull();
		expect(isLNakadeVulnerableRegion(I)).toBeNull();
		expect(isSquareNakadeVulnerableRegion(I)).toBeNull();
		expect(isPyramidNakadeVulnerableRegion(I)).toBeNull();
		expect(isTwistedNakadeVulnerableRegion(I)).toBeNull();
		expect(isL4NakadeVulnerableRegion(I)).toBeNull();
		const dead = findStraight4NakadeDeadCells(g);
		expect(dead.length).toBe(xGroups[0]!.stones.length);
		expect(dead.every((p) => getCell(g, p) === "X")).toBe(true);
		expect(areaOutcome(g).winner).toBe("X");
		expect(
			areaOutcome(
				g,
				false,
				"rectangle",
				undefined,
				0,
				false,
				false,
				false,
				false,
				false,
				{ X: 0, O: 0 },
				false,
				false,
				false,
				false,
				false,
				false,
				false,
				false,
				false,
				false,
				false,
				true
			).winner
		).toBe("O");
		// l4NakadeDeath alone leaves X
		expect(
			areaOutcome(
				g,
				false,
				"rectangle",
				undefined,
				0,
				false,
				false,
				false,
				false,
				false,
				{ X: 0, O: 0 },
				false,
				false,
				false,
				false,
				false,
				false,
				false,
				false,
				false,
				false,
				true,
				false
			).winner
		).toBe("X");
		const cleared = scoreArea(removeStraight4NakadeDeadStones(g));
		expect(cleared.O).toBeGreaterThan(cleared.X);
		// L4 is not straight-4
		expect(
			isStraight4NakadeVulnerableRegion([
				{ row: 3, col: 4 },
				{ row: 4, col: 2 },
				{ row: 4, col: 3 },
				{ row: 4, col: 4 }
			])
		).toBeNull();
		// Square-4 is not straight-4
		expect(
			isStraight4NakadeVulnerableRegion([
				{ row: 3, col: 3 },
				{ row: 3, col: 4 },
				{ row: 4, col: 3 },
				{ row: 4, col: 4 }
			])
		).toBeNull();
		// T1 length-3 is not straight-4
		expect(
			isStraight4NakadeVulnerableRegion([
				{ row: 2, col: 4 },
				{ row: 3, col: 4 },
				{ row: 4, col: 4 }
			])
		).toBeNull();
		// Horizontal I also matches
		expect(
			isStraight4NakadeVulnerableRegion([
				{ row: 2, col: 1 },
				{ row: 2, col: 2 },
				{ row: 2, col: 3 },
				{ row: 2, col: 4 }
			])
		).toEqual({ vital: { row: 2, col: 2 } });
	});

	it("go-lite-straight4-nakade: seeded double-pass O wins; without flag X wins; contrasts; replay faithful", () => {
		const cfg = examplePresets["go-lite-straight4-nakade"].config;
		const { kernel, gameConfig } = compileConfig(cfg);
		const script: KernelAction[] = [{ type: "pass" }, { type: "pass" }];
		let state = kernel.initialState(cfg.rng.seed);
		for (const action of script) {
			const result = kernel.stepSync(state, action);
			expect(result.events[0]?.type).toBe("actionApplied");
			state = result.nextState;
		}
		expect(state.status).toBe("won");
		expect(state.winner).toBe("O");
		expect(state.consecutivePasses).toBe(2);

		const without = structuredClone(cfg);
		without.objective = { mode: "area_control" };
		const baseline = compileConfig(without);
		let rawState = baseline.kernel.initialState(cfg.rng.seed);
		for (const action of script) {
			rawState = baseline.kernel.stepSync(rawState, action).nextState;
		}
		expect(rawState.status).toBe("won");
		expect(rawState.winner).toBe("X");

		for (const flag of [
			{ bensonLife: true },
			{ nakadeDeath: true },
			{ lNakadeDeath: true },
			{ squareNakadeDeath: true },
			{ pyramidNakadeDeath: true },
			{ twistedNakadeDeath: true },
			{ l4NakadeDeath: true },
			{ semeaiDeath: true },
			{ netDeath: true },
			{ looseNetDeath: true },
			{ senteLadderDeath: true },
			{ approachNetDeath: true },
			{ ladderDeath: true },
			{ seki: true }
		] as const) {
			const alt = structuredClone(cfg);
			alt.objective = { mode: "area_control", ...flag };
			const altKernel = compileConfig(alt);
			let altState = altKernel.kernel.initialState(cfg.rng.seed);
			for (const action of script) {
				altState = altKernel.kernel.stepSync(altState, action).nextState;
			}
			expect(altState.winner).toBe("X");
		}

		const replay = replayActions(gameConfig, script, cfg.rng.seed);
		expect(replay.faithful).toBe(true);
		expect(replay.finalState.status).toBe("won");
		expect(replay.finalState.winner).toBe("O");
	});

	it("validates and compiles the go-lite-bulky5-nakade preset", () => {
		const cfg = examplePresets["go-lite-bulky5-nakade"].config;
		expect(validateConfig(cfg).ok).toBe(true);
		const { kernel, gameConfig } = compileConfig(cfg);
		expect(gameConfig.objectiveMode).toBe("area_control");
		expect(gameConfig.bulky5NakadeDeath).toBe(true);
		expect(gameConfig.captureMode).toBe("liberties");
		const state = kernel.initialState(cfg.rng.seed);
		expect(kernel.legalActions(state, 0).some((a) => a.type === "pass")).toBe(
			true
		);
	});

	it("rejects objective.bulky5NakadeDeath outside area_control", () => {
		const bad = structuredClone(examplePresets["tic-tac-toe"].config) as {
			objective: { mode: string; bulky5NakadeDeath?: boolean };
		};
		bad.objective = { mode: "n_in_a_row", bulky5NakadeDeath: true };
		expect(validateConfig(bad as never).ok).toBe(false);
	});

	it("findBulky5NakadeDeadCells: P corridor clears Benson-alive one-eyed shell; prior nakade + chase miss", () => {
		const cfg = examplePresets["go-lite-bulky5-nakade"].config;
		const { kernel } = compileConfig(cfg);
		const state = kernel.initialState(cfg.rng.seed);
		const g = state.grid;
		const xGroups = enumerateGroups(g).filter((gr) => gr.color === "X");
		expect(xGroups.length).toBe(1);
		expect(countTrueEyes(g, xGroups[0]!.stones, "X")).toBe(1);
		expect(findBensonAliveGroupIds(g, "X").size).toBe(1);
		expect(findDeadStoneCells(g).length).toBe(xGroups[0]!.stones.length);
		expect(findSemeaiDeadCells(g).length).toBe(0);
		expect(findNakadeDeadCells(g).every((p) => getCell(g, p) !== "X")).toBe(
			true
		);
		expect(findLNakadeDeadCells(g).every((p) => getCell(g, p) !== "X")).toBe(
			true
		);
		expect(
			findSquareNakadeDeadCells(g).every((p) => getCell(g, p) !== "X")
		).toBe(true);
		expect(
			findPyramidNakadeDeadCells(g).every((p) => getCell(g, p) !== "X")
		).toBe(true);
		expect(
			findTwistedNakadeDeadCells(g).every((p) => getCell(g, p) !== "X")
		).toBe(true);
		expect(
			findL4NakadeDeadCells(g).every((p) => getCell(g, p) !== "X")
		).toBe(true);
		expect(
			findStraight4NakadeDeadCells(g).every((p) => getCell(g, p) !== "X")
		).toBe(true);
		expect(
			findNetDeadCells(g).every((p) => getCell(g, p) !== "X")
		).toBe(true);
		expect(
			findLooseNetDeadCells(g).every((p) => getCell(g, p) !== "X")
		).toBe(true);
		expect(
			findSenteLadderDeadCells(g).every((p) => getCell(g, p) !== "X")
		).toBe(true);
		expect(
			findApproachNetDeadCells(g).every((p) => getCell(g, p) !== "X")
		).toBe(true);
		expect(
			findLadderDeadCells(g).every((p) => getCell(g, p) !== "X")
		).toBe(true);
		const P = [
			{ row: 2, col: 2 },
			{ row: 2, col: 3 },
			{ row: 2, col: 4 },
			{ row: 3, col: 2 },
			{ row: 3, col: 3 }
		];
		expect(isBulky5NakadeVulnerableRegion(P)).toEqual({
			vital: { row: 2, col: 3 }
		});
		expect(isNakadeVulnerableRegion(P)).toBeNull();
		expect(isLNakadeVulnerableRegion(P)).toBeNull();
		expect(isSquareNakadeVulnerableRegion(P)).toBeNull();
		expect(isPyramidNakadeVulnerableRegion(P)).toBeNull();
		expect(isTwistedNakadeVulnerableRegion(P)).toBeNull();
		expect(isL4NakadeVulnerableRegion(P)).toBeNull();
		expect(isStraight4NakadeVulnerableRegion(P)).toBeNull();
		const dead = findBulky5NakadeDeadCells(g);
		expect(dead.length).toBe(xGroups[0]!.stones.length);
		expect(dead.every((p) => getCell(g, p) === "X")).toBe(true);
		expect(areaOutcome(g).winner).toBe("X");
		expect(
			areaOutcome(
				g,
				false,
				"rectangle",
				undefined,
				0,
				false,
				false,
				false,
				false,
				false,
				{ X: 0, O: 0 },
				false,
				false,
				false,
				false,
				false,
				false,
				false,
				false,
				false,
				false,
				false,
				false,
				true
			).winner
		).toBe("O");
		// straight4NakadeDeath alone leaves X
		expect(
			areaOutcome(
				g,
				false,
				"rectangle",
				undefined,
				0,
				false,
				false,
				false,
				false,
				false,
				{ X: 0, O: 0 },
				false,
				false,
				false,
				false,
				false,
				false,
				false,
				false,
				false,
				false,
				false,
				true,
				false
			).winner
		).toBe("X");
		const cleared = scoreArea(removeBulky5NakadeDeadStones(g));
		expect(cleared.O).toBeGreaterThan(cleared.X);
		// U (edge-middle hole) is not bulky-5 P
		expect(
			isBulky5NakadeVulnerableRegion([
				{ row: 2, col: 2 },
				{ row: 2, col: 3 },
				{ row: 2, col: 4 },
				{ row: 3, col: 2 },
				{ row: 3, col: 4 }
			])
		).toBeNull();
		// Straight-4 is not bulky-5
		expect(
			isBulky5NakadeVulnerableRegion([
				{ row: 2, col: 2 },
				{ row: 3, col: 2 },
				{ row: 4, col: 2 },
				{ row: 5, col: 2 },
				{ row: 2, col: 3 }
			])
		).toBeNull();
		// L4 is not bulky-5
		expect(
			isBulky5NakadeVulnerableRegion([
				{ row: 3, col: 4 },
				{ row: 4, col: 2 },
				{ row: 4, col: 3 },
				{ row: 4, col: 4 }
			])
		).toBeNull();
		// Rotated P (3×2 minus corner) also matches
		expect(
			isBulky5NakadeVulnerableRegion([
				{ row: 2, col: 2 },
				{ row: 3, col: 2 },
				{ row: 4, col: 2 },
				{ row: 2, col: 3 },
				{ row: 3, col: 3 }
			])
		).toEqual({ vital: { row: 3, col: 2 } });
	});

	it("go-lite-bulky5-nakade: seeded double-pass O wins; without flag X wins; contrasts; replay faithful", () => {
		const cfg = examplePresets["go-lite-bulky5-nakade"].config;
		const { kernel, gameConfig } = compileConfig(cfg);
		const script: KernelAction[] = [{ type: "pass" }, { type: "pass" }];
		let state = kernel.initialState(cfg.rng.seed);
		for (const action of script) {
			const result = kernel.stepSync(state, action);
			expect(result.events[0]?.type).toBe("actionApplied");
			state = result.nextState;
		}
		expect(state.status).toBe("won");
		expect(state.winner).toBe("O");
		expect(state.consecutivePasses).toBe(2);

		const without = structuredClone(cfg);
		without.objective = { mode: "area_control" };
		const baseline = compileConfig(without);
		let rawState = baseline.kernel.initialState(cfg.rng.seed);
		for (const action of script) {
			rawState = baseline.kernel.stepSync(rawState, action).nextState;
		}
		expect(rawState.status).toBe("won");
		expect(rawState.winner).toBe("X");

		for (const flag of [
			{ bensonLife: true },
			{ nakadeDeath: true },
			{ lNakadeDeath: true },
			{ squareNakadeDeath: true },
			{ pyramidNakadeDeath: true },
			{ twistedNakadeDeath: true },
			{ l4NakadeDeath: true },
			{ straight4NakadeDeath: true },
			{ plusNakadeDeath: true },
			{ semeaiDeath: true },
			{ netDeath: true },
			{ looseNetDeath: true },
			{ senteLadderDeath: true },
			{ approachNetDeath: true },
			{ ladderDeath: true },
			{ seki: true }
		] as const) {
			const alt = structuredClone(cfg);
			alt.objective = { mode: "area_control", ...flag };
			const altKernel = compileConfig(alt);
			let altState = altKernel.kernel.initialState(cfg.rng.seed);
			for (const action of script) {
				altState = altKernel.kernel.stepSync(altState, action).nextState;
			}
			expect(altState.winner).toBe("X");
		}

		const replay = replayActions(gameConfig, script, cfg.rng.seed);
		expect(replay.faithful).toBe(true);
		expect(replay.finalState.status).toBe("won");
		expect(replay.finalState.winner).toBe("O");
	});

	it("validates and compiles the go-lite-plus-nakade preset", () => {
		const cfg = examplePresets["go-lite-plus-nakade"].config;
		expect(validateConfig(cfg).ok).toBe(true);
		const { kernel, gameConfig } = compileConfig(cfg);
		expect(gameConfig.objectiveMode).toBe("area_control");
		expect(gameConfig.plusNakadeDeath).toBe(true);
		expect(gameConfig.captureMode).toBe("liberties");
		const state = kernel.initialState(cfg.rng.seed);
		expect(kernel.legalActions(state, 0).some((a) => a.type === "pass")).toBe(
			true
		);
	});

	it("rejects objective.plusNakadeDeath outside area_control", () => {
		const bad = structuredClone(examplePresets["tic-tac-toe"].config) as {
			objective: { mode: string; plusNakadeDeath?: boolean };
		};
		bad.objective = { mode: "n_in_a_row", plusNakadeDeath: true };
		expect(validateConfig(bad as never).ok).toBe(false);
	});

	it("findPlusNakadeDeadCells: plus corridor clears Benson-alive one-eyed shell; prior nakade + chase miss", () => {
		const cfg = examplePresets["go-lite-plus-nakade"].config;
		const { kernel } = compileConfig(cfg);
		const state = kernel.initialState(cfg.rng.seed);
		const g = state.grid;
		const xGroups = enumerateGroups(g).filter((gr) => gr.color === "X");
		expect(xGroups.length).toBe(1);
		expect(countTrueEyes(g, xGroups[0]!.stones, "X")).toBe(1);
		expect(findBensonAliveGroupIds(g, "X").size).toBe(1);
		expect(findDeadStoneCells(g).length).toBe(xGroups[0]!.stones.length);
		expect(findSemeaiDeadCells(g).length).toBe(0);
		expect(findNakadeDeadCells(g).every((p) => getCell(g, p) !== "X")).toBe(
			true
		);
		expect(findLNakadeDeadCells(g).every((p) => getCell(g, p) !== "X")).toBe(
			true
		);
		expect(
			findSquareNakadeDeadCells(g).every((p) => getCell(g, p) !== "X")
		).toBe(true);
		expect(
			findPyramidNakadeDeadCells(g).every((p) => getCell(g, p) !== "X")
		).toBe(true);
		expect(
			findTwistedNakadeDeadCells(g).every((p) => getCell(g, p) !== "X")
		).toBe(true);
		expect(
			findL4NakadeDeadCells(g).every((p) => getCell(g, p) !== "X")
		).toBe(true);
		expect(
			findStraight4NakadeDeadCells(g).every((p) => getCell(g, p) !== "X")
		).toBe(true);
		expect(
			findBulky5NakadeDeadCells(g).every((p) => getCell(g, p) !== "X")
		).toBe(true);
		expect(
			findNetDeadCells(g).every((p) => getCell(g, p) !== "X")
		).toBe(true);
		expect(
			findLooseNetDeadCells(g).every((p) => getCell(g, p) !== "X")
		).toBe(true);
		expect(
			findSenteLadderDeadCells(g).every((p) => getCell(g, p) !== "X")
		).toBe(true);
		expect(
			findApproachNetDeadCells(g).every((p) => getCell(g, p) !== "X")
		).toBe(true);
		expect(
			findLadderDeadCells(g).every((p) => getCell(g, p) !== "X")
		).toBe(true);
		const plus = [
			{ row: 2, col: 3 },
			{ row: 3, col: 2 },
			{ row: 3, col: 3 },
			{ row: 3, col: 4 },
			{ row: 4, col: 3 }
		];
		expect(isPlusNakadeVulnerableRegion(plus)).toEqual({
			vital: { row: 3, col: 3 }
		});
		expect(isNakadeVulnerableRegion(plus)).toBeNull();
		expect(isLNakadeVulnerableRegion(plus)).toBeNull();
		expect(isSquareNakadeVulnerableRegion(plus)).toBeNull();
		expect(isPyramidNakadeVulnerableRegion(plus)).toBeNull();
		expect(isTwistedNakadeVulnerableRegion(plus)).toBeNull();
		expect(isL4NakadeVulnerableRegion(plus)).toBeNull();
		expect(isStraight4NakadeVulnerableRegion(plus)).toBeNull();
		expect(isBulky5NakadeVulnerableRegion(plus)).toBeNull();
		const dead = findPlusNakadeDeadCells(g);
		expect(dead.length).toBe(xGroups[0]!.stones.length);
		expect(dead.every((p) => getCell(g, p) === "X")).toBe(true);
		expect(areaOutcome(g).winner).toBe("X");
		expect(
			areaOutcome(
				g,
				false,
				"rectangle",
				undefined,
				0,
				false,
				false,
				false,
				false,
				false,
				{ X: 0, O: 0 },
				false,
				false,
				false,
				false,
				false,
				false,
				false,
				false,
				false,
				false,
				false,
				false,
				false,
				true
			).winner
		).toBe("O");
		// bulky5NakadeDeath alone leaves X
		expect(
			areaOutcome(
				g,
				false,
				"rectangle",
				undefined,
				0,
				false,
				false,
				false,
				false,
				false,
				{ X: 0, O: 0 },
				false,
				false,
				false,
				false,
				false,
				false,
				false,
				false,
				false,
				false,
				false,
				false,
				true,
				false
			).winner
		).toBe("X");
		const cleared = scoreArea(removePlusNakadeDeadStones(g));
		expect(cleared.O).toBeGreaterThan(cleared.X);
		// Bulky-5 P is not plus
		expect(
			isPlusNakadeVulnerableRegion([
				{ row: 2, col: 2 },
				{ row: 2, col: 3 },
				{ row: 2, col: 4 },
				{ row: 3, col: 2 },
				{ row: 3, col: 3 }
			])
		).toBeNull();
		// Square-4 is not plus
		expect(
			isPlusNakadeVulnerableRegion([
				{ row: 2, col: 2 },
				{ row: 2, col: 3 },
				{ row: 3, col: 2 },
				{ row: 3, col: 3 }
			])
		).toBeNull();
		// U (edge-middle hole in 2×3) is not plus
		expect(
			isPlusNakadeVulnerableRegion([
				{ row: 2, col: 2 },
				{ row: 2, col: 3 },
				{ row: 2, col: 4 },
				{ row: 3, col: 2 },
				{ row: 3, col: 4 }
			])
		).toBeNull();
	});

	it("go-lite-plus-nakade: seeded double-pass O wins; without flag X wins; contrasts; replay faithful", () => {
		const cfg = examplePresets["go-lite-plus-nakade"].config;
		const { kernel, gameConfig } = compileConfig(cfg);
		const script: KernelAction[] = [{ type: "pass" }, { type: "pass" }];
		let state = kernel.initialState(cfg.rng.seed);
		for (const action of script) {
			const result = kernel.stepSync(state, action);
			expect(result.events[0]?.type).toBe("actionApplied");
			state = result.nextState;
		}
		expect(state.status).toBe("won");
		expect(state.winner).toBe("O");
		expect(state.consecutivePasses).toBe(2);

		const without = structuredClone(cfg);
		without.objective = { mode: "area_control" };
		const baseline = compileConfig(without);
		let rawState = baseline.kernel.initialState(cfg.rng.seed);
		for (const action of script) {
			rawState = baseline.kernel.stepSync(rawState, action).nextState;
		}
		expect(rawState.status).toBe("won");
		expect(rawState.winner).toBe("X");

		for (const flag of [
			{ bensonLife: true },
			{ nakadeDeath: true },
			{ lNakadeDeath: true },
			{ squareNakadeDeath: true },
			{ pyramidNakadeDeath: true },
			{ twistedNakadeDeath: true },
			{ l4NakadeDeath: true },
			{ straight4NakadeDeath: true },
			{ bulky5NakadeDeath: true },
			{ semeaiDeath: true },
			{ netDeath: true },
			{ looseNetDeath: true },
			{ senteLadderDeath: true },
			{ approachNetDeath: true },
			{ ladderDeath: true },
			{ seki: true }
		] as const) {
			const alt = structuredClone(cfg);
			alt.objective = { mode: "area_control", ...flag };
			const altKernel = compileConfig(alt);
			let altState = altKernel.kernel.initialState(cfg.rng.seed);
			for (const action of script) {
				altState = altKernel.kernel.stepSync(altState, action).nextState;
			}
			expect(altState.winner).toBe("X");
		}

		const replay = replayActions(gameConfig, script, cfg.rng.seed);
		expect(replay.faithful).toBe(true);
		expect(replay.finalState.status).toBe("won");
		expect(replay.finalState.winner).toBe("O");
	});

	it("validates and compiles the go-lite-net preset", () => {
		const cfg = examplePresets["go-lite-net"].config;
		expect(validateConfig(cfg).ok).toBe(true);
		const { kernel, gameConfig } = compileConfig(cfg);
		expect(gameConfig.objectiveMode).toBe("area_control");
		expect(gameConfig.netDeath).toBe(true);
		expect(gameConfig.captureMode).toBe("liberties");
		const state = kernel.initialState(cfg.rng.seed);
		expect(kernel.legalActions(state, 0).some((a) => a.type === "pass")).toBe(
			true
		);
	});

	it("rejects objective.netDeath outside area_control", () => {
		const bad = structuredClone(examplePresets["tic-tac-toe"].config) as {
			objective: { mode: string; netDeath?: boolean };
		};
		bad.objective = { mode: "n_in_a_row", netDeath: true };
		expect(validateConfig(bad as never).ok).toBe(false);
	});

	it("findNetDeadCells: edge geta clears 3-lib X; siblings skip", () => {
		const cfg = examplePresets["go-lite-net"].config;
		const { kernel } = compileConfig(cfg);
		const state = kernel.initialState(cfg.rng.seed);
		const g = state.grid;
		const netX = enumerateGroups(g).find(
			(gr) => gr.color === "X" && gr.stones.some((p) => p.row === 0)
		)!;
		expect(netX.liberties.size).toBe(3);
		expect(isLadderDeadGroup(g, netX.stones, "X")).toBe(false);
		expect(isNetDeadGroup(g, netX.stones, "X")).toBe(true);
		expect(findNakadeDeadCells(g).every((p) => getCell(g, p) !== "X")).toBe(
			true
		);
		expect(findLadderDeadCells(g).every((p) => getCell(g, p) !== "X")).toBe(
			true
		);
		// Edge foothold: deadStones/Benson keep the net victim.
		expect(
			findDeadStoneCells(g).every(
				(p) => !(p.row === 0 && (p.col === 2 || p.col === 3))
			)
		).toBe(true);
		expect(
			findBensonDeadStoneCells(g).every(
				(p) => !(p.row === 0 && (p.col === 2 || p.col === 3))
			)
		).toBe(true);
		const dead = findNetDeadCells(g);
		expect(dead.length).toBe(netX.stones.length);
		expect(dead.every((p) => getCell(g, p) === "X")).toBe(true);
		expect(areaOutcome(g).winner).toBe("X");
		expect(
			areaOutcome(
				g,
				false,
				"rectangle",
				undefined,
				0,
				false,
				false,
				false,
				false,
				false,
				{ X: 0, O: 0 },
				false,
				false,
				true
			).winner
		).toBe("O");
		expect(
			areaOutcome(
				g,
				false,
				"rectangle",
				undefined,
				0,
				false,
				false,
				false,
				true
			).winner
		).toBe("X");
		const cleared = scoreArea(removeNetDeadStones(g));
		expect(cleared.O).toBeGreaterThan(cleared.X);
	});

	it("go-lite-net: seeded double-pass O wins; without flag X wins; contrasts; replay faithful", () => {
		const cfg = examplePresets["go-lite-net"].config;
		const { kernel, gameConfig } = compileConfig(cfg);
		const script: KernelAction[] = [{ type: "pass" }, { type: "pass" }];
		let state = kernel.initialState(cfg.rng.seed);
		for (const action of script) {
			const result = kernel.stepSync(state, action);
			expect(result.events[0]?.type).toBe("actionApplied");
			state = result.nextState;
		}
		expect(state.status).toBe("won");
		expect(state.winner).toBe("O");
		expect(state.consecutivePasses).toBe(2);

		const without = structuredClone(cfg);
		without.objective = { mode: "area_control" };
		const baseline = compileConfig(without);
		let rawState = baseline.kernel.initialState(cfg.rng.seed);
		for (const action of script) {
			rawState = baseline.kernel.stepSync(rawState, action).nextState;
		}
		expect(rawState.status).toBe("won");
		expect(rawState.winner).toBe("X");

		// Omit semeaiDeath: cage O can share a higher liberty count with the
		// net victim, so semeai may also clear — not a unique contrast.
		for (const flag of [
			{ deadStones: true },
			{ bensonLife: true },
			{ nakadeDeath: true },
			{ ladderDeath: true },
			{ seki: true }
		] as const) {
			const alt = structuredClone(cfg);
			alt.objective = { mode: "area_control", ...flag };
			const altKernel = compileConfig(alt);
			let altState = altKernel.kernel.initialState(cfg.rng.seed);
			for (const action of script) {
				altState = altKernel.kernel.stepSync(altState, action).nextState;
			}
			expect(altState.winner).toBe("X");
		}

		const replay = replayActions(gameConfig, script, cfg.rng.seed);
		expect(replay.faithful).toBe(true);
		expect(replay.finalState.status).toBe("won");
		expect(replay.finalState.winner).toBe("O");
	});

	it("validates and compiles the go-lite-loose-net preset", () => {
		const cfg = examplePresets["go-lite-loose-net"].config;
		expect(validateConfig(cfg).ok).toBe(true);
		const { kernel, gameConfig } = compileConfig(cfg);
		expect(gameConfig.objectiveMode).toBe("area_control");
		expect(gameConfig.looseNetDeath).toBe(true);
		expect(gameConfig.captureMode).toBe("liberties");
		const state = kernel.initialState(cfg.rng.seed);
		expect(kernel.legalActions(state, 0).some((a) => a.type === "pass")).toBe(
			true
		);
	});

	it("rejects objective.looseNetDeath outside area_control", () => {
		const bad = structuredClone(examplePresets["tic-tac-toe"].config) as {
			objective: { mode: string; looseNetDeath?: boolean };
		};
		bad.objective = { mode: "n_in_a_row", looseNetDeath: true };
		expect(validateConfig(bad as never).ok).toBe(false);
	});

	it("findLooseNetDeadCells: edge loose geta clears 4-lib X; siblings skip", () => {
		const cfg = examplePresets["go-lite-loose-net"].config;
		const { kernel } = compileConfig(cfg);
		const state = kernel.initialState(cfg.rng.seed);
		const g = state.grid;
		const netX = enumerateGroups(g).find(
			(gr) => gr.color === "X" && gr.stones.some((p) => p.row === 0)
		)!;
		expect(netX.liberties.size).toBe(4);
		expect(isLadderDeadGroup(g, netX.stones, "X")).toBe(false);
		expect(isNetDeadGroup(g, netX.stones, "X")).toBe(false);
		expect(isLooseNetDeadGroup(g, netX.stones, "X")).toBe(true);
		expect(findNakadeDeadCells(g).every((p) => getCell(g, p) !== "X")).toBe(
			true
		);
		expect(findLadderDeadCells(g).every((p) => getCell(g, p) !== "X")).toBe(
			true
		);
		expect(findNetDeadCells(g).every((p) => getCell(g, p) !== "X")).toBe(
			true
		);
		// Edge foothold: deadStones/Benson keep the loose-net victim.
		expect(
			findDeadStoneCells(g).every(
				(p) => !(p.row === 0 && (p.col === 2 || p.col === 3))
			)
		).toBe(true);
		expect(
			findBensonDeadStoneCells(g).every(
				(p) => !(p.row === 0 && (p.col === 2 || p.col === 3))
			)
		).toBe(true);
		const dead = findLooseNetDeadCells(g);
		expect(dead.length).toBe(netX.stones.length);
		expect(dead.every((p) => getCell(g, p) === "X")).toBe(true);
		expect(areaOutcome(g).winner).toBe("X");
		expect(
			areaOutcome(
				g,
				false,
				"rectangle",
				undefined,
				0,
				false,
				false,
				false,
				false,
				false,
				{ X: 0, O: 0 },
				false,
				false,
				false,
				true
			).winner
		).toBe("O");
		// Tight netDeath alone does not flip (root ≠ 3).
		expect(
			areaOutcome(
				g,
				false,
				"rectangle",
				undefined,
				0,
				false,
				false,
				false,
				false,
				false,
				{ X: 0, O: 0 },
				false,
				false,
				true,
				false
			).winner
		).toBe("X");
		expect(
			areaOutcome(
				g,
				false,
				"rectangle",
				undefined,
				0,
				false,
				false,
				false,
				true
			).winner
		).toBe("X");
		const cleared = scoreArea(removeLooseNetDeadStones(g));
		expect(cleared.O).toBeGreaterThan(cleared.X);
	});

	it("go-lite-loose-net: seeded double-pass O wins; without flag X wins; contrasts; replay faithful", () => {
		const cfg = examplePresets["go-lite-loose-net"].config;
		const { kernel, gameConfig } = compileConfig(cfg);
		const script: KernelAction[] = [{ type: "pass" }, { type: "pass" }];
		let state = kernel.initialState(cfg.rng.seed);
		for (const action of script) {
			const result = kernel.stepSync(state, action);
			expect(result.events[0]?.type).toBe("actionApplied");
			state = result.nextState;
		}
		expect(state.status).toBe("won");
		expect(state.winner).toBe("O");
		expect(state.consecutivePasses).toBe(2);

		const without = structuredClone(cfg);
		without.objective = { mode: "area_control" };
		const baseline = compileConfig(without);
		let rawState = baseline.kernel.initialState(cfg.rng.seed);
		for (const action of script) {
			rawState = baseline.kernel.stepSync(rawState, action).nextState;
		}
		expect(rawState.status).toBe("won");
		expect(rawState.winner).toBe("X");

		// Omit semeaiDeath: cage O can share a higher liberty count with the
		// loose-net victim, so semeai may also clear — not a unique contrast.
		for (const flag of [
			{ deadStones: true },
			{ bensonLife: true },
			{ nakadeDeath: true },
			{ netDeath: true },
			{ ladderDeath: true },
			{ seki: true }
		] as const) {
			const alt = structuredClone(cfg);
			alt.objective = { mode: "area_control", ...flag };
			const altKernel = compileConfig(alt);
			let altState = altKernel.kernel.initialState(cfg.rng.seed);
			for (const action of script) {
				altState = altKernel.kernel.stepSync(altState, action).nextState;
			}
			expect(altState.winner).toBe("X");
		}

		const replay = replayActions(gameConfig, script, cfg.rng.seed);
		expect(replay.faithful).toBe(true);
		expect(replay.finalState.status).toBe("won");
		expect(replay.finalState.winner).toBe("O");
	});

	it("validates and compiles the go-lite-sente-ladder preset", () => {
		const cfg = examplePresets["go-lite-sente-ladder"].config;
		expect(validateConfig(cfg).ok).toBe(true);
		const { kernel, gameConfig } = compileConfig(cfg);
		expect(gameConfig.objectiveMode).toBe("area_control");
		expect(gameConfig.senteLadderDeath).toBe(true);
		expect(gameConfig.captureMode).toBe("liberties");
		const state = kernel.initialState(cfg.rng.seed);
		expect(kernel.legalActions(state, 0).some((a) => a.type === "pass")).toBe(
			true
		);
	});

	it("rejects objective.senteLadderDeath outside area_control", () => {
		const bad = structuredClone(examplePresets["tic-tac-toe"].config) as {
			objective: { mode: string; senteLadderDeath?: boolean };
		};
		bad.objective = { mode: "n_in_a_row", senteLadderDeath: true };
		expect(validateConfig(bad as never).ok).toBe(false);
	});

	it("findSenteLadderDeadCells: open cage clears 3-lib X; siblings skip", () => {
		const cfg = examplePresets["go-lite-sente-ladder"].config;
		const { kernel } = compileConfig(cfg);
		const state = kernel.initialState(cfg.rng.seed);
		const g = state.grid;
		const netX = enumerateGroups(g).find(
			(gr) => gr.color === "X" && gr.stones.some((p) => p.row === 0)
		)!;
		expect(netX.liberties.size).toBe(3);
		expect(isLadderDeadGroup(g, netX.stones, "X")).toBe(false);
		expect(isNetDeadGroup(g, netX.stones, "X")).toBe(false);
		expect(isLooseNetDeadGroup(g, netX.stones, "X")).toBe(false);
		expect(isSenteLadderDeadGroup(g, netX.stones, "X")).toBe(true);
		expect(findNakadeDeadCells(g).every((p) => getCell(g, p) !== "X")).toBe(
			true
		);
		expect(findLadderDeadCells(g).every((p) => getCell(g, p) !== "X")).toBe(
			true
		);
		expect(findNetDeadCells(g).every((p) => getCell(g, p) !== "X")).toBe(
			true
		);
		expect(findLooseNetDeadCells(g).every((p) => getCell(g, p) !== "X")).toBe(
			true
		);
		// Edge foothold: deadStones/Benson keep the victim.
		expect(
			findDeadStoneCells(g).every(
				(p) => !(p.row === 0 && (p.col === 2 || p.col === 3))
			)
		).toBe(true);
		expect(
			findBensonDeadStoneCells(g).every(
				(p) => !(p.row === 0 && (p.col === 2 || p.col === 3))
			)
		).toBe(true);
		const dead = findSenteLadderDeadCells(g);
		expect(dead.length).toBe(netX.stones.length);
		expect(dead.every((p) => getCell(g, p) === "X")).toBe(true);
		// Each liberty fill ladders (documents attacker-first predicate).
		const libs = Array.from(netX.liberties).map((k) => {
			const [r, c] = k.split(",").map(Number);
			return { row: r!, col: c! };
		});
		for (const fill of libs) {
			const sim = simulateLibertyPlace(g, fill, "O");
			expect(sim).not.toBeNull();
			const next = { ...g, cells: sim!.cells };
			const rem = netX.stones.filter((p) => getCell(next, p) === "X");
			expect(rem.length).toBeGreaterThan(0);
			expect(isLadderDeadGroup(next, rem, "X")).toBe(true);
		}
		expect(areaOutcome(g).winner).toBe("X");
		expect(
			areaOutcome(
				g,
				false,
				"rectangle",
				undefined,
				0,
				false,
				false,
				false,
				false,
				false,
				{ X: 0, O: 0 },
				false,
				false,
				false,
				false,
				true
			).winner
		).toBe("O");
		// Defender-first netDeath alone does not flip.
		expect(
			areaOutcome(
				g,
				false,
				"rectangle",
				undefined,
				0,
				false,
				false,
				false,
				false,
				false,
				{ X: 0, O: 0 },
				false,
				false,
				true,
				false,
				false
			).winner
		).toBe("X");
		expect(
			areaOutcome(
				g,
				false,
				"rectangle",
				undefined,
				0,
				false,
				false,
				false,
				true
			).winner
		).toBe("X");
		const living = enumerateGroups(g).find(
			(gr) =>
				gr.color === "X" && !gr.stones.some((p) => p.row === 0 && p.col <= 3)
		)!;
		expect(living.liberties.size).toBeGreaterThanOrEqual(4);
		expect(isSenteLadderDeadGroup(g, living.stones, "X")).toBe(false);
		const cleared = scoreArea(removeSenteLadderDeadStones(g));
		expect(cleared.O).toBeGreaterThan(cleared.X);
	});

	it("go-lite-sente-ladder: seeded double-pass O wins; without flag X wins; contrasts; replay faithful", () => {
		const cfg = examplePresets["go-lite-sente-ladder"].config;
		const { kernel, gameConfig } = compileConfig(cfg);
		const script: KernelAction[] = [{ type: "pass" }, { type: "pass" }];
		let state = kernel.initialState(cfg.rng.seed);
		for (const action of script) {
			const result = kernel.stepSync(state, action);
			expect(result.events[0]?.type).toBe("actionApplied");
			state = result.nextState;
		}
		expect(state.status).toBe("won");
		expect(state.winner).toBe("O");
		expect(state.consecutivePasses).toBe(2);

		const without = structuredClone(cfg);
		without.objective = { mode: "area_control" };
		const baseline = compileConfig(without);
		let rawState = baseline.kernel.initialState(cfg.rng.seed);
		for (const action of script) {
			rawState = baseline.kernel.stepSync(rawState, action).nextState;
		}
		expect(rawState.status).toBe("won");
		expect(rawState.winner).toBe("X");

		// Omit semeaiDeath: living X mass can lose a shared-lib race.
		for (const flag of [
			{ deadStones: true },
			{ bensonLife: true },
			{ nakadeDeath: true },
			{ netDeath: true },
			{ looseNetDeath: true },
			{ ladderDeath: true },
			{ seki: true }
		] as const) {
			const alt = structuredClone(cfg);
			alt.objective = { mode: "area_control", ...flag };
			const altKernel = compileConfig(alt);
			let altState = altKernel.kernel.initialState(cfg.rng.seed);
			for (const action of script) {
				altState = altKernel.kernel.stepSync(altState, action).nextState;
			}
			expect(altState.winner).toBe("X");
		}

		const replay = replayActions(gameConfig, script, cfg.rng.seed);
		expect(replay.faithful).toBe(true);
		expect(replay.finalState.status).toBe("won");
		expect(replay.finalState.winner).toBe("O");
	});

	it("validates and compiles the go-lite-approach-net preset", () => {
		const cfg = examplePresets["go-lite-approach-net"].config;
		expect(validateConfig(cfg).ok).toBe(true);
		const { kernel, gameConfig } = compileConfig(cfg);
		expect(gameConfig.objectiveMode).toBe("area_control");
		expect(gameConfig.approachNetDeath).toBe(true);
		expect(gameConfig.captureMode).toBe("liberties");
		const state = kernel.initialState(cfg.rng.seed);
		expect(kernel.legalActions(state, 0).some((a) => a.type === "pass")).toBe(
			true
		);
	});

	it("rejects objective.approachNetDeath outside area_control", () => {
		const bad = structuredClone(examplePresets["tic-tac-toe"].config) as {
			objective: { mode: string; approachNetDeath?: boolean };
		};
		bad.objective = { mode: "n_in_a_row", approachNetDeath: true };
		expect(validateConfig(bad as never).ok).toBe(false);
	});

	it("findApproachNetDeadCells: open loose cage clears 4-lib X; siblings skip", () => {
		const cfg = examplePresets["go-lite-approach-net"].config;
		const { kernel } = compileConfig(cfg);
		const state = kernel.initialState(cfg.rng.seed);
		const g = state.grid;
		const netX = enumerateGroups(g).find(
			(gr) => gr.color === "X" && gr.stones.some((p) => p.row === 0)
		)!;
		expect(netX.liberties.size).toBe(4);
		expect(isLadderDeadGroup(g, netX.stones, "X")).toBe(false);
		expect(isNetDeadGroup(g, netX.stones, "X")).toBe(false);
		expect(isLooseNetDeadGroup(g, netX.stones, "X")).toBe(false);
		expect(isSenteLadderDeadGroup(g, netX.stones, "X")).toBe(false);
		expect(isApproachNetDeadGroup(g, netX.stones, "X")).toBe(true);
		expect(findNakadeDeadCells(g).every((p) => getCell(g, p) !== "X")).toBe(
			true
		);
		expect(findLadderDeadCells(g).every((p) => getCell(g, p) !== "X")).toBe(
			true
		);
		expect(findNetDeadCells(g).every((p) => getCell(g, p) !== "X")).toBe(
			true
		);
		expect(findLooseNetDeadCells(g).every((p) => getCell(g, p) !== "X")).toBe(
			true
		);
		expect(findSenteLadderDeadCells(g).every((p) => getCell(g, p) !== "X")).toBe(
			true
		);
		expect(
			findDeadStoneCells(g).every(
				(p) => !(p.row === 0 && (p.col === 2 || p.col === 3))
			)
		).toBe(true);
		expect(
			findBensonDeadStoneCells(g).every(
				(p) => !(p.row === 0 && (p.col === 2 || p.col === 3))
			)
		).toBe(true);
		const dead = findApproachNetDeadCells(g);
		expect(dead.length).toBe(netX.stones.length);
		expect(dead.every((p) => getCell(g, p) === "X")).toBe(true);
		// Approach O@(1,4) completes loose net (documents non-liberty place).
		const approach = simulateLibertyPlace(g, { row: 1, col: 4 }, "O");
		expect(approach).not.toBeNull();
		const next = { ...g, cells: approach!.cells };
		expect(isLooseNetDeadGroup(next, netX.stones, "X")).toBe(true);
		expect(areaOutcome(g).winner).toBe("X");
		expect(
			areaOutcome(
				g,
				false,
				"rectangle",
				undefined,
				0,
				false,
				false,
				false,
				false,
				false,
				{ X: 0, O: 0 },
				false,
				false,
				false,
				false,
				false,
				true
			).winner
		).toBe("O");
		// Sibling flags alone do not flip.
		expect(
			areaOutcome(
				g,
				false,
				"rectangle",
				undefined,
				0,
				false,
				false,
				false,
				false,
				false,
				{ X: 0, O: 0 },
				false,
				false,
				false,
				true,
				false,
				false
			).winner
		).toBe("X");
		expect(
			areaOutcome(
				g,
				false,
				"rectangle",
				undefined,
				0,
				false,
				false,
				false,
				false,
				false,
				{ X: 0, O: 0 },
				false,
				false,
				false,
				false,
				true,
				false
			).winner
		).toBe("X");
		const living = enumerateGroups(g).find(
			(gr) =>
				gr.color === "X" && !gr.stones.some((p) => p.row === 0 && p.col <= 3)
		)!;
		expect(living.liberties.size).toBeGreaterThanOrEqual(4);
		expect(isApproachNetDeadGroup(g, living.stones, "X")).toBe(false);
		const cleared = scoreArea(removeApproachNetDeadStones(g));
		expect(cleared.O).toBeGreaterThan(cleared.X);
	});

	it("go-lite-approach-net: seeded double-pass O wins; without flag X wins; contrasts; replay faithful", () => {
		const cfg = examplePresets["go-lite-approach-net"].config;
		const { kernel, gameConfig } = compileConfig(cfg);
		const script: KernelAction[] = [{ type: "pass" }, { type: "pass" }];
		let state = kernel.initialState(cfg.rng.seed);
		for (const action of script) {
			const result = kernel.stepSync(state, action);
			expect(result.events[0]?.type).toBe("actionApplied");
			state = result.nextState;
		}
		expect(state.status).toBe("won");
		expect(state.winner).toBe("O");
		expect(state.consecutivePasses).toBe(2);

		const without = structuredClone(cfg);
		without.objective = { mode: "area_control" };
		const baseline = compileConfig(without);
		let rawState = baseline.kernel.initialState(cfg.rng.seed);
		for (const action of script) {
			rawState = baseline.kernel.stepSync(rawState, action).nextState;
		}
		expect(rawState.status).toBe("won");
		expect(rawState.winner).toBe("X");

		for (const flag of [
			{ deadStones: true },
			{ bensonLife: true },
			{ nakadeDeath: true },
			{ netDeath: true },
			{ looseNetDeath: true },
			{ senteLadderDeath: true },
			{ ladderDeath: true },
			{ seki: true }
		] as const) {
			const alt = structuredClone(cfg);
			alt.objective = { mode: "area_control", ...flag };
			const altKernel = compileConfig(alt);
			let altState = altKernel.kernel.initialState(cfg.rng.seed);
			for (const action of script) {
				altState = altKernel.kernel.stepSync(altState, action).nextState;
			}
			expect(altState.winner).toBe("X");
		}

		const replay = replayActions(gameConfig, script, cfg.rng.seed);
		expect(replay.faithful).toBe(true);
		expect(replay.finalState.status).toBe("won");
		expect(replay.finalState.winner).toBe("O");
	});

	it("validates and compiles the go-lite-dame-fill preset", () => {
		const cfg = examplePresets["go-lite-dame-fill"].config;
		expect(validateConfig(cfg).ok).toBe(true);
		const { kernel, gameConfig } = compileConfig(cfg);
		expect(gameConfig.objectiveMode).toBe("area_control");
		expect(gameConfig.dameFill).toBe(true);
		expect(gameConfig.captureMode).toBe("liberties");
		const state = kernel.initialState(cfg.rng.seed);
		expect(state.endgamePhase).toBe(false);
		expect(kernel.legalActions(state, 0).some((a) => a.type === "pass")).toBe(
			true
		);
	});

	it("rejects objective.dameFill outside area_control", () => {
		const bad = structuredClone(examplePresets["tic-tac-toe"].config) as {
			objective: { mode: string; dameFill?: boolean };
		};
		bad.objective = { mode: "n_in_a_row", dameFill: true };
		expect(validateConfig(bad as never).ok).toBe(false);
	});

	it("findDameCells returns mixed/open empties, not mono territory", () => {
		// 5×4 matching go-lite-dame-fill seed: eye at (1,1); dame at (2,2)+row3
		const w = 5;
		const h = 4;
		const cells = Array(w * h).fill(null) as (string | null)[];
		const put = (row: number, col: number, p: string) => {
			cells[row * w + col] = p;
		};
		for (const [row, col, p] of [
			[0, 0, "X"],
			[0, 1, "X"],
			[0, 2, "X"],
			[0, 3, "O"],
			[0, 4, "O"],
			[1, 0, "X"],
			[1, 2, "X"],
			[1, 3, "O"],
			[1, 4, "O"],
			[2, 0, "X"],
			[2, 1, "X"],
			[2, 3, "O"],
			[2, 4, "O"]
		] as const) {
			put(row, col, p);
		}
		const g = gridOf(w, h, cells);
		expect(scoreArea(g)).toEqual({ X: 8, O: 6 }); // 7X+1 eye, 6O
		const dame = findDameCells(g);
		const dameKeys = new Set(dame.map((p) => `${p.row},${p.col}`));
		expect(dameKeys.has("1,1")).toBe(false);
		expect(dameKeys.has("2,2")).toBe(true);
		expect(dameKeys.has("3,0")).toBe(true);
		expect(dame.length).toBe(6);
	});

	it("dameFill: first pass enters endgame; territory illegal; dame legal; fill then score", () => {
		const cfg = examplePresets["go-lite-dame-fill"].config;
		const { kernel, gameConfig } = compileConfig(cfg);
		let state = kernel.initialState(cfg.rng.seed);
		expect(state.endgamePhase).toBe(false);

		const enter = kernel.stepSync(state, { type: "pass" });
		expect(enter.events[0]?.type).toBe("actionApplied");
		state = enter.nextState;
		expect(state.endgamePhase).toBe(true);
		expect(state.consecutivePasses).toBe(0);
		expect(state.status).toBe("playing");
		expect(state.currentPlayer).toBe("O");

		const legal = kernel.legalActions(state, playerIdOf(state.currentPlayer));
		const placeKeys = new Set(
			legal
				.filter((a) => a.type === "place")
				.map((a) => `${a.position.row},${a.position.col}`)
		);
		expect(placeKeys.has("1,1")).toBe(false);
		expect(placeKeys.has("2,2")).toBe(true);
		expect(legal.some((a) => a.type === "pass")).toBe(true);

		// O passes so X can take the dame stone.
		state = kernel.stepSync(state, { type: "pass" }).nextState;
		expect(state.endgamePhase).toBe(true);
		expect(state.consecutivePasses).toBe(1);
		expect(state.currentPlayer).toBe("X");

		const fill = kernel.stepSync(state, {
			type: "place",
			position: { row: 2, col: 2 }
		});
		expect(fill.events[0]?.type).toBe("actionApplied");
		state = fill.nextState;
		expect(state.endgamePhase).toBe(true);
		expect(state.consecutivePasses).toBe(0);
		expect(getCell(state.grid, { row: 2, col: 2 })).toBe("X");

		state = kernel.stepSync(state, { type: "pass" }).nextState;
		expect(state.status).toBe("playing");
		expect(state.consecutivePasses).toBe(1);
		state = kernel.stepSync(state, { type: "pass" }).nextState;
		expect(state.status).toBe("won");
		expect(state.winner).toBe("X");
		expect(state.consecutivePasses).toBe(2);

		// Without the dame fill, X still wins but with a lower area (eye only).
		const noFillScript: KernelAction[] = [
			{ type: "pass" },
			{ type: "pass" },
			{ type: "pass" }
		];
		let raw = kernel.initialState(cfg.rng.seed);
		for (const action of noFillScript) {
			raw = kernel.stepSync(raw, action).nextState;
		}
		expect(raw.status).toBe("won");
		expect(raw.winner).toBe("X");
		expect(scoreArea(raw.grid)).toEqual({ X: 8, O: 6 });
		expect(scoreArea(state.grid)).toEqual({ X: 9, O: 6 });

		const fillScript: KernelAction[] = [
			{ type: "pass" },
			{ type: "pass" },
			{ type: "place", position: { row: 2, col: 2 } },
			{ type: "pass" },
			{ type: "pass" }
		];
		const replay = replayActions(gameConfig, fillScript, cfg.rng.seed);
		expect(replay.faithful).toBe(true);
		expect(replay.finalState.status).toBe("won");
		expect(replay.finalState.winner).toBe("X");
	});

	it("dameFill off: two consecutive passes still score immediately", () => {
		const cfg = structuredClone(examplePresets["go-lite-dame-fill"].config);
		cfg.objective = { mode: "area_control" };
		const { kernel } = compileConfig(cfg);
		let state = kernel.initialState(cfg.rng.seed);
		state = kernel.stepSync(state, { type: "pass" }).nextState;
		expect(state.endgamePhase).toBe(false);
		expect(state.consecutivePasses).toBe(1);
		state = kernel.stepSync(state, { type: "pass" }).nextState;
		expect(state.status).toBe("won");
		expect(state.winner).toBe("X");
	});

	it("validates and compiles the go-lite-mark-dead preset", () => {
		const cfg = examplePresets["go-lite-mark-dead"].config;
		expect(validateConfig(cfg).ok).toBe(true);
		const { kernel, gameConfig } = compileConfig(cfg);
		expect(gameConfig.objectiveMode).toBe("area_control");
		expect(gameConfig.markDead).toBe(true);
		expect(gameConfig.captureMode).toBe("liberties");
		const state = kernel.initialState(cfg.rng.seed);
		expect(state.markingPhase).toBe(false);
		expect(state.markedDead).toEqual([]);
		expect(kernel.legalActions(state, 0).some((a) => a.type === "pass")).toBe(
			true
		);
	});

	it("rejects objective.markDead outside area_control", () => {
		const bad = structuredClone(examplePresets["tic-tac-toe"].config) as {
			objective: { mode: string; markDead?: boolean };
		};
		bad.objective = { mode: "n_in_a_row", markDead: true };
		expect(validateConfig(bad as never).ok).toBe(false);
	});

	it("rejects objective.markDead under simultaneous schedule", () => {
		const bad = structuredClone(examplePresets["go-lite-mark-dead"].config);
		bad.turn = { mode: "turn", schedule: "simultaneous" };
		expect(validateConfig(bad).ok).toBe(false);
	});

	it("removeMarkedDeadStones clears listed keys only", () => {
		const cells = Array(25).fill(null) as (string | null)[];
		cells[2 * 5 + 2] = "X";
		cells[1 * 5 + 1] = "O";
		cells[1 * 5 + 2] = "O";
		const g = gridOf(5, 5, cells);
		const cleared = removeMarkedDeadStones(g, ["1,1", "1,2"]);
		expect(getCell(cleared, { row: 1, col: 1 })).toBeNull();
		expect(getCell(cleared, { row: 1, col: 2 })).toBeNull();
		expect(getCell(cleared, { row: 2, col: 2 })).toBe("X");
	});

	it("markDead: two-pass enters marking; mark group; confirm removes and flips winner", () => {
		const cfg = examplePresets["go-lite-mark-dead"].config;
		const { kernel, gameConfig } = compileConfig(cfg);
		let state = kernel.initialState(cfg.rng.seed);
		// O ring claims surrounding empties under simplified area scoring.
		expect(scoreArea(state.grid)).toEqual({ X: 1, O: 24 });

		state = kernel.stepSync(state, { type: "pass" }).nextState;
		expect(state.markingPhase).toBe(false);
		expect(state.consecutivePasses).toBe(1);
		state = kernel.stepSync(state, { type: "pass" }).nextState;
		expect(state.markingPhase).toBe(true);
		expect(state.status).toBe("playing");
		expect(state.consecutivePasses).toBe(0);
		expect(state.currentPlayer).toBe("X");

		const legal = kernel.legalActions(state, 0);
		expect(legal.every((a) => a.type === "markDead" || a.type === "pass")).toBe(
			true
		);
		expect(
			legal.some(
				(a) =>
					a.type === "markDead" && a.position.row === 1 && a.position.col === 1
			)
		).toBe(true);
		expect(legal.some((a) => a.type === "place")).toBe(false);

		const mark = kernel.stepSync(state, {
			type: "markDead",
			position: { row: 1, col: 1 }
		});
		expect(mark.events[0]?.type).toBe("actionApplied");
		state = mark.nextState;
		expect(state.markedDead?.length).toBe(8);
		expect(state.consecutivePasses).toBe(0);
		expect(state.currentPlayer).toBe("O");

		// Own stone / empty illegal (O cannot mark O stones)
		const own = kernel.stepSync(state, {
			type: "markDead",
			position: { row: 1, col: 1 }
		});
		expect(own.events[0]?.type).toBe("ignored");
		expect(own.nextState).toBe(state);

		state = kernel.stepSync(state, { type: "pass" }).nextState;
		expect(state.consecutivePasses).toBe(1);
		state = kernel.stepSync(state, { type: "pass" }).nextState;
		expect(state.status).toBe("won");
		expect(state.winner).toBe("X");
		expect(getCell(state.grid, { row: 1, col: 1 })).toBeNull();
		expect(getCell(state.grid, { row: 2, col: 2 })).toBe("X");
		expect(scoreArea(state.grid)).toEqual({ X: 25, O: 0 });

		// Without markDead, double-pass awards O immediately.
		const noMark = structuredClone(cfg);
		noMark.objective = { mode: "area_control" };
		const baseline = compileConfig(noMark);
		let raw = baseline.kernel.initialState(cfg.rng.seed);
		raw = baseline.kernel.stepSync(raw, { type: "pass" }).nextState;
		raw = baseline.kernel.stepSync(raw, { type: "pass" }).nextState;
		expect(raw.status).toBe("won");
		expect(raw.winner).toBe("O");

		const script: KernelAction[] = [
			{ type: "pass" },
			{ type: "pass" },
			{ type: "markDead", position: { row: 1, col: 1 } },
			{ type: "pass" },
			{ type: "pass" }
		];
		const replay = replayActions(gameConfig, script, cfg.rng.seed);
		expect(replay.faithful).toBe(true);
		expect(replay.finalState.status).toBe("won");
		expect(replay.finalState.winner).toBe("X");
	});

	it("markDead toggle off: confirm with empty marks leaves stones", () => {
		const cfg = examplePresets["go-lite-mark-dead"].config;
		const { kernel } = compileConfig(cfg);
		let state = kernel.initialState(cfg.rng.seed);
		state = kernel.stepSync(state, { type: "pass" }).nextState;
		state = kernel.stepSync(state, { type: "pass" }).nextState;
		expect(state.markingPhase).toBe(true);
		state = kernel.stepSync(state, {
			type: "markDead",
			position: { row: 1, col: 1 }
		}).nextState;
		expect(state.markedDead?.length).toBe(8);
		// O passes; X toggles the same group off
		state = kernel.stepSync(state, { type: "pass" }).nextState;
		state = kernel.stepSync(state, {
			type: "markDead",
			position: { row: 3, col: 3 }
		}).nextState;
		expect(state.markedDead).toEqual([]);
		state = kernel.stepSync(state, { type: "pass" }).nextState;
		state = kernel.stepSync(state, { type: "pass" }).nextState;
		expect(state.status).toBe("won");
		expect(state.winner).toBe("O");
		expect(getCell(state.grid, { row: 1, col: 1 })).toBe("O");
	});

	it("compiles go-lite-mark-dead-resume with markDeadResume", () => {
		const cfg = examplePresets["go-lite-mark-dead-resume"].config;
		expect(validateConfig(cfg).ok).toBe(true);
		const { gameConfig } = compileConfig(cfg);
		expect(gameConfig.markDead).toBe(true);
		expect(gameConfig.markDeadResume).toBe(true);
	});

	it("rejects objective.markDeadResume without markDead", () => {
		const bad = structuredClone(
			examplePresets["go-lite-mark-dead-resume"].config
		) as {
			objective: {
				mode: string;
				markDead?: boolean;
				markDeadResume?: boolean;
			};
		};
		bad.objective = { mode: "area_control", markDeadResume: true };
		expect(validateConfig(bad).ok).toBe(false);
	});

	it("rejects objective.markDeadResume under simultaneous schedule", () => {
		const bad = structuredClone(
			examplePresets["go-lite-mark-dead-resume"].config
		);
		bad.turn = { mode: "turn", schedule: "simultaneous" };
		expect(validateConfig(bad).ok).toBe(false);
	});

	it("rejectMarks: dispute exits marking; place legal; later score without removal", () => {
		const cfg = examplePresets["go-lite-mark-dead-resume"].config;
		const { kernel, gameConfig } = compileConfig(cfg);
		let state = kernel.initialState(cfg.rng.seed);

		state = kernel.stepSync(state, { type: "pass" }).nextState;
		state = kernel.stepSync(state, { type: "pass" }).nextState;
		expect(state.markingPhase).toBe(true);

		// Empty marks: rejectMarks illegal / noop
		const emptyReject = kernel.stepSync(state, { type: "rejectMarks" });
		expect(emptyReject.events[0]?.type).toBe("ignored");
		expect(emptyReject.nextState).toBe(state);
		expect(
			kernel.legalActions(state, 0).some((a) => a.type === "rejectMarks")
		).toBe(false);

		state = kernel.stepSync(state, {
			type: "markDead",
			position: { row: 1, col: 1 }
		}).nextState;
		expect(state.markedDead?.length).toBe(8);
		expect(state.currentPlayer).toBe("O");
		expect(
			kernel.legalActions(state, 1).some((a) => a.type === "rejectMarks")
		).toBe(true);

		const disputed = kernel.stepSync(state, { type: "rejectMarks" });
		expect(disputed.events[0]?.type).toBe("actionApplied");
		state = disputed.nextState;
		expect(state.markingPhase).toBe(false);
		expect(state.markedDead).toEqual([]);
		expect(state.status).toBe("playing");
		expect(state.consecutivePasses).toBe(0);
		expect(state.currentPlayer).toBe("O"); // rejecter keeps initiative
		expect(getCell(state.grid, { row: 1, col: 1 })).toBe("O");
		expect(kernel.legalActions(state, 1).some((a) => a.type === "place")).toBe(
			true
		);

		// Double-pass without re-marking → O wins (raw area)
		state = kernel.stepSync(state, { type: "pass" }).nextState;
		state = kernel.stepSync(state, { type: "pass" }).nextState;
		// Re-enters marking (markDead still on)
		expect(state.markingPhase).toBe(true);
		state = kernel.stepSync(state, { type: "pass" }).nextState;
		state = kernel.stepSync(state, { type: "pass" }).nextState;
		expect(state.status).toBe("won");
		expect(state.winner).toBe("O");
		expect(getCell(state.grid, { row: 1, col: 1 })).toBe("O");

		const script: KernelAction[] = [
			{ type: "pass" },
			{ type: "pass" },
			{ type: "markDead", position: { row: 1, col: 1 } },
			{ type: "rejectMarks" },
			{ type: "pass" },
			{ type: "pass" },
			{ type: "pass" },
			{ type: "pass" }
		];
		const replay = replayActions(gameConfig, script, cfg.rng.seed);
		expect(replay.faithful).toBe(true);
		expect(replay.finalState.status).toBe("won");
		expect(replay.finalState.winner).toBe("O");
	});

	it("rejectMarks noop when markDeadResume is off", () => {
		const cfg = examplePresets["go-lite-mark-dead"].config;
		const { kernel } = compileConfig(cfg);
		let state = kernel.initialState(cfg.rng.seed);
		state = kernel.stepSync(state, { type: "pass" }).nextState;
		state = kernel.stepSync(state, { type: "pass" }).nextState;
		state = kernel.stepSync(state, {
			type: "markDead",
			position: { row: 1, col: 1 }
		}).nextState;
		const rejected = kernel.stepSync(state, { type: "rejectMarks" });
		expect(rejected.events[0]?.type).toBe("ignored");
		expect(rejected.nextState).toBe(state);
		expect(state.markingPhase).toBe(true);
	});

	it("rejects capture.ko without liberties mode", () => {
		const bad = structuredClone(examplePresets["go-lite"].config);
		bad.placement.capture = { enabled: true, mode: "flip", ko: true };
		bad.objective.mode = "n_in_a_row";
		bad.win = {
			length: 3,
			adjacency: {
				mode: "linear",
				horizontal: true,
				vertical: true,
				backDiagonal: false,
				forwardDiagonal: false
			}
		};
		expect(validateConfig(bad).ok).toBe(false);
	});

	it("enforces simple ko: immediate recapture illegal; elsewhere clears", () => {
		const cfg = structuredClone(examplePresets["go-lite"].config);
		// Seed classic point-ko shape on 5×5 (same local pattern as unit test)
		cfg.initial = [
			{ row: 0, col: 1, player: "X", visibility: "public" },
			{ row: 0, col: 2, player: "O", visibility: "public" },
			{ row: 1, col: 0, player: "X", visibility: "public" },
			{ row: 1, col: 1, player: "O", visibility: "public" },
			{ row: 1, col: 3, player: "O", visibility: "public" },
			{ row: 2, col: 1, player: "X", visibility: "public" },
			{ row: 2, col: 2, player: "O", visibility: "public" }
		];
		const { kernel, gameConfig } = compileConfig(cfg);
		let state = kernel.initialState(cfg.rng.seed);

		const capture: KernelAction = {
			type: "place",
			position: { row: 1, col: 2 }
		};
		expect(
			kernel.legalActions(state, 0).some(
				(a) =>
					a.type === "place" &&
					a.position.row === 1 &&
					a.position.col === 2
			)
		).toBe(true);
		state = kernel.stepSync(state, capture).nextState;
		expect(getCell(state.grid, { row: 1, col: 1 })).toBe(null);
		expect(state.koPoint).toEqual({ row: 1, col: 1 });
		expect(state.currentPlayer).toBe("O");

		const recapture: KernelAction = {
			type: "place",
			position: { row: 1, col: 1 }
		};
		expect(
			kernel.legalActions(state, 1).some(
				(a) =>
					a.type === "place" &&
					a.position.row === 1 &&
					a.position.col === 1
			)
		).toBe(false);
		const ignored = kernel.stepSync(state, recapture);
		expect(ignored.events[0]).toMatchObject({
			type: "ignored",
			reason: "ko"
		});
		expect(ignored.nextState).toBe(state);

		// Play elsewhere (empty far corner) — clears ko; then X elsewhere; O may retake
		const elsewhere: KernelAction = {
			type: "place",
			position: { row: 4, col: 4 }
		};
		state = kernel.stepSync(state, elsewhere).nextState;
		expect(state.koPoint).toBeNull();
		expect(state.currentPlayer).toBe("X");

		const xElsewhere: KernelAction = {
			type: "place",
			position: { row: 4, col: 0 }
		};
		state = kernel.stepSync(state, xElsewhere).nextState;
		expect(state.currentPlayer).toBe("O");
		expect(
			kernel.legalActions(state, 1).some(
				(a) =>
					a.type === "place" &&
					a.position.row === 1 &&
					a.position.col === 1
			)
		).toBe(true);
		state = kernel.stepSync(state, recapture).nextState;
		expect(getCell(state.grid, { row: 1, col: 2 })).toBe(null);
		expect(state.koPoint).toEqual({ row: 1, col: 2 });

		const script: KernelAction[] = [
			capture,
			elsewhere,
			xElsewhere,
			recapture
		];
		const replay = replayActions(gameConfig, script, cfg.rng.seed);
		expect(replay.faithful).toBe(true);
		expect(replay.finalState.koPoint).toEqual({ row: 1, col: 2 });
	});

	it("pass does not clear koPoint", () => {
		const cfg = structuredClone(examplePresets["go-lite"].config);
		cfg.initial = [
			{ row: 0, col: 1, player: "X", visibility: "public" },
			{ row: 0, col: 2, player: "O", visibility: "public" },
			{ row: 1, col: 0, player: "X", visibility: "public" },
			{ row: 1, col: 1, player: "O", visibility: "public" },
			{ row: 1, col: 3, player: "O", visibility: "public" },
			{ row: 2, col: 1, player: "X", visibility: "public" },
			{ row: 2, col: 2, player: "O", visibility: "public" }
		];
		const { kernel } = compileConfig(cfg);
		let state = kernel.initialState(cfg.rng.seed);
		state = kernel.stepSync(state, {
			type: "place",
			position: { row: 1, col: 2 }
		}).nextState;
		expect(state.koPoint).toEqual({ row: 1, col: 1 });
		state = kernel.stepSync(state, { type: "pass" }).nextState;
		expect(state.koPoint).toEqual({ row: 1, col: 1 });
		expect(state.currentPlayer).toBe("X");
		// After O passed, X still cannot place at the ko point either? Actually X
		// is the capturer — the forbidden point is for anyone next move; X already
		// occupies (1,2). After pass, it's X's turn and koPoint still (1,1);
		// X placing at (1,1) would be own capture cycle but cell is empty — with
		// Go rules, simple ko forbids only the immediate recapture by the opponent
		// for one move. After a pass, the turn returns to X so the "next" move
		// already happened as pass — wait, Go-correct is: pass does NOT lift ko.
		// So when X's turn comes after O passed, O never played, so (1,1) is still
		// forbidden for the player to move? Classic Go: ko forbids the opponent
		// from retaking immediately; after any intervening move (including pass
		// in some rule sets? Actually in Japanese rules, pass is an intervening
		// play and lifts the ko). Our design (from exploration): Pass does not
		// clear koPoint. So (1,1) remains forbidden for X as well while set.
		expect(
			kernel.legalActions(state, 0).some(
				(a) =>
					a.type === "place" &&
					a.position.row === 1 &&
					a.position.col === 1
			)
		).toBe(false);
	});

	it("enforces positional superko: immediate cycle illegal; history grows; pass keeps history", () => {
		const cfg = structuredClone(examplePresets["go-lite-superko"].config);
		cfg.initial = [
			{ row: 0, col: 1, player: "X", visibility: "public" },
			{ row: 0, col: 2, player: "O", visibility: "public" },
			{ row: 1, col: 0, player: "X", visibility: "public" },
			{ row: 1, col: 1, player: "O", visibility: "public" },
			{ row: 1, col: 3, player: "O", visibility: "public" },
			{ row: 2, col: 1, player: "X", visibility: "public" },
			{ row: 2, col: 2, player: "O", visibility: "public" }
		];
		const { kernel, gameConfig } = compileConfig(cfg);
		let state = kernel.initialState(cfg.rng.seed);
		const initialHash = boardPositionHash(state.grid);
		expect(state.positionHistory).toEqual([initialHash]);

		const capture: KernelAction = {
			type: "place",
			position: { row: 1, col: 2 }
		};
		state = kernel.stepSync(state, capture).nextState;
		expect(getCell(state.grid, { row: 1, col: 1 })).toBe(null);
		expect(state.koPoint).toBeNull();
		expect(state.positionHistory).toHaveLength(2);
		expect(state.positionHistory![0]).toBe(initialHash);
		expect(state.positionHistory![1]).toBe(boardPositionHash(state.grid));

		const recapture: KernelAction = {
			type: "place",
			position: { row: 1, col: 1 }
		};
		expect(
			kernel.legalActions(state, 1).some(
				(a) =>
					a.type === "place" &&
					a.position.row === 1 &&
					a.position.col === 1
			)
		).toBe(false);
		const ignored = kernel.stepSync(state, recapture);
		expect(ignored.events[0]).toMatchObject({
			type: "ignored",
			reason: "superko"
		});
		expect(ignored.nextState).toBe(state);

		const histAfterCapture = state.positionHistory!.length;
		state = kernel.stepSync(state, { type: "pass" }).nextState;
		expect(state.positionHistory).toHaveLength(histAfterCapture);
		expect(state.currentPlayer).toBe("X");

		// Rebuild for the retake path (no pass): elsewhere clears the 2-cycle
		state = kernel.initialState(cfg.rng.seed);
		state = kernel.stepSync(state, capture).nextState;
		const elsewhere: KernelAction = {
			type: "place",
			position: { row: 4, col: 4 }
		};
		state = kernel.stepSync(state, elsewhere).nextState;
		const xElsewhere: KernelAction = {
			type: "place",
			position: { row: 4, col: 0 }
		};
		state = kernel.stepSync(state, xElsewhere).nextState;
		expect(
			kernel.legalActions(state, 1).some(
				(a) =>
					a.type === "place" &&
					a.position.row === 1 &&
					a.position.col === 1
			)
		).toBe(true);
		state = kernel.stepSync(state, recapture).nextState;
		expect(getCell(state.grid, { row: 1, col: 2 })).toBe(null);
		expect(state.positionHistory!.length).toBe(5);

		const script: KernelAction[] = [
			capture,
			elsewhere,
			xElsewhere,
			recapture
		];
		const replay = replayActions(gameConfig, script, cfg.rng.seed);
		expect(replay.faithful).toBe(true);
		expect(replay.finalState.positionHistory).toEqual(
			state.positionHistory
		);
	});

	it("enforces situational superko: same (board, side) cycle illegal; pass keeps history", () => {
		const cfg = structuredClone(
			examplePresets["go-lite-situational-superko"].config
		);
		cfg.initial = [
			{ row: 0, col: 1, player: "X", visibility: "public" },
			{ row: 0, col: 2, player: "O", visibility: "public" },
			{ row: 1, col: 0, player: "X", visibility: "public" },
			{ row: 1, col: 1, player: "O", visibility: "public" },
			{ row: 1, col: 3, player: "O", visibility: "public" },
			{ row: 2, col: 1, player: "X", visibility: "public" },
			{ row: 2, col: 2, player: "O", visibility: "public" }
		];
		const { kernel, gameConfig } = compileConfig(cfg);
		let state = kernel.initialState(cfg.rng.seed);
		const initialHash = situationHash(state.grid, state.currentPlayer);
		expect(state.positionHistory).toEqual([initialHash]);

		const capture: KernelAction = {
			type: "place",
			position: { row: 1, col: 2 }
		};
		state = kernel.stepSync(state, capture).nextState;
		expect(getCell(state.grid, { row: 1, col: 1 })).toBe(null);
		expect(state.koPoint).toBeNull();
		expect(state.positionHistory).toHaveLength(2);
		expect(state.positionHistory![0]).toBe(initialHash);
		expect(state.positionHistory![1]).toBe(
			situationHash(state.grid, state.currentPlayer)
		);

		const recapture: KernelAction = {
			type: "place",
			position: { row: 1, col: 1 }
		};
		expect(
			kernel.legalActions(state, 1).some(
				(a) =>
					a.type === "place" &&
					a.position.row === 1 &&
					a.position.col === 1
			)
		).toBe(false);
		const ignored = kernel.stepSync(state, recapture);
		expect(ignored.events[0]).toMatchObject({
			type: "ignored",
			reason: "superko"
		});
		expect(ignored.nextState).toBe(state);

		const histAfterCapture = state.positionHistory!.length;
		state = kernel.stepSync(state, { type: "pass" }).nextState;
		expect(state.positionHistory).toHaveLength(histAfterCapture);

		state = kernel.initialState(cfg.rng.seed);
		state = kernel.stepSync(state, capture).nextState;
		const elsewhere: KernelAction = {
			type: "place",
			position: { row: 4, col: 4 }
		};
		state = kernel.stepSync(state, elsewhere).nextState;
		const xElsewhere: KernelAction = {
			type: "place",
			position: { row: 4, col: 0 }
		};
		state = kernel.stepSync(state, xElsewhere).nextState;
		expect(
			kernel.legalActions(state, 1).some(
				(a) =>
					a.type === "place" &&
					a.position.row === 1 &&
					a.position.col === 1
			)
		).toBe(true);
		state = kernel.stepSync(state, recapture).nextState;
		expect(getCell(state.grid, { row: 1, col: 2 })).toBe(null);
		expect(state.positionHistory!.length).toBe(5);

		const script: KernelAction[] = [
			capture,
			elsewhere,
			xElsewhere,
			recapture
		];
		const replay = replayActions(gameConfig, script, cfg.rng.seed);
		expect(replay.faithful).toBe(true);
		expect(replay.finalState.positionHistory).toEqual(
			state.positionHistory
		);
	});

	it("rejects unpaired liberties / area_control", () => {
		const bad = structuredClone(examplePresets["go-lite"].config);
		bad.objective.mode = "n_in_a_row";
		bad.win = {
			length: 3,
			adjacency: {
				mode: "linear",
				horizontal: true,
				vertical: true,
				backDiagonal: false,
				forwardDiagonal: false
			}
		};
		expect(validateConfig(bad).ok).toBe(false);
	});

	it("captures via liberties then scores after two passes (compiler→kernel)", () => {
		const cfg = examplePresets["go-lite"].config;
		const { kernel, gameConfig } = compileConfig(cfg);

		// Script surrounds O at (2,2) on a 5×5 and captures, then both pass.
		// X places N/W/E first; O places elsewhere; X closes south.
		const script: KernelAction[] = [
			{ type: "place", position: { row: 1, col: 2 } }, // X north of center
			{ type: "place", position: { row: 0, col: 0 } }, // O corner
			{ type: "place", position: { row: 2, col: 1 } }, // X west
			{ type: "place", position: { row: 2, col: 2 } }, // O center (target)
			{ type: "place", position: { row: 2, col: 3 } }, // X east
			{ type: "place", position: { row: 0, col: 4 } }, // O far
			{ type: "place", position: { row: 3, col: 2 } }, // X south → capture O
			{ type: "pass" }, // O
			{ type: "pass" } // X — end
		];

		let state = kernel.initialState(cfg.rng.seed);
		for (const action of script) {
			const player = playerIdOf(state.currentPlayer);
			expect(
				kernel.legalActions(state, player).some((a) => {
					if (a.type !== action.type) return false;
					if (a.type === "place" && action.type === "place") {
						return (
							a.position.row === action.position.row &&
							a.position.col === action.position.col
						);
					}
					return a.type === "pass" && action.type === "pass";
				})
			).toBe(true);
			const result = kernel.stepSync(state, action);
			expect(result.events[0]?.type).toBe("actionApplied");
			state = result.nextState;
		}

		expect(getCell(state.grid, { row: 2, col: 2 })).toBe(null);
		expect(state.status).not.toBe("playing");
		expect(state.winner).toBe("X");

		const replay = replayActions(gameConfig, script, cfg.rng.seed);
		expect(replay.faithful).toBe(true);
		expect(replay.finalState.status).toBe(state.status);
		expect(replay.finalState.winner).toBe("X");
	});

	it("ignores pass outside area_control", () => {
		const { kernel } = compileConfig(examplePresets["tic-tac-toe"].config);
		const state = kernel.initialState();
		const result = kernel.stepSync(state, { type: "pass" });
		expect(result.events[0]?.type).toBe("ignored");
		expect(result.nextState).toBe(state);
	});
});

describe("createInitialState consecutivePasses + koPoint", () => {
	it("seeds consecutivePasses at 0, endgamePhase false, markingPhase false, and koPoint null", () => {
		const config: GameConfig = {
			gridWidth: 5,
			gridHeight: 5,
			winLength: 3,
			adjacency: {
				mode: "linear",
				horizontal: true,
				vertical: true,
				backDiagonal: false,
				forwardDiagonal: false
			},
			captureEnabled: true,
			captureMode: "liberties",
			koRule: "point",
			koEnabled: true,
			objectiveMode: "area_control"
		};
		const state = createInitialState(config);
		expect(state.consecutivePasses).toBe(0);
		expect(state.endgamePhase).toBe(false);
		expect(state.markingPhase).toBe(false);
		expect(state.markedDead).toEqual([]);
		expect(state.koPoint).toBeNull();
		expect(state.positionHistory).toBeUndefined();
	});

	it("seeds positionHistory for positional superko", () => {
		const config: GameConfig = {
			gridWidth: 5,
			gridHeight: 5,
			winLength: 3,
			adjacency: {
				mode: "linear",
				horizontal: true,
				vertical: true,
				backDiagonal: false,
				forwardDiagonal: false
			},
			captureEnabled: true,
			captureMode: "liberties",
			koRule: "positional",
			koEnabled: true,
			objectiveMode: "area_control"
		};
		const state = createInitialState(config);
		expect(state.positionHistory).toEqual([
			boardPositionHash(state.grid)
		]);
	});

	it("seeds positionHistory for situational superko with side-to-move", () => {
		const config: GameConfig = {
			gridWidth: 5,
			gridHeight: 5,
			winLength: 3,
			adjacency: {
				mode: "linear",
				horizontal: true,
				vertical: true,
				backDiagonal: false,
				forwardDiagonal: false
			},
			captureEnabled: true,
			captureMode: "liberties",
			koRule: "situational",
			koEnabled: true,
			objectiveMode: "area_control"
		};
		const state = createInitialState(config);
		expect(state.positionHistory).toEqual([
			situationHash(state.grid, state.currentPlayer)
		]);
		expect(state.positionHistory![0]).toContain("|X");
	});
});

describe("Hex Go Lite (liberties on hex_offset)", () => {
	/** Cube-axis neighbors of odd-r (1,1): six cells, two beyond von Neumann-4. */
	const HEX_CENTER = { row: 1, col: 1 };
	const HEX_LIBS_OF_CENTER = [
		{ row: 0, col: 1 },
		{ row: 0, col: 2 },
		{ row: 1, col: 0 },
		{ row: 1, col: 2 },
		{ row: 2, col: 1 },
		{ row: 2, col: 2 }
	];
	const ORTHO_LIBS_OF_CENTER = [
		{ row: 0, col: 1 },
		{ row: 1, col: 0 },
		{ row: 1, col: 2 },
		{ row: 2, col: 1 }
	];

	it("counts six cube-axis liberties on hex (four on rectangle)", () => {
		let g = gridOf(5, 5, Array(25).fill(null));
		g = { ...g, cells: setCell(g, HEX_CENTER, "X") };
		const group = findGroup(g, HEX_CENTER, false, "hex_offset");
		expect(countLiberties(g, group, false, "hex_offset")).toBe(6);
		expect(countLiberties(g, group, false, "rectangle")).toBe(4);
	});

	it("four orthogonal surrounds do not capture on hex (still two hex liberties)", () => {
		let g = gridOf(5, 5, Array(25).fill(null));
		g = { ...g, cells: setCell(g, HEX_CENTER, "O") };
		for (const p of ORTHO_LIBS_OF_CENTER.slice(0, 3)) {
			g = { ...g, cells: setCell(g, p, "X") };
		}
		const last = ORTHO_LIBS_OF_CENTER[3]!;
		const afterPlace = setCell(g, last, "X");
		const rectCap = applyLibertyCapture(
			{ ...g, cells: afterPlace },
			last,
			"X",
			false,
			"rectangle"
		);
		expect(getCell({ ...g, cells: rectCap.cells }, HEX_CENTER)).toBe(null);

		const hexCap = applyLibertyCapture(
			{ ...g, cells: afterPlace },
			last,
			"X",
			false,
			"hex_offset"
		);
		expect(getCell({ ...g, cells: hexCap.cells }, HEX_CENTER)).toBe("O");
		expect(hexCap.removed).toEqual([]);
	});

	it("six cube-axis surrounds capture on hex", () => {
		let g = gridOf(5, 5, Array(25).fill(null));
		g = { ...g, cells: setCell(g, HEX_CENTER, "O") };
		for (const p of HEX_LIBS_OF_CENTER.slice(0, 5)) {
			g = { ...g, cells: setCell(g, p, "X") };
		}
		const last = HEX_LIBS_OF_CENTER[5]!;
		expect(
			isLegalLibertyPlace(g, last, "X", false, { topology: "hex_offset" })
		).toBe(true);
		const afterPlace = setCell(g, last, "X");
		const after = applyLibertyCapture(
			{ ...g, cells: afterPlace },
			last,
			"X",
			false,
			"hex_offset"
		);
		expect(getCell({ ...g, cells: after.cells }, HEX_CENTER)).toBe(null);
		expect(after.removed).toEqual([HEX_CENTER]);
	});

	it("rejects suicide when all six hex liberties are filled", () => {
		let g = gridOf(5, 5, Array(25).fill(null));
		for (const p of HEX_LIBS_OF_CENTER) {
			g = { ...g, cells: setCell(g, p, "O") };
		}
		expect(
			isLegalLibertyPlace(g, HEX_CENTER, "X", false, {
				topology: "hex_offset"
			})
		).toBe(false);
	});

	it("validates and compiles the hex-go-lite preset", () => {
		const cfg = examplePresets["hex-go-lite"].config;
		expect(validateConfig(cfg).ok).toBe(true);
		const { kernel, gameConfig } = compileConfig(cfg);
		expect(gameConfig.topology).toBe("hex_offset");
		expect(gameConfig.captureMode).toBe("liberties");
		expect(gameConfig.objectiveMode).toBe("area_control");
		const state = kernel.initialState(cfg.rng.seed);
		expect(kernel.legalActions(state, 0).some((a) => a.type === "pass")).toBe(
			true
		);
	});

	it("rejects hex + flip capture (liberties foothold only)", () => {
		const result = validateConfig({
			metadata: { name: "bad-hex-flip", version: 1 },
			grid: { width: 5, height: 5, topology: "hex_offset", wrap: false },
			turn: { mode: "turn" },
			rng: { seed: 1 },
			input: { mode: "cell" },
			placement: {
				mode: "direct",
				capture: { enabled: true, mode: "flip" },
				overflow: "reject"
			},
			observation: { mode: "full" },
			objective: { mode: "n_in_a_row" },
			win: {
				length: 3,
				adjacency: {
					mode: "linear",
					horizontal: true,
					vertical: true,
					backDiagonal: true,
					forwardDiagonal: false
				}
			}
		});
		expect(result.ok).toBe(false);
	});

	it("kernel capture + pass-pass scoring replay on hex-go-lite", () => {
		const cfg = structuredClone(examplePresets["hex-go-lite"].config);
		// Seed O at center with five of six hex liberties filled by X
		cfg.initial = [
			{ row: 1, col: 1, player: "O", visibility: "public" },
			{ row: 0, col: 1, player: "X", visibility: "public" },
			{ row: 0, col: 2, player: "X", visibility: "public" },
			{ row: 1, col: 0, player: "X", visibility: "public" },
			{ row: 1, col: 2, player: "X", visibility: "public" },
			{ row: 2, col: 1, player: "X", visibility: "public" }
		];
		const { kernel, gameConfig } = compileConfig(cfg);
		let state = kernel.initialState(cfg.rng.seed);
		const capture: KernelAction = {
			type: "place",
			position: { row: 2, col: 2 }
		};
		expect(
			kernel.legalActions(state, 0).some(
				(a) =>
					a.type === "place" &&
					a.position.row === 2 &&
					a.position.col === 2
			)
		).toBe(true);
		const applied = kernel.stepSync(state, capture);
		expect(applied.events[0]?.type).toBe("actionApplied");
		state = applied.nextState;
		expect(getCell(state.grid, HEX_CENTER)).toBe(null);
		expect(state.koPoint).toEqual(HEX_CENTER);

		state = kernel.stepSync(state, { type: "pass" }).nextState;
		state = kernel.stepSync(state, { type: "pass" }).nextState;
		expect(state.status === "won" || state.status === "draw").toBe(true);

		const replay = replayActions(gameConfig, [capture], cfg.rng.seed);
		expect(replay.faithful).toBe(true);
		expect(getCell(replay.finalState.grid, HEX_CENTER)).toBe(null);
	});
});

describe("Graph Go Lite (liberties on graph)", () => {
	/** Bridge graph hub (1,1): three edge neighbors — not four orthogonal. */
	const HUB = { row: 1, col: 1 };
	const GRAPH_LIBS_OF_HUB = [
		{ row: 0, col: 1 },
		{ row: 2, col: 0 },
		{ row: 2, col: 2 }
	];
	const bridgeGraph = buildGraphTopologyData(
		[
			{ row: 0, col: 0 },
			{ row: 0, col: 1 },
			{ row: 0, col: 2 },
			{ row: 1, col: 1 },
			{ row: 2, col: 0 },
			{ row: 2, col: 2 }
		],
		[
			["0,0", "0,1"],
			["0,1", "0,2"],
			["0,1", "1,1"],
			["1,1", "2,0"],
			["1,1", "2,2"],
			["2,0", "2,2"]
		]
	);

	it("counts three graph-edge liberties at hub (four on rectangle)", () => {
		let g = gridOf(3, 3, Array(9).fill(null));
		g = { ...g, cells: setCell(g, HUB, "X") };
		const group = findGroup(g, HUB, false, "graph", bridgeGraph);
		expect(countLiberties(g, group, false, "graph", bridgeGraph)).toBe(3);
		expect(countLiberties(g, group, false, "rectangle")).toBe(4);
	});

	it("orthogonal surrounds that are not edges do not capture on graph", () => {
		let g = gridOf(3, 3, Array(9).fill(null));
		g = { ...g, cells: setCell(g, HUB, "O") };
		// Fill only the one shared ortho+graph liberty plus two inactive orthos
		// — on graph, hub still has (2,0) and (2,2) free.
		g = { ...g, cells: setCell(g, { row: 0, col: 1 }, "X") };
		g = { ...g, cells: setCell(g, { row: 1, col: 0 }, "X") };
		g = { ...g, cells: setCell(g, { row: 1, col: 2 }, "X") };
		const last = { row: 2, col: 1 };
		const afterPlace = setCell(g, last, "X");
		const rectCap = applyLibertyCapture(
			{ ...g, cells: afterPlace },
			last,
			"X",
			false,
			"rectangle"
		);
		expect(getCell({ ...g, cells: rectCap.cells }, HUB)).toBe(null);

		const graphCap = applyLibertyCapture(
			{ ...g, cells: afterPlace },
			last,
			"X",
			false,
			"graph",
			bridgeGraph
		);
		expect(getCell({ ...g, cells: graphCap.cells }, HUB)).toBe("O");
		expect(graphCap.removed).toEqual([]);
	});

	it("three graph-edge surrounds capture on graph", () => {
		let g = gridOf(3, 3, Array(9).fill(null));
		g = { ...g, cells: setCell(g, HUB, "O") };
		for (const p of GRAPH_LIBS_OF_HUB.slice(0, 2)) {
			g = { ...g, cells: setCell(g, p, "X") };
		}
		const last = GRAPH_LIBS_OF_HUB[2]!;
		expect(
			isLegalLibertyPlace(g, last, "X", false, {
				topology: "graph",
				graph: bridgeGraph
			})
		).toBe(true);
		const afterPlace = setCell(g, last, "X");
		const after = applyLibertyCapture(
			{ ...g, cells: afterPlace },
			last,
			"X",
			false,
			"graph",
			bridgeGraph
		);
		expect(getCell({ ...g, cells: after.cells }, HUB)).toBe(null);
		expect(after.removed).toEqual([HUB]);
	});

	it("rejects suicide when all graph liberties are filled", () => {
		// Leaf (0,0) has only one edge neighbor (0,1). Filling it with O that
		// still has outward liberties makes (0,0) a pure suicide (no capture).
		let g = gridOf(3, 3, Array(9).fill(null));
		g = { ...g, cells: setCell(g, { row: 0, col: 1 }, "O") };
		expect(
			isLegalLibertyPlace(g, { row: 0, col: 0 }, "X", false, {
				topology: "graph",
				graph: bridgeGraph
			})
		).toBe(false);
	});

	it("scoreArea ignores inactive lattice cells on graph", () => {
		let g = gridOf(3, 3, Array(9).fill(null));
		g = { ...g, cells: setCell(g, { row: 0, col: 0 }, "X") };
		g = { ...g, cells: setCell(g, { row: 0, col: 1 }, "X") };
		g = { ...g, cells: setCell(g, { row: 0, col: 2 }, "X") };
		// Inactive (1,0) left empty — must not inflate X territory on graph
		const graphScore = scoreArea(g, false, "graph", bridgeGraph);
		const rectScore = scoreArea(g, false, "rectangle");
		expect(graphScore.X).toBeLessThan(rectScore.X);
		expect(graphScore.X).toBeGreaterThanOrEqual(3);
	});

	it("validates and compiles the graph-go-lite preset", () => {
		const cfg = examplePresets["graph-go-lite"].config;
		expect(validateConfig(cfg).ok).toBe(true);
		const { kernel, gameConfig } = compileConfig(cfg);
		expect(gameConfig.topology).toBe("graph");
		expect(gameConfig.captureMode).toBe("liberties");
		expect(gameConfig.objectiveMode).toBe("area_control");
		expect(gameConfig.graph?.active).toHaveLength(6);
		const state = kernel.initialState(cfg.rng.seed);
		expect(kernel.legalActions(state, 0).some((a) => a.type === "pass")).toBe(
			true
		);
		// Inactive lattice cells are not legal places
		expect(
			kernel.legalActions(state, 0).some(
				(a) =>
					a.type === "place" &&
					a.position.row === 1 &&
					a.position.col === 0
			)
		).toBe(false);
	});

	it("rejects graph + flip capture (liberties foothold only)", () => {
		const result = validateConfig({
			metadata: { name: "bad-graph-flip", version: 1 },
			grid: {
				width: 3,
				height: 3,
				topology: "graph",
				wrap: false,
				nodes: [
					{ row: 0, col: 0 },
					{ row: 0, col: 1 },
					{ row: 1, col: 1 }
				],
				edges: [
					["0,0", "0,1"],
					["0,1", "1,1"]
				]
			},
			turn: { mode: "turn" },
			rng: { seed: 1 },
			input: { mode: "cell" },
			placement: {
				mode: "direct",
				capture: { enabled: true, mode: "flip" },
				overflow: "reject"
			},
			observation: { mode: "full" },
			objective: { mode: "n_in_a_row" },
			win: {
				length: 3,
				adjacency: {
					mode: "composite",
					horizontal: false,
					vertical: false,
					backDiagonal: false,
					forwardDiagonal: false
				}
			}
		});
		expect(result.ok).toBe(false);
	});

	it("kernel capture + pass-pass scoring replay on graph-go-lite", () => {
		const cfg = structuredClone(examplePresets["graph-go-lite"].config);
		// Seed O at hub with two of three graph liberties filled by X
		cfg.initial = [
			{ row: 1, col: 1, player: "O", visibility: "public" },
			{ row: 0, col: 1, player: "X", visibility: "public" },
			{ row: 2, col: 0, player: "X", visibility: "public" }
		];
		const { kernel, gameConfig } = compileConfig(cfg);
		let state = kernel.initialState(cfg.rng.seed);
		const capture: KernelAction = {
			type: "place",
			position: { row: 2, col: 2 }
		};
		expect(
			kernel.legalActions(state, 0).some(
				(a) =>
					a.type === "place" &&
					a.position.row === 2 &&
					a.position.col === 2
			)
		).toBe(true);
		const applied = kernel.stepSync(state, capture);
		expect(applied.events[0]?.type).toBe("actionApplied");
		state = applied.nextState;
		expect(getCell(state.grid, HUB)).toBe(null);
		expect(state.koPoint).toEqual(HUB);

		state = kernel.stepSync(state, { type: "pass" }).nextState;
		state = kernel.stepSync(state, { type: "pass" }).nextState;
		expect(state.status === "won" || state.status === "draw").toBe(true);

		const replay = replayActions(gameConfig, [capture], cfg.rng.seed);
		expect(replay.faithful).toBe(true);
		expect(getCell(replay.finalState.grid, HUB)).toBe(null);
	});
});
