/**
 * Normalize a validated Zod `Config` into kernel-ready `GameConfig`.
 * Owns Config→GameConfig so the sandbox is not the adapter owner.
 */
import type { Config } from "@/schemas/config";
import type { GameConfig } from "@/engine/reducer";
import type { KoRule } from "@/engine/liberties";
import { expandMacros, type MacroExpansion } from "@/compiler/macros";
import { buildGraphTopologyData } from "@/engine/topology";

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

function resolveKoRule(
	ko: boolean | "point" | "positional" | "situational" | undefined
): KoRule {
	if (ko === true || ko === "point") return "point";
	if (ko === "positional") return "positional";
	if (ko === "situational") return "situational";
	return "none";
}

/** Flatten a (possibly already expanded) Config into GameConfig. */
export function flattenToGameConfig(config: Config): GameConfig {
	const graph =
		config.grid.topology === "graph" && config.grid.nodes && config.grid.edges
			? buildGraphTopologyData(config.grid.nodes, config.grid.edges)
			: undefined;
	const koRule = resolveKoRule(config.placement.capture?.ko);
	return {
		gridWidth: config.grid.width,
		gridHeight: config.grid.height,
		topology: config.grid.topology,
		graph,
		gridWrap: config.grid.wrap === true,
		winLength: config.win?.length ?? 3,
		adjacency: config.win?.adjacency ?? DEFAULT_ADJACENCY,
		inputMode: config.input.mode,
		placementMode: config.placement.mode,
		gravityDirection: config.placement.gravity?.direction ?? "down",
		overflow: config.placement.overflow,
		captureEnabled: Boolean(config.placement.capture?.enabled),
		captureMode: config.placement.capture?.mode ?? "flip",
		koRule,
		koEnabled: koRule !== "none",
		observationMode: config.observation.mode,
		fogRadius: config.observation.radius,
		fogMetric: config.observation.metric,
		hazards: config.hazards
			? {
					count: config.hazards.count,
					firstRevealSafe: config.hazards.firstRevealSafe === true
				}
			: undefined,
		memory: config.memory
			? {
					pairCount: config.memory.pairCount,
					bonusTurnOnMatch: config.memory.bonusTurnOnMatch === true
				}
			: undefined,
		objectiveMode: config.objective.mode,
		turnSchedule: config.turn.schedule,
		actionsPerTurn: config.turn.actionsPerTurn ?? 1,
		delayTurns: config.placement.delayTurns ?? 0,
		commitReveal: config.turn.commitReveal === true,
		resolveOrder: config.turn.resolveOrder ?? "joint",
		turnPhases:
			config.turn.phases && config.turn.phases.length > 0
				? [...config.turn.phases]
				: undefined,
		scheduler: config.scheduler
			? {
					rules: config.scheduler.rules,
					neighborhood: config.scheduler.neighborhood
				}
			: undefined,
		movement: config.movement
			? {
					adjacency: config.movement.adjacency,
					range: config.movement.range,
					capture: config.movement.capture ?? "none",
					...(config.movement.mustCapture === true
						? { mustCapture: true }
						: {}),
					...(config.movement.graphReach
						? { graphReach: config.movement.graphReach }
						: {}),
					...(config.movement.promotion
						? {
								promotion: {
									targetRows: {
										X: config.movement.promotion.targetRows.X,
										O: config.movement.promotion.targetRows.O
									},
									...(config.movement.promotion.crownedAdjacency
										? {
												crownedAdjacency:
													config.movement.promotion.crownedAdjacency
											}
										: {})
								}
							}
						: {})
				}
			: undefined,
		targetRows: config.objective.targetRows,
		fleet: config.fleet
			? { ships: [...config.fleet.ships] }
			: undefined,
		seed: config.rng.seed,
		deduction: config.deduction
			? {
					roster: config.deduction.roster.map((c) => ({
						id: c.id,
						traits: { ...c.traits }
					})),
					traits: [...config.deduction.traits],
					wrongGuess: config.deduction.wrongGuess,
					autoEliminate: config.deduction.autoEliminate ?? true,
					queryShape: config.deduction.queryShape ?? "single",
					compoundArity: config.deduction.compoundArity ?? 2
				}
			: undefined,
		initial: config.initial
	};
}

const DEFAULT_GAME_CONFIG: GameConfig = {
	gridWidth: 3,
	gridHeight: 3,
	topology: "rectangle",
	gridWrap: false,
	winLength: 3,
	adjacency: DEFAULT_ADJACENCY,
	inputMode: "cell",
	placementMode: "direct",
	gravityDirection: "down",
	overflow: "reject",
	captureEnabled: false,
	captureMode: "flip",
	koRule: "none",
	koEnabled: false,
	observationMode: "full",
	fogRadius: 1,
	fogMetric: "chebyshev",
	objectiveMode: "n_in_a_row",
	turnSchedule: "alternating",
	actionsPerTurn: 1,
	delayTurns: 0,
	commitReveal: false,
	resolveOrder: "joint",
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
