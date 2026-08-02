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

		const fog = buildFeatureContracts(
			examplePresets["fog-connect-lite"].config
		);
		expect(fog.map((c) => c.id).sort()).toEqual(
			[
				"AdjacencyProvided",
				"BoardWritable",
				"InputTargetCell",
				"NInARow",
				"ObservationFog",
				"OverflowReject",
				"PlacementDirect"
			].sort()
		);
		expect(checkContracts(fog)).toEqual([]);

		const race = buildFeatureContracts(examplePresets["step-race"].config);
		expect(race.map((c) => c.id).sort()).toEqual(
			["BoardWritable", "InputMove", "ReachRow"].sort()
		);
		expect(race.map((c) => c.id)).not.toContain("NInARow");
		expect(race.map((c) => c.id)).not.toContain("PlacementDirect");
		expect(checkContracts(race)).toEqual([]);

		const life = buildFeatureContracts(examplePresets["life-lite"].config);
		expect(life.map((c) => c.id).sort()).toEqual(
			[
				"BoardWritable",
				"InputTargetCell",
				"OpenEnded",
				"OverflowReject",
				"PlacementDirect",
				"SchedulerManualTick"
			].sort()
		);
		expect(checkContracts(life)).toEqual([]);

		const pop = buildFeatureContracts(
			examplePresets["connect-4-popout"].config
		);
		expect(pop.map((c) => c.id)).toEqual(
			expect.arrayContaining(["OverflowPopOutBottom", "PlacementGravity"])
		);

		const popTop = buildFeatureContracts(
			examplePresets["connect-4-up-popout"].config
		);
		expect(popTop.map((c) => c.id)).toEqual(
			expect.arrayContaining(["OverflowPopOutTop", "PlacementGravity"])
		);
		expect(popTop.map((c) => c.id)).not.toContain("OverflowPopOutBottom");
		expect(checkContracts(popTop)).toEqual([]);

		const popRight = buildFeatureContracts(
			examplePresets["connect-4-right-popout"].config
		);
		expect(popRight.map((c) => c.id)).toEqual(
			expect.arrayContaining(["OverflowPopOutRight", "PlacementGravity"])
		);
		expect(popRight.map((c) => c.id)).not.toContain("OverflowPopOutBottom");
		expect(checkContracts(popRight)).toEqual([]);

		const capture = buildFeatureContracts(examplePresets.reversi.config);
		expect(capture.map((c) => c.id)).toEqual(
			expect.arrayContaining(["Capture", "PlacementDirect", "InputTargetCell"])
		);

		const go = buildFeatureContracts(examplePresets["go-lite"].config);
		expect(go.map((c) => c.id).sort()).toEqual(
			[
				"AreaControl",
				"BoardWritable",
				"InputTargetCell",
				"LibertyCapture",
				"OverflowReject",
				"PlacementDirect"
			].sort()
		);
		expect(go.map((c) => c.id)).not.toContain("Capture");
		expect(go.map((c) => c.id)).not.toContain("NInARow");

		const guess = buildFeatureContracts(
			examplePresets["guess-who-lite"].config
		);
		expect(guess.map((c) => c.id).sort()).toEqual(
			[
				"BoardWritable",
				"IdentifySecret",
				"InputDeduction",
				"ObservationDeduction"
			].sort()
		);
		expect(guess.map((c) => c.id)).not.toContain("NInARow");
		expect(guess.map((c) => c.id)).not.toContain("PlacementDirect");
		expect(checkContracts(guess)).toEqual([]);
		expect(validateConfig(examplePresets["guess-who-lite"].config).ok).toBe(
			true
		);
		expect(go.map((c) => c.id)).not.toContain("AdjacencyProvided");
		expect(checkContracts(go)).toEqual([]);
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

	it("surfaces Zod composition errors for row without gravity", () => {
		const bad = {
			...examplePresets["tic-tac-toe"].config,
			input: { mode: "row" as const },
			placement: { mode: "direct" as const, overflow: "reject" as const }
		};
		const result = validateConfig(bad);
		expect(result.ok).toBe(false);
		expect(result.errors.some((e) => e.includes("row"))).toBe(true);
	});

	it("wires InputTargetRow for row gravity configs", () => {
		const ids = buildFeatureContracts(
			examplePresets["connect-4-right"].config
		).map((c) => c.id);
		expect(ids).toEqual(
			expect.arrayContaining([
				"InputTargetRow",
				"GravityAxis",
				"PlacementGravity"
			])
		);
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

	it("accepts ordered simultaneous move with movement.range > 1", () => {
		const base = examplePresets["simultaneous-step-race"].config;
		const ok = {
			...base,
			movement: { ...base.movement!, range: 4 as const },
			turn: {
				mode: "turn" as const,
				schedule: "simultaneous" as const,
				resolveOrder: "x_first" as const
			}
		};
		const result = validateConfig(ok);
		expect(result.ok).toBe(true);
	});

	it("accepts joint simultaneous move with movement.range > 1", () => {
		const base = examplePresets["simultaneous-step-race"].config;
		const ok = {
			...base,
			movement: { ...base.movement!, range: 4 as const }
		};
		const result = validateConfig(ok);
		expect(result.ok).toBe(true);
	});

	it("accepts joint simultaneous move with movement.capture = replace (range 1)", () => {
		const base = examplePresets["simultaneous-step-race"].config;
		const ok = {
			...base,
			movement: { ...base.movement!, capture: "replace" as const }
		};
		const result = validateConfig(ok);
		expect(result.ok).toBe(true);
	});

	it("accepts simultaneous replace with movement.range > 1", () => {
		const base = examplePresets["simultaneous-step-race"].config;
		const ok = {
			...base,
			movement: {
				...base.movement!,
				range: 4 as const,
				capture: "replace" as const
			}
		};
		const result = validateConfig(ok);
		expect(result.ok).toBe(true);
	});
});
