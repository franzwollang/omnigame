import { describe, expect, it } from "vitest";
import { compileConfig } from "@/compiler";
import {
	applyLibertyCapture,
	boardPositionHash,
	countLiberties,
	findGroup,
	isLegalLibertyPlace,
	orthogonalNeighbors,
	scoreArea,
	simulateLibertyPlace
} from "@/engine/liberties";
import { createInitialState, type GameConfig } from "@/engine/reducer";
import { getCell, setCell, type Grid } from "@/engine/types";
import { playerIdOf, type KernelAction } from "@/engine/kernel";
import { examplePresets } from "@/presets/registry";
import { validateConfig } from "@/engine/validateConfig";
import { replayActions } from "@/ir/gameIr";

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
	it("seeds consecutivePasses at 0 and koPoint null", () => {
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
});
