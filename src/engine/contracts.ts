// Feature contracts for composition checks (lightweight runtime representation)

export type Capability =
	| "ResolvedCell"
	| "TargetLine"
	| "Adjacency"
	| "CellsWritable"
	| "EndCondition";

export type Slot =
	| { type: "PlacementPolicy"; value: "direct" | "gravity" }
	| { type: "EndCondition"; value: "nInARow" };

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
		requires: ["TargetLine"],
		provides: [],
		slots: [],
		hooks: ["validateInput"],
		invariants: []
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
	Capture: (): FeatureContract => ({
		id: "Capture",
		requires: ["ResolvedCell", "Adjacency", "CellsWritable"],
		provides: [],
		slots: [],
		hooks: ["applyEffects"],
		invariants: ["flipsOnlyOpponent"]
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
	})
};
