/**
 * OmniGame compiler: validate → expand macros → normalize → GameKernel.
 *
 * Sandbox / presets should enter through this module rather than owning
 * Config→GameConfig adapters themselves.
 */
export { expandMacros, expandGravityEnabled, expandPlacementsToInitial } from "@/compiler/macros";
export type { MacroExpansion, MacroResult } from "@/compiler/macros";

export {
	flattenToGameConfig,
	normalizeConfig
} from "@/compiler/normalize";
export type { NormalizeResult } from "@/compiler/normalize";

export { compile, compileConfig, compileToGameConfig } from "@/compiler/compile";
export type {
	CompileResult,
	CompileSuccess,
	CompileFailure
} from "@/compiler/compile";
