import { describe, expect, it } from "vitest";
import { examplePresets } from "@/presets/registry";
import {
	assessPlayability,
	exploreLibrary,
	playableSamples,
	sampleRawConfig,
	createSamplerRng
} from "@/library";

describe("library explorer (M7)", () => {
	it("assesses known presets as playable", () => {
		for (const id of [
			"tic-tac-toe",
			"connect-4",
			"hex-connect-lite",
			"reversi"
		] as const) {
			const preset = examplePresets[id];
			expect(preset, id).toBeDefined();
			const report = assessPlayability(preset!.config, { seed: 42 });
			expect(report.kind, id).toBe("playable");
			expect(report.openingLegal ?? 0).toBeGreaterThan(0);
		}
	});

	it("marks obviously invalid configs as invalid", () => {
		const report = assessPlayability(
			{ metadata: { name: "broken" } },
			{ seed: 1 }
		);
		expect(report.kind).toBe("invalid");
		expect(report.reasons.length).toBeGreaterThan(0);
	});

	it("marks compile-ok but dead-start as unplayable", () => {
		// Full board of X/O leaves no cell places
		const report = assessPlayability(
			{
				metadata: { name: "full", version: 1 },
				grid: { width: 2, height: 2, topology: "rectangle", wrap: false },
				turn: { mode: "turn" },
				rng: { seed: 1 },
				tokens: [
					{ id: "X", players: ["X"] },
					{ id: "O", players: ["O"] }
				],
				input: { mode: "cell" },
				placement: { mode: "direct", overflow: "reject" },
				win: {
					length: 2,
					adjacency: {
						mode: "linear",
						horizontal: true,
						vertical: true,
						backDiagonal: false,
						forwardDiagonal: false
					}
				},
				initial: [
					{ row: 0, col: 0, player: "X" },
					{ row: 0, col: 1, player: "O" },
					{ row: 1, col: 0, player: "O" },
					{ row: 1, col: 1, player: "X" }
				]
			},
			{ seed: 3 }
		);
		// win.length 2 on 2x2 may already be won, or no legal moves
		expect(["unplayable", "invalid", "noise"]).toContain(report.kind);
		if (report.kind === "unplayable") {
			expect(report.openingLegal).toBe(0);
		}
	});

	it("exploreLibrary is deterministic for a seed", () => {
		const a = exploreLibrary({ seed: 99, count: 16, coherentFraction: 0.4 });
		const b = exploreLibrary({ seed: 99, count: 16, coherentFraction: 0.4 });
		expect(a.invalid).toBe(b.invalid);
		expect(a.unplayable).toBe(b.unplayable);
		expect(a.noise).toBe(b.noise);
		expect(a.playable).toBe(b.playable);
		expect(a.samples.map((s) => s.playability.kind)).toEqual(
			b.samples.map((s) => s.playability.kind)
		);
	});

	it("exploreLibrary surfaces a mix; coherent fraction yields some playable", () => {
		const summary = exploreLibrary({
			seed: 7,
			count: 40,
			coherentFraction: 0.5,
			maxPlayoutSteps: 32
		});
		expect(summary.count).toBe(40);
		expect(
			summary.invalid + summary.unplayable + summary.noise + summary.playable
		).toBe(40);
		// Babel framing: not everything is playable
		expect(summary.playable).toBeLessThan(summary.count);
		// With 50% coherent families, we should find at least one playable
		expect(summary.playable).toBeGreaterThan(0);
		const playables = playableSamples(summary);
		expect(playables.length).toBe(summary.playable);
		for (const s of playables) {
			expect(s.config).toBeDefined();
			expect(s.playability.kind).toBe("playable");
		}
	});

	it("noisy samples often fail compile (Babel framing)", () => {
		const rng = createSamplerRng(123);
		let invalidish = 0;
		for (let i = 0; i < 30; i++) {
			const raw = sampleRawConfig(rng, {
				seed: 1000 + i,
				coherent: false
			});
			const report = assessPlayability(raw, { seed: 1000 + i });
			if (report.kind === "invalid" || report.kind === "unplayable") {
				invalidish += 1;
			}
		}
		expect(invalidish).toBeGreaterThan(5);
	});
});
