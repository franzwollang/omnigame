import { describe, expect, it } from "vitest";
import {
	compile,
	compileConfig,
	expandMacros,
	normalizeConfig
} from "@/compiler";
import { examplePresets } from "@/presets/registry";
import type { Config } from "@/schemas/config";

describe("compiler macros", () => {
	it("expands gravity.enabled into placement.mode=gravity", () => {
		const raw = structuredClone(examplePresets["tic-tac-toe"].config);
		raw.placement = {
			mode: "direct",
			overflow: "reject",
			gravity: { enabled: true, direction: "down", wrap: false }
		};
		// column input not required for this macro unit test
		const { config, expansions } = expandMacros(raw);
		expect(config.placement.mode).toBe("gravity");
		expect(expansions.map((e) => e.id)).toContain(
			"gravity.enabled→placement.mode"
		);
	});

	it("expands token placements into initial player seeds", () => {
		const raw = structuredClone(examplePresets["tic-tac-toe"].config);
		raw.placements = [
			{ row: 0, col: 0, tokenId: "X" },
			{ row: 1, col: 1, tokenId: "O" }
		];
		raw.initial = [];
		const { config, expansions } = expandMacros(raw);
		expect(config.initial).toEqual([
			{ row: 0, col: 0, player: "X" },
			{ row: 1, col: 1, player: "O" }
		]);
		expect(expansions.map((e) => e.id)).toContain("placements→initial");
	});

	it("does not overwrite existing initial seeds", () => {
		const raw = structuredClone(examplePresets["tic-tac-toe"].config);
		raw.initial = [{ row: 0, col: 0, player: "O" }];
		raw.placements = [{ row: 0, col: 0, tokenId: "X" }];
		const { config } = expandMacros(raw);
		expect(config.initial).toEqual([{ row: 0, col: 0, player: "O" }]);
	});
});

describe("normalizeConfig / compile", () => {
	it("maps presets to GameConfig via normalize (no sandbox adapter)", () => {
		const { gameConfig } = normalizeConfig(
			examplePresets["connect-4-popout"].config
		);
		expect(gameConfig.gridWidth).toBe(7);
		expect(gameConfig.inputMode).toBe("column");
		expect(gameConfig.placementMode).toBe("gravity");
		expect(gameConfig.overflow).toBe("pop_out_bottom");
	});

	it("compile builds a playable kernel for every preset", () => {
		for (const preset of Object.values(examplePresets)) {
			const result = compile(preset.config);
			expect(result.ok, preset.id).toBe(true);
			if (!result.ok) continue;
			const state = result.kernel.initialState(preset.config.rng.seed);
			expect(state.status).toBe("playing");
			expect(state.grid.width).toBe(preset.config.grid.width);
		}
	});

	it("compileConfig plays Tic-Tac-Toe through the normalized kernel", () => {
		const { kernel } = compileConfig(examplePresets["tic-tac-toe"].config);
		let state = kernel.initialState(1);
		const script = [
			{ type: "place" as const, position: { row: 0, col: 0 } },
			{ type: "place" as const, position: { row: 1, col: 0 } },
			{ type: "place" as const, position: { row: 0, col: 1 } },
			{ type: "place" as const, position: { row: 1, col: 1 } },
			{ type: "place" as const, position: { row: 0, col: 2 } }
		];
		for (const action of script) {
			state = kernel.stepSync(state, action).nextState;
		}
		expect(state.status).toBe("won");
		expect(state.winner).toBe("X");
	});

	it("compile rejects invalid compositions", () => {
		const bad: Config = structuredClone(
			examplePresets["tic-tac-toe"].config
		);
		bad.input.mode = "column";
		bad.placement.mode = "direct";
		const result = compile(bad);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.errors.length).toBeGreaterThan(0);
	});

	it("expands gravity.enabled sugar so column+enabled compiles", () => {
		const raw = structuredClone(examplePresets["connect-4"].config);
		raw.placement = {
			mode: "direct",
			overflow: "reject",
			gravity: { enabled: true, direction: "down", wrap: false }
		};
		const result = compile(raw);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.normalized.placement.mode).toBe("gravity");
		expect(result.gameConfig.placementMode).toBe("gravity");
		expect(result.expansions.map((e) => e.id)).toContain(
			"gravity.enabled→placement.mode"
		);
	});

	it("placements macro seeds the kernel board", () => {
		const cfg = structuredClone(examplePresets["tic-tac-toe"].config);
		cfg.placements = [{ row: 1, col: 1, tokenId: "X" }];
		cfg.initial = [];
		const { kernel, expansions } = compileConfig(cfg);
		expect(expansions.map((e) => e.id)).toContain("placements→initial");
		const state = kernel.initialState();
		const idx = 1 * state.grid.width + 1;
		expect(state.grid.cells[idx]).toBe("X");
	});
});
