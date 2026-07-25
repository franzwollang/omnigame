import { describe, expect, it } from "vitest";
import { examplePresets } from "@/presets/registry";
import {
	buildFeatureContracts,
	validateConfig
} from "@/engine/validateConfig";
import { checkContracts } from "@/engine/contracts";

describe("buildFeatureContracts", () => {
	it("wires input, overflow, placement, capture, and end for presets", () => {
		const ttt = buildFeatureContracts(examplePresets["tic-tac-toe"].config);
		expect(ttt.map((c) => c.id).sort()).toEqual(
			[
				"AdjacencyProvided",
				"BoardWritable",
				"InputTargetCell",
				"NInARow",
				"OverflowReject",
				"PlacementDirect"
			].sort()
		);

		const c4 = buildFeatureContracts(examplePresets["connect-4"].config);
		expect(c4.map((c) => c.id)).toEqual(
			expect.arrayContaining([
				"InputTargetColumn",
				"GravityAxis",
				"PlacementGravity",
				"OverflowReject",
				"NInARow"
			])
		);

		const battle = buildFeatureContracts(
			examplePresets["battleship-lite"].config
		);
		expect(battle.map((c) => c.id).sort()).toEqual(
			[
				"BoardWritable",
				"DestroyHidden",
				"InputTargetCell",
				"ObservationHitMiss",
				"OverflowReject",
				"PlacementDirect"
			].sort()
		);
		expect(battle.map((c) => c.id)).not.toContain("NInARow");
		expect(battle.map((c) => c.id)).not.toContain("AdjacencyProvided");

		const race = buildFeatureContracts(examplePresets["step-race"].config);
		expect(race.map((c) => c.id).sort()).toEqual(
			["BoardWritable", "InputMove", "ReachRow"].sort()
		);
		expect(race.map((c) => c.id)).not.toContain("NInARow");
		expect(race.map((c) => c.id)).not.toContain("PlacementDirect");
		expect(checkContracts(race)).toEqual([]);

		const pop = buildFeatureContracts(
			examplePresets["connect-4-popout"].config
		);
		expect(pop.map((c) => c.id)).toEqual(
			expect.arrayContaining(["OverflowPopOutBottom", "PlacementGravity"])
		);

		const capture = buildFeatureContracts(examplePresets.reversi.config);
		expect(capture.map((c) => c.id)).toEqual(
			expect.arrayContaining(["Capture", "PlacementDirect", "InputTargetCell"])
		);
	});

	it("satisfies capability graph for every example preset", () => {
		for (const preset of Object.values(examplePresets)) {
			const errors = checkContracts(buildFeatureContracts(preset.config));
			expect(errors, preset.id).toEqual([]);
		}
	});
});

describe("validateConfig", () => {
	it("accepts Tic-Tac-Toe and Connect 4 presets", () => {
		expect(validateConfig(examplePresets["tic-tac-toe"].config).ok).toBe(true);
		expect(validateConfig(examplePresets["connect-4"].config).ok).toBe(true);
		expect(validateConfig(examplePresets["connect-4-popout"].config).ok).toBe(
			true
		);
		expect(validateConfig(examplePresets.reversi.config).ok).toBe(true);
	});

	it("surfaces Zod composition errors for column without gravity", () => {
		const bad = {
			...examplePresets["tic-tac-toe"].config,
			input: { mode: "column" as const },
			placement: { mode: "direct" as const, overflow: "reject" as const }
		};
		const result = validateConfig(bad);
		expect(result.ok).toBe(false);
		expect(result.errors.some((e) => e.includes("column"))).toBe(true);
	});

	it("surfaces Zod composition errors for pop-out without gravity", () => {
		const bad = {
			...examplePresets["tic-tac-toe"].config,
			placement: {
				mode: "direct" as const,
				overflow: "pop_out_bottom" as const
			}
		};
		const result = validateConfig(bad);
		expect(result.ok).toBe(false);
		expect(result.errors.some((e) => e.includes("overflow"))).toBe(true);
	});
});
