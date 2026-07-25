/**
 * Typed adapter: Zod sandbox `Config` → engine `GameConfig`.
 * Single boundary so the UI never needs `(config as any)`.
 */
import type { Config } from "@/schemas/config";
import type { GameConfig } from "@/engine/reducer";

const DEFAULT_ADJACENCY = {
	mode: "linear" as const,
	horizontal: true,
	vertical: true,
	backDiagonal: true,
	forwardDiagonal: true
};

/** Map a validated (or default) sandbox config into the flat engine shape. */
export function toGameConfig(config: Config | null | undefined): GameConfig {
	return {
		gridWidth: config?.grid.width ?? 3,
		gridHeight: config?.grid.height ?? 3,
		winLength: config?.win.length ?? 3,
		adjacency: config?.win.adjacency ?? DEFAULT_ADJACENCY,
		inputMode: config?.input.mode ?? "cell",
		placementMode: config?.placement.mode ?? "direct",
		gravityDirection: "down",
		overflow: config?.placement.overflow ?? "reject",
		captureEnabled: Boolean(config?.placement.capture?.enabled),
		initial: config?.initial ?? []
	};
}
