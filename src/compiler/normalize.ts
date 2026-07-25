/**
 * Normalize a validated Zod `Config` into kernel-ready `GameConfig`.
 * Owns Config→GameConfig so the sandbox is not the adapter owner.
 */
import type { Config } from "@/schemas/config";
import type { GameConfig } from "@/engine/reducer";
import { expandMacros, type MacroExpansion } from "@/compiler/macros";

const DEFAULT_ADJACENCY = {
	mode: "linear" as const,
	horizontal: true,
	vertical: true,
	backDiagonal: true,
	forwardDiagonal: true
};

export type NormalizeResult = {
	/** Spec after macro expansion (still Zod-shaped); null when input was empty. */
	normalized: Config | null;
	/** Flat engine config for GameKernel / reducer. */
	gameConfig: GameConfig;
	expansions: MacroExpansion[];
};

/** Flatten a (possibly already expanded) Config into GameConfig. */
export function flattenToGameConfig(config: Config): GameConfig {
	return {
		gridWidth: config.grid.width,
		gridHeight: config.grid.height,
		winLength: config.win?.length ?? 3,
		adjacency: config.win?.adjacency ?? DEFAULT_ADJACENCY,
		inputMode: config.input.mode,
		placementMode: config.placement.mode,
		gravityDirection: "down",
		overflow: config.placement.overflow,
		captureEnabled: Boolean(config.placement.capture?.enabled),
		observationMode: config.observation.mode,
		objectiveMode: config.objective.mode,
		initial: config.initial
	};
}

const DEFAULT_GAME_CONFIG: GameConfig = {
	gridWidth: 3,
	gridHeight: 3,
	winLength: 3,
	adjacency: DEFAULT_ADJACENCY,
	inputMode: "cell",
	placementMode: "direct",
	gravityDirection: "down",
	overflow: "reject",
	captureEnabled: false,
	observationMode: "full",
	objectiveMode: "n_in_a_row",
	initial: []
};

/**
 * Expand macros then flatten. Null/undefined → engine defaults (sandbox boot).
 */
export function normalizeConfig(
	config: Config | null | undefined
): NormalizeResult {
	if (!config) {
		return {
			normalized: null,
			gameConfig: { ...DEFAULT_GAME_CONFIG, initial: [] },
			expansions: []
		};
	}
	const { config: normalized, expansions } = expandMacros(config);
	return {
		normalized,
		gameConfig: flattenToGameConfig(normalized),
		expansions
	};
}
