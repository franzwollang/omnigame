/**
 * Batch explore: sample many configs and classify playable vs noise (M7).
 */
import {
	assessPlayability,
	type AssessOptions
} from "@/library/playability";
import {
	createSamplerRng,
	sampleRawConfig
} from "@/library/sample";
import type {
	ExploreOptions,
	ExploreSummary,
	SampledConfig
} from "@/library/types";
import { zConfig, type Config } from "@/schemas/config";
import { validateConfig } from "@/engine/validateConfig";

const DEFAULT_COUNT = 24;
const DEFAULT_COHERENT = 0.35;

/**
 * Sample `count` configs from seed, classify each, return a summary.
 * Deterministic for a given seed + options.
 */
export function exploreLibrary(
	opts: ExploreOptions = {}
): ExploreSummary {
	const seed = (opts.seed ?? 1) >>> 0;
	const count = Math.max(1, opts.count ?? DEFAULT_COUNT);
	const coherentFraction = clamp01(opts.coherentFraction ?? DEFAULT_COHERENT);
	const assessOpts: AssessOptions = {
		seed,
		maxPlayoutSteps: opts.maxPlayoutSteps
	};

	const rng = createSamplerRng(seed);
	const samples: SampledConfig[] = [];
	let invalid = 0;
	let unplayable = 0;
	let noise = 0;
	let playable = 0;

	for (let i = 0; i < count; i++) {
		const itemSeed = (seed + i * 0x9e3779b9) >>> 0;
		const coherent = rng() < coherentFraction;
		const raw = sampleRawConfig(rng, { seed: itemSeed, coherent });
		const playability = assessPlayability(raw, {
			...assessOpts,
			seed: itemSeed
		});

		let config: Config | undefined;
		if (playability.kind !== "invalid") {
			const structural = validateConfig(raw);
			if (structural.ok) {
				const parsed = zConfig.safeParse(raw);
				if (parsed.success) config = parsed.data;
			}
		}

		switch (playability.kind) {
			case "invalid":
				invalid += 1;
				break;
			case "unplayable":
				unplayable += 1;
				break;
			case "noise":
				noise += 1;
				break;
			case "playable":
				playable += 1;
				break;
		}

		samples.push({
			id: `${seed}-${i}`,
			seed: itemSeed,
			index: i,
			raw,
			config,
			playability
		});
	}

	return {
		seed,
		count,
		invalid,
		unplayable,
		noise,
		playable,
		samples
	};
}

/** Playable samples only, highest score first (for UI "load into sandbox"). */
export function playableSamples(
	summary: ExploreSummary
): SampledConfig[] {
	return summary.samples
		.filter((s) => s.playability.kind === "playable" && s.config)
		.sort(
			(a, b) =>
				(b.playability.score ?? 0) - (a.playability.score ?? 0) ||
				a.index - b.index
		);
}

function clamp01(n: number): number {
	if (n < 0) return 0;
	if (n > 1) return 1;
	return n;
}
