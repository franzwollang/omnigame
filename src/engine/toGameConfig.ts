/**
 * @deprecated Import `normalizeConfig` / `compileToGameConfig` from `@/compiler`.
 * Kept as a thin re-export so older call sites keep typechecking during M3.
 */
import type { Config } from "@/schemas/config";
import type { GameConfig } from "@/engine/reducer";
import { normalizeConfig } from "@/compiler/normalize";

/** Map a validated (or default) sandbox config into the flat engine shape. */
export function toGameConfig(config: Config | null | undefined): GameConfig {
	return normalizeConfig(config).gameConfig;
}
