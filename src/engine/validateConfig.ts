import type { Config } from "@/schemas/config";
import { zConfig } from "@/schemas/config";
import {
	Contracts,
	type FeatureContract,
	checkContracts
} from "@/engine/contracts";

export type ValidationResult = {
	ok: boolean;
	errors: string[];
	warnings?: string[];
};

/** Build contracts for every feature the config actually selects. */
export function buildFeatureContracts(cfg: Config): FeatureContract[] {
	const features: FeatureContract[] = [];

	// Base board + adjacency (objectives and capture need them)
	features.push(Contracts.BoardWritable());
	features.push(Contracts.AdjacencyProvided());

	// Input mode
	if (cfg.input.mode === "cell") features.push(Contracts.InputTargetCell());
	if (cfg.input.mode === "column") features.push(Contracts.InputTargetColumn());

	// Placement policy
	if (cfg.placement.mode === "direct") {
		features.push(Contracts.PlacementDirect());
	}
	if (cfg.placement.mode === "gravity") {
		features.push(Contracts.GravityAxis());
		features.push(Contracts.PlacementGravity());
	}

	// Overflow
	if (cfg.placement.overflow === "reject") {
		features.push(Contracts.OverflowReject());
	} else if (cfg.placement.overflow === "pop_out_bottom") {
		features.push(Contracts.OverflowPopOutBottom());
	}

	// Capture
	if (cfg.placement.capture?.enabled) features.push(Contracts.Capture());

	// End condition (n-in-a-row is the only objective today)
	features.push(Contracts.NInARow());

	return features;
}

export function validateConfig(cfg: unknown): ValidationResult {
	const parsed = zConfig.safeParse(cfg);
	if (!parsed.success) {
		const issues = parsed.error.issues.map(
			(i) => `${i.path.join(".") || "root"}: ${i.message}`
		);
		return { ok: false, errors: issues };
	}
	const contracts = buildFeatureContracts(parsed.data);
	const contractErrors = checkContracts(contracts);
	if (contractErrors.length > 0) return { ok: false, errors: contractErrors };
	return { ok: true, errors: [], warnings: [] };
}

export type ZodLikeIssue = {
	code: "custom";
	path: (string | number)[];
	message: string;
};

export function contractErrorsToZodIssues(errors: string[]): ZodLikeIssue[] {
	return errors.map((message) => ({ code: "custom", path: ["root"], message }));
}
