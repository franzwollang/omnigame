// Feature contracts for composition checks (lightweight runtime representation)

export type Capability =
	| "ResolvedCell"
	| "TargetLine"
	| "Adjacency"
	| "CellsWritable"
	| "EndCondition";

export type Slot =
	| { type: "PlacementPolicy"; value: "direct" | "gravity" | "move" }
	| {
			type: "EndCondition";
			value: "nInARow" | "destroyHidden" | "reachRow" | "areaControl" | "none";
	  }
	| { type: "Schedule"; value: "alternating" | "manualTick" };

export type PhaseHook =
	| "validateInput"
	| "applyPlacement"
	| "applyEffects"
	| "checkEnd"
	| "nextTurn";

export type FeatureContract = {
	id: string;
	requires: Capability[];
	provides: Capability[];
	slots: Slot[];
	hooks: PhaseHook[];
	// simple invariants/claims as strings for now (could be functions later)
	invariants?: string[];
};

export function checkContracts(contracts: FeatureContract[]): string[] {
	const errors: string[] = [];
	// Slot exclusivity
	const slotKey = (s: Slot) => `${s.type}:${(s as any).value}`;
	const byType: Record<string, Slot[]> = {};
	for (const c of contracts) {
		for (const s of c.slots) {
			const k = s.type;
			byType[k] ||= [];
			byType[k].push(s);
		}
	}
	for (const [t, slots] of Object.entries(byType)) {
		// for now, only one provider per slot type
		if (slots.length > 1) {
			errors.push(`Slot contention for ${t}`);
		}
	}

	// Capability satisfaction (shallow)
	const provided = new Set<Capability>();
	for (const c of contracts) c.provides.forEach((p) => provided.add(p));
	for (const c of contracts) {
		for (const r of c.requires) {
			if (!provided.has(r)) errors.push(`${c.id} requires ${r} not provided`);
		}
	}
	return errors;
}

// Built-in contracts
export const Contracts = {
	InputTargetCell: (): FeatureContract => ({
		id: "InputTargetCell",
		requires: [],
		provides: [],
		slots: [],
		hooks: ["validateInput"],
		invariants: []
	}),
	InputTargetColumn: (): FeatureContract => ({
		id: "InputTargetColumn",
		requires: [],
		provides: ["TargetLine"],
		slots: [],
		hooks: ["validateInput"],
		invariants: []
	}),
	InputMove: (): FeatureContract => ({
		id: "InputMove",
		requires: ["CellsWritable"],
		provides: ["ResolvedCell"],
		slots: [{ type: "PlacementPolicy", value: "move" }],
		hooks: ["validateInput", "applyPlacement"],
		invariants: ["movesOwnPieceToEmptyCell"]
	}),
	PlacementDirect: (): FeatureContract => ({
		id: "PlacementDirect",
		requires: ["CellsWritable"],
		provides: ["ResolvedCell"],
		slots: [{ type: "PlacementPolicy", value: "direct" }],
		hooks: ["applyPlacement"],
		invariants: ["writesExactlyOneCell"]
	}),
	PlacementGravity: (): FeatureContract => ({
		id: "PlacementGravity",
		requires: ["TargetLine", "CellsWritable"],
		provides: ["ResolvedCell"],
		slots: [{ type: "PlacementPolicy", value: "gravity" }],
		hooks: ["applyPlacement"],
		invariants: ["writesExactlyOneCell"]
	}),
	OverflowReject: (): FeatureContract => ({
		id: "OverflowReject",
		requires: [],
		provides: [],
		slots: [],
		hooks: ["applyEffects"],
		invariants: []
	}),
	OverflowPopOutBottom: (): FeatureContract => ({
		id: "OverflowPopOutBottom",
		requires: ["TargetLine"],
		provides: [],
		slots: [],
		hooks: ["applyEffects"],
		invariants: []
	}),
	OverflowPopOutTop: (): FeatureContract => ({
		id: "OverflowPopOutTop",
		requires: ["TargetLine"],
		provides: [],
		slots: [],
		hooks: ["applyEffects"],
		invariants: []
	}),
	/** Base board always present: cells can be written by placement features. */
	BoardWritable: (): FeatureContract => ({
		id: "BoardWritable",
		requires: [],
		provides: ["CellsWritable"],
		slots: [],
		hooks: ["validateInput"],
		invariants: []
	}),
	/** Gravity implies a vertical line axis (column drops / pop-out). */
	GravityAxis: (): FeatureContract => ({
		id: "GravityAxis",
		requires: [],
		provides: ["TargetLine"],
		slots: [],
		hooks: ["validateInput"],
		invariants: []
	}),
	Capture: (): FeatureContract => ({
		id: "Capture",
		requires: ["ResolvedCell", "Adjacency", "CellsWritable"],
		provides: [],
		slots: [],
		hooks: ["applyEffects"],
		invariants: ["flipsOnlyOpponent"]
	}),
	LibertyCapture: (): FeatureContract => ({
		id: "LibertyCapture",
		requires: ["ResolvedCell", "CellsWritable"],
		provides: [],
		slots: [],
		hooks: ["applyEffects"],
		invariants: ["removesZeroLibertyOpponentGroups", "noSuicide"]
	}),
	// Placeholder adapter: project gravity line selection to a resolved cell before capture
	GravityToCellAdapter: (): FeatureContract => ({
		id: "GravityToCellAdapter",
		requires: ["TargetLine"],
		provides: ["ResolvedCell"],
		slots: [],
		hooks: ["applyPlacement"],
		invariants: ["writesExactlyOneCell"]
	}),
	AdjacencyProvided: (): FeatureContract => ({
		id: "AdjacencyProvided",
		requires: [],
		provides: ["Adjacency"],
		slots: [],
		hooks: ["validateInput"],
		invariants: ["adjacencyHasDirection"]
	}),
	NInARow: (): FeatureContract => ({
		id: "NInARow",
		requires: ["Adjacency"],
		provides: [],
		slots: [{ type: "EndCondition", value: "nInARow" }],
		hooks: ["checkEnd"],
		invariants: []
	}),
	ObservationHitMiss: (): FeatureContract => ({
		id: "ObservationHitMiss",
		requires: [],
		provides: [],
		slots: [],
		hooks: ["validateInput"],
		invariants: ["hidesOpponentFleet"]
	}),
	ObservationFog: (): FeatureContract => ({
		id: "ObservationFog",
		requires: [],
		provides: [],
		slots: [],
		hooks: ["projectObservation"],
		invariants: ["hidesCellsOutsideRadius"]
	}),
	DestroyHidden: (): FeatureContract => ({
		id: "DestroyHidden",
		requires: ["CellsWritable"],
		provides: [],
		slots: [{ type: "EndCondition", value: "destroyHidden" }],
		hooks: ["checkEnd"],
		invariants: []
	}),
	ReachRow: (): FeatureContract => ({
		id: "ReachRow",
		requires: ["ResolvedCell"],
		provides: [],
		slots: [{ type: "EndCondition", value: "reachRow" }],
		hooks: ["checkEnd"],
		invariants: ["winsOnTargetRow"]
	}),
	AreaControl: (): FeatureContract => ({
		id: "AreaControl",
		requires: ["CellsWritable"],
		provides: [],
		slots: [{ type: "EndCondition", value: "areaControl" }],
		hooks: ["checkEnd"],
		invariants: ["twoPassesEndGame", "scoreStonesPlusTerritory"]
	}),
	OpenEnded: (): FeatureContract => ({
		id: "OpenEnded",
		requires: [],
		provides: [],
		slots: [{ type: "EndCondition", value: "none" }],
		hooks: [],
		invariants: ["noAutomaticTerminal"]
	}),
	SchedulerManualTick: (): FeatureContract => ({
		id: "SchedulerManualTick",
		requires: ["CellsWritable"],
		provides: [],
		slots: [{ type: "Schedule", value: "manualTick" }],
		hooks: ["applyEffects"],
		invariants: ["globalSynchronousUpdate"]
	}),
	TopologyHex: (): FeatureContract => ({
		id: "TopologyHex",
		requires: ["CellsWritable"],
		provides: [],
		slots: [],
		hooks: ["validateInput"],
		invariants: ["oddROffsetHex"]
	}),
	TopologyGraph: (): FeatureContract => ({
		id: "TopologyGraph",
		requires: ["CellsWritable"],
		provides: [],
		slots: [],
		hooks: ["validateInput"],
		invariants: ["explicitAdjacencyGraph"]
	})
};
