/**
 * Spec macros / authoring sugar → named primitives.
 *
 * Macros expand before flatten-to-GameConfig. Keep expansions pure and
 * deterministic; never invent runtime behavior the kernel lacks.
 */
import type { Config } from "@/schemas/config";
import type { Player } from "@/engine/types";

export type MacroExpansion = {
	/** Stable id for tests / tooling. */
	id: string;
	/** Human-readable note of what changed. */
	note: string;
};

export type MacroResult = {
	config: Config;
	expansions: MacroExpansion[];
};

function cloneConfig(config: Config): Config {
	return structuredClone(config);
}

/**
 * Sugar: `placement.gravity.enabled: true` implies gravity placement mode
 * and fills default direction/wrap primitives.
 */
export function expandGravityEnabled(config: Config): MacroResult {
	const expansions: MacroExpansion[] = [];
	if (!config.placement.gravity?.enabled) {
		return { config, expansions };
	}

	const next = cloneConfig(config);
	let changed = false;

	if (next.placement.mode !== "gravity") {
		next.placement.mode = "gravity";
		changed = true;
	}

	const gravity = next.placement.gravity ?? {
		enabled: true,
		direction: "down" as const,
		wrap: false as const
	};
	if (!next.placement.gravity) {
		next.placement.gravity = { ...gravity, enabled: true };
		changed = true;
	} else {
		// Preserve explicit direction (down|up); only fill wrap/enabled defaults.
		if (next.placement.gravity.wrap !== false) {
			next.placement.gravity.wrap = false;
			changed = true;
		}
		if (!next.placement.gravity.enabled) {
			next.placement.gravity.enabled = true;
			changed = true;
		}
	}

	if (changed) {
		expansions.push({
			id: "gravity.enabled→placement.mode",
			note: "Expanded gravity.enabled into placement.mode=gravity + direction/wrap primitives"
		});
	}

	return { config: next, expansions };
}

/**
 * Sugar: token `placements` + declared `tokens` → engine `initial` player seeds.
 * Existing `initial` cells win on conflict; canvas may still render token assets.
 */
export function expandPlacementsToInitial(config: Config): MacroResult {
	const expansions: MacroExpansion[] = [];
	if (!config.placements.length || !config.tokens.length) {
		return { config, expansions };
	}

	const tokenPlayer = new Map<string, Player>();
	for (const token of config.tokens) {
		const player = token.players[0];
		if (player) tokenPlayer.set(token.id, player);
	}

	const occupied = new Set(
		config.initial.map((p) => `${p.row},${p.col}`)
	);
	const added: Config["initial"] = [];

	for (const placement of config.placements) {
		const key = `${placement.row},${placement.col}`;
		if (occupied.has(key)) continue;
		const player = tokenPlayer.get(placement.tokenId);
		if (!player) continue;
		added.push({
			row: placement.row,
			col: placement.col,
			player,
			visibility: "public"
		});
		occupied.add(key);
	}

	if (added.length === 0) {
		return { config, expansions };
	}

	const next = cloneConfig(config);
	next.initial = [...next.initial, ...added];
	expansions.push({
		id: "placements→initial",
		note: `Expanded ${added.length} token placement(s) into initial player seeds`
	});
	return { config: next, expansions };
}

const MACRO_PIPELINE = [expandGravityEnabled, expandPlacementsToInitial] as const;

/** Run all macros in order; collect expansion records. */
export function expandMacros(config: Config): MacroResult {
	let current = config;
	const expansions: MacroExpansion[] = [];
	for (const macro of MACRO_PIPELINE) {
		const result = macro(current);
		current = result.config;
		expansions.push(...result.expansions);
	}
	return { config: current, expansions };
}
