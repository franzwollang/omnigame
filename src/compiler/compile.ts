/**
 * Compile pipeline: validate → normalize (macros) → GameKernel builder.
 */
import { zConfig, type Config } from "@/schemas/config";
import {
	buildFeatureContracts,
	validateConfig,
	type ValidationResult
} from "@/engine/validateConfig";
import { checkContracts } from "@/engine/contracts";
import {
	createGameKernel,
	type GameKernel
} from "@/engine/kernel";
import type { GameConfig } from "@/engine/reducer";
import {
	normalizeConfig,
	type NormalizeResult
} from "@/compiler/normalize";
import type { MacroExpansion } from "@/compiler/macros";

export type CompileSuccess = {
	ok: true;
	errors: [];
	warnings: string[];
	config: Config;
	normalized: Config;
	gameConfig: GameConfig;
	kernel: GameKernel;
	expansions: MacroExpansion[];
};

export type CompileFailure = {
	ok: false;
	errors: string[];
	warnings?: string[];
	config?: undefined;
	normalized?: undefined;
	gameConfig?: undefined;
	kernel?: undefined;
	expansions?: undefined;
};

export type CompileResult = CompileSuccess | CompileFailure;

/**
 * Full pipeline from unknown JSON/spec → validated, normalized GameKernel.
 * Order: Zod+contracts on input → expand macros → re-check contracts → kernel.
 */
export function compile(input: unknown): CompileResult {
	const structural: ValidationResult = validateConfig(input);
	if (!structural.ok) {
		return { ok: false, errors: structural.errors };
	}

	const parsed = zConfig.safeParse(input);
	if (!parsed.success) {
		const errors = parsed.error.issues.map(
			(i) => `${i.path.join(".") || "root"}: ${i.message}`
		);
		return { ok: false, errors };
	}

	const { normalized, gameConfig, expansions } = normalizeConfig(parsed.data);
	if (!normalized) {
		return { ok: false, errors: ["normalize produced no config"] };
	}

	const postMacroErrors = checkContracts(buildFeatureContracts(normalized));
	if (postMacroErrors.length > 0) {
		return { ok: false, errors: postMacroErrors };
	}

	const kernel = createGameKernel(gameConfig);

	return {
		ok: true,
		errors: [],
		warnings: structural.warnings ?? [],
		config: parsed.data,
		normalized,
		gameConfig,
		kernel,
		expansions
	};
}

/** Compile a known-good Config (e.g. preset) without re-parsing unknown JSON. */
export function compileConfig(config: Config): CompileSuccess {
	const result = compile(config);
	if (!result.ok) {
		throw new Error(
			`compileConfig failed on presumed-valid Config: ${result.errors.join("; ")}`
		);
	}
	return result;
}

/** Normalize-only helper used by the sandbox play loop. */
export function compileToGameConfig(
	config: Config | null | undefined
): NormalizeResult {
	return normalizeConfig(config);
}
