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

function buildFeatureContracts(cfg: Config): FeatureContract[] {
	const features: FeatureContract[] = [];
	// Base capabilities present
	// Placement policy
	if (cfg.placement.mode === "direct")
		features.push(Contracts.PlacementDirect());
	if (cfg.placement.mode === "gravity")
		features.push(Contracts.PlacementGravity());
	// Capture
	if (cfg.placement.capture?.enabled) features.push(Contracts.Capture());
	// End condition (n in a row)
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
	// Optional warnings: initial seeds forming an immediate win
	const warnings: string[] = [];
	try {
		// quick heuristic: if win.length = 1 (never true due to schema) or unrealistic seeds > 0 for now skip
	} catch {}
	return { ok: true, errors: [], warnings };
}

export type ZodLikeIssue = {
	code: "custom";
	path: (string | number)[];
	message: string;
};

export function contractErrorsToZodIssues(errors: string[]): ZodLikeIssue[] {
	return errors.map((message) => ({ code: "custom", path: ["root"], message }));
}
