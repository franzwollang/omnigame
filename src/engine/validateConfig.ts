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

	features.push(Contracts.BoardWritable());

	const needsAdjacency =
		cfg.objective.mode === "n_in_a_row" ||
		cfg.objective.mode === "connect_or_destroy" ||
		(Boolean(cfg.placement.capture?.enabled) &&
			(cfg.placement.capture?.mode ?? "flip") === "flip");
	if (needsAdjacency) features.push(Contracts.AdjacencyProvided());
	if (cfg.grid.topology === "hex_offset") {
		features.push(Contracts.TopologyHex());
	}
	if (cfg.grid.topology === "graph") {
		features.push(Contracts.TopologyGraph());
	}

	// Input mode
	if (cfg.input.mode === "cell") features.push(Contracts.InputTargetCell());
	if (cfg.input.mode === "column") features.push(Contracts.InputTargetColumn());
	if (cfg.input.mode === "row") features.push(Contracts.InputTargetRow());
	if (cfg.input.mode === "move") features.push(Contracts.InputMove());
	if (cfg.input.mode === "deduction") features.push(Contracts.InputDeduction());
	if (cfg.movement?.capture === "replace") {
		features.push(Contracts.MovementReplaceCapture());
	}
	if (cfg.movement?.capture === "jump") {
		features.push(Contracts.MovementJumpCapture());
	}

	// Placement policy (mode or gravity.enabled sugar — macros expand the latter)
	const gravityImplied =
		cfg.placement.mode === "gravity" ||
		cfg.placement.gravity?.enabled === true;

	if (cfg.input.mode !== "move" && cfg.input.mode !== "deduction") {
		if (cfg.placement.mode === "direct" && !gravityImplied) {
			features.push(Contracts.PlacementDirect());
		}
		if (gravityImplied) {
			features.push(Contracts.GravityAxis());
			features.push(Contracts.PlacementGravity());
		}

		// Overflow
		if (cfg.placement.overflow === "reject") {
			features.push(Contracts.OverflowReject());
		} else if (cfg.placement.overflow === "pop_out_bottom") {
			features.push(Contracts.OverflowPopOutBottom());
		} else if (cfg.placement.overflow === "pop_out_top") {
			features.push(Contracts.OverflowPopOutTop());
		} else if (cfg.placement.overflow === "pop_out_right") {
			features.push(Contracts.OverflowPopOutRight());
		} else if (cfg.placement.overflow === "pop_out_left") {
			features.push(Contracts.OverflowPopOutLeft());
		}
	}

	// Capture
	if (cfg.placement.capture?.enabled) {
		if ((cfg.placement.capture.mode ?? "flip") === "liberties") {
			features.push(Contracts.LibertyCapture());
		} else {
			features.push(Contracts.Capture());
		}
	}

	// Observation + objective
	if (cfg.observation.mode === "hit_miss") {
		features.push(Contracts.ObservationHitMiss());
		if (cfg.fleet && cfg.fleet.ships.length > 0) {
			features.push(Contracts.FleetPlacement());
		}
	}
	if (cfg.observation.mode === "fog") {
		features.push(Contracts.ObservationFog());
	}
	if (cfg.observation.mode === "deduction") {
		features.push(Contracts.ObservationDeduction());
	}
	if (cfg.observation.mode === "flood_reveal") {
		features.push(Contracts.ObservationFloodReveal());
		if (cfg.hazards) features.push(Contracts.HazardLayout());
	}
	if (cfg.objective.mode === "destroy_hidden") {
		features.push(Contracts.DestroyHidden());
	} else if (cfg.objective.mode === "connect_or_destroy") {
		features.push(Contracts.ConnectOrDestroy());
	} else if (cfg.objective.mode === "reach_row") {
		features.push(Contracts.ReachRow());
	} else if (cfg.objective.mode === "area_control") {
		features.push(Contracts.AreaControl());
	} else if (cfg.objective.mode === "identify_secret") {
		features.push(Contracts.IdentifySecret());
	} else if (cfg.objective.mode === "clear_hazards") {
		features.push(Contracts.ClearHazards());
	} else if (cfg.objective.mode === "none") {
		features.push(Contracts.OpenEnded());
	} else {
		features.push(Contracts.NInARow());
	}

	if (cfg.turn.schedule === "manual_tick") {
		features.push(Contracts.SchedulerManualTick());
	}
	if (cfg.turn.schedule === "simultaneous") {
		const resolveOrder = cfg.turn.resolveOrder ?? "joint";
		features.push(Contracts.ScheduleSimultaneous(resolveOrder));
		if (cfg.input.mode === "move") {
			features.push(Contracts.ScheduleSimultaneousMove());
		}
		if (cfg.input.mode === "deduction") {
			features.push(Contracts.ScheduleSimultaneousDeduction());
		}
		if (cfg.turn.commitReveal === true) {
			features.push(Contracts.ScheduleCommitReveal());
		}
		if (resolveOrder === "x_first" || resolveOrder === "o_first") {
			features.push(Contracts.ScheduleOrderedResolve());
		}
		if ((cfg.turn.actionsPerTurn ?? 1) > 1) {
			features.push(Contracts.ScheduleMultiActionSimultaneous());
		}
	} else if ((cfg.turn.actionsPerTurn ?? 1) > 1) {
		features.push(Contracts.ScheduleMultiStep());
	}
	if ((cfg.placement.delayTurns ?? 0) > 0) {
		features.push(Contracts.PlacementDelayed());
	}
	if ((cfg.turn.phases?.length ?? 0) > 0) {
		features.push(Contracts.ScheduleInTurnPhases());
	}

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
