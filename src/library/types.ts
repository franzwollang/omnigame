/**
 * Library explorer types (M7) — sample configs and classify playable vs noise.
 */
import type { Config } from "@/schemas/config";

/** Coarse verdict for a sampled configuration. */
export type PlayabilityKind =
	/** Fails Zod / contracts / compile. */
	| "invalid"
	/** Compiles but has no opening actions (dead start). */
	| "unplayable"
	/** Compiles + legal opening, but random playout never progresses or terminates. */
	| "noise"
	/** Compiles, has legal opening, and random play progresses and/or terminates. */
	| "playable";

export type PlayabilityReport = {
	kind: PlayabilityKind;
	/** Human-readable reason (errors or heuristic notes). */
	reasons: string[];
	/** Successful state-changing steps in the probe playout. */
	stepsTaken: number;
	/** Whether the probe reached won/draw. */
	terminated: boolean;
	/** Opening legal-action count when compile succeeded. */
	openingLegal?: number;
};

export type SampledConfig = {
	/** Stable id for UI lists (seed + index). */
	id: string;
	seed: number;
	index: number;
	/** Raw sampled object (may be invalid). */
	raw: unknown;
	/** Parsed Config when Zod+contracts succeed. */
	config?: Config;
	playability: PlayabilityReport;
};

export type ExploreSummary = {
	seed: number;
	count: number;
	invalid: number;
	unplayable: number;
	noise: number;
	playable: number;
	samples: SampledConfig[];
};

export type ExploreOptions = {
	/** Master seed for the explore batch. */
	seed?: number;
	/** How many configs to sample. */
	count?: number;
	/** Max random playout steps for the playability probe. */
	maxPlayoutSteps?: number;
	/**
	 * Fraction [0,1] of samples drawn from coherent families
	 * (rest are noisy random knobs — Library of Babel framing).
	 */
	coherentFraction?: number;
};
