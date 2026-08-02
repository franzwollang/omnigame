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
			value:
				| "nInARow"
				| "destroyHidden"
				| "connectOrDestroy"
				| "reachRow"
				| "areaControl"
				| "identifySecret"
				| "none";
	  }
	| { type: "Schedule"; value: "alternating" | "manualTick" | "simultaneous" };

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
	InputTargetRow: (): FeatureContract => ({
		id: "InputTargetRow",
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
		invariants: ["movesOwnPieceToLegalDestination"]
	}),
	InputDeduction: (): FeatureContract => ({
		id: "InputDeduction",
		requires: [],
		provides: [],
		slots: [],
		hooks: ["validateInput"],
		invariants: ["queryOrGuessOperators"]
	}),
	MovementReplaceCapture: (): FeatureContract => ({
		id: "MovementReplaceCapture",
		requires: ["ResolvedCell", "CellsWritable"],
		provides: [],
		slots: [],
		hooks: ["applyEffects"],
		invariants: [
			"replaceClearsEnemyThenLands",
			"pathEmptyExceptDestination",
			"jointSimultaneousReplaceUsesRealBoardLegality",
			"orderedSimultaneousReplaceSequentialCaptureApply"
		]
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
	OverflowPopOutRight: (): FeatureContract => ({
		id: "OverflowPopOutRight",
		requires: ["TargetLine"],
		provides: [],
		slots: [],
		hooks: ["applyEffects"],
		invariants: []
	}),
	OverflowPopOutLeft: (): FeatureContract => ({
		id: "OverflowPopOutLeft",
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
	/** Gravity implies a line axis (column drops / row slides / pop-out). */
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
		invariants: [
			"removesZeroLibertyOpponentGroups",
			"noSuicide",
			"noImmediateKoRecapture"
		]
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
	FleetPlacement: (): FeatureContract => ({
		id: "FleetPlacement",
		requires: ["CellsWritable"],
		provides: [],
		slots: [],
		hooks: ["validateInput", "applyPlacement"],
		invariants: ["placesContiguousShipsThenCombat"]
	}),
	ObservationFog: (): FeatureContract => ({
		id: "ObservationFog",
		requires: [],
		provides: [],
		slots: [],
		hooks: [],
		invariants: ["hidesCellsOutsideRadius"]
	}),
	ObservationDeduction: (): FeatureContract => ({
		id: "ObservationDeduction",
		requires: [],
		provides: [],
		slots: [],
		hooks: [],
		invariants: ["hidesOpponentSecret"]
	}),
	DestroyHidden: (): FeatureContract => ({
		id: "DestroyHidden",
		requires: ["CellsWritable"],
		provides: [],
		slots: [{ type: "EndCondition", value: "destroyHidden" }],
		hooks: ["checkEnd"],
		invariants: []
	}),
	/**
	 * Dual end for place→move→fire: n-in-a-row after place/move, or sink
	 * opponent fleet after fire. Single EndCondition slot (not two providers).
	 */
	ConnectOrDestroy: (): FeatureContract => ({
		id: "ConnectOrDestroy",
		requires: ["Adjacency", "CellsWritable"],
		provides: [],
		slots: [{ type: "EndCondition", value: "connectOrDestroy" }],
		hooks: ["checkEnd"],
		invariants: ["phaseRoutesConnectOrDestroy"]
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
	IdentifySecret: (): FeatureContract => ({
		id: "IdentifySecret",
		requires: [],
		provides: [],
		slots: [{ type: "EndCondition", value: "identifySecret" }],
		hooks: ["checkEnd"],
		invariants: ["guessOpponentSecret"]
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
	ScheduleSimultaneous: (
		resolveOrder: "joint" | "x_first" | "o_first" = "joint"
	): FeatureContract => ({
		id: "ScheduleSimultaneous",
		// CellsWritable only — place/move supply ResolvedCell; deduction joint
		// query/guess does not place (same pattern as ScheduleInTurnPhases).
		requires: ["CellsWritable"],
		provides: [],
		slots: [{ type: "Schedule", value: "simultaneous" }],
		hooks: ["validateInput", "applyEffects"],
		invariants: [
			"jointActionPerRound",
			resolveOrder === "joint"
				? "sameCellConflictNeitherApplies"
				: "sameCellConflictFirstSeatWins"
		]
	}),
	/**
	 * Simultaneous deduction (input.mode = deduction under simultaneous).
	 * Joint query or joint guess per round; no board placement.
	 */
	ScheduleSimultaneousDeduction: (): FeatureContract => ({
		id: "ScheduleSimultaneousDeduction",
		requires: ["CellsWritable"],
		provides: [],
		slots: [],
		hooks: ["validateInput", "applyEffects"],
		invariants: [
			"jointQueryOrGuessPerRound",
			"independentSeatSecrets",
			"jointUctDeferred"
		]
	}),
	/**
	 * Simultaneous move (input.mode = move under simultaneous). Keeps Schedule =
	 * simultaneous; each seat submits one {from,to}; same-dest conflict rules
	 * mirror joint place.
	 */
	ScheduleSimultaneousMove: (): FeatureContract => ({
		id: "ScheduleSimultaneousMove",
		requires: ["CellsWritable", "ResolvedCell"],
		provides: [],
		slots: [],
		hooks: ["validateInput", "applyEffects"],
		invariants: [
			"jointMovePerRound",
			"sameDestinationConflictNeitherOrFirst",
			"jointSlidePathsOnVacatedOrigins",
			"jointReplaceCaptureRealBoardLegality"
		]
	}),
	/**
	 * Ordered simultaneous resolve (resolveOrder = x_first | o_first). Keeps
	 * Schedule = simultaneous; earlier seat wins same-cell conflicts.
	 * Sliding paths revalidated sequentially (first pre-round, second after).
	 * Replace captures apply sequentially (priority can capture before flee).
	 */
	ScheduleOrderedResolve: (): FeatureContract => ({
		id: "ScheduleOrderedResolve",
		requires: ["CellsWritable", "ResolvedCell"],
		provides: [],
		slots: [],
		hooks: ["applyEffects"],
		invariants: [
			"sequentialApplyWithinRound",
			"sameCellConflictFirstSeatWins",
			"orderedSlideSequentialPathRevalidation",
			"orderedReplaceSequentialCaptureApply"
		]
	}),
	/**
	 * Hidden simultaneous (commit-then-reveal). Keeps Schedule = simultaneous;
	 * adds private commit buffer before joint resolve.
	 */
	ScheduleCommitReveal: (): FeatureContract => ({
		id: "ScheduleCommitReveal",
		requires: ["CellsWritable", "ResolvedCell"],
		provides: [],
		slots: [],
		hooks: ["validateInput", "applyEffects"],
		invariants: [
			"commitBeforeJointResolve",
			"opponentCommitHiddenUntilReveal"
		]
	}),
	/**
	 * Multi-step alternating turns (actionsPerTurn > 1). Keeps Schedule free —
	 * schedule remains alternating; this owns the nextTurn budget invariant.
	 */
	ScheduleMultiStep: (): FeatureContract => ({
		id: "ScheduleMultiStep",
		requires: ["CellsWritable", "ResolvedCell"],
		provides: [],
		slots: [],
		hooks: ["nextTurn"],
		invariants: ["actionsPerTurnBudgetBeforeHandoff"]
	}),
	/**
	 * Multi-action simultaneous rounds (actionsPerTurn > 1 under simultaneous).
	 * Each seat submits N places; joint resolve applies indexed pairs.
	 */
	ScheduleMultiActionSimultaneous: (): FeatureContract => ({
		id: "ScheduleMultiActionSimultaneous",
		requires: ["CellsWritable", "ResolvedCell"],
		provides: [],
		slots: [],
		hooks: ["validateInput", "applyEffects"],
		invariants: ["actionsPerRoundBudgetBeforeJointResolve"]
	}),
	/**
	 * Delayed (queued) place: intent is recorded now; stone materializes after
	 * delayTurns intervening places. Direct cell intents reserve that cell;
	 * gravity column/row intents reserve a slot and settle at resolve time.
	 */
	PlacementDelayed: (): FeatureContract => ({
		id: "PlacementDelayed",
		requires: ["CellsWritable", "ResolvedCell"],
		provides: [],
		slots: [],
		hooks: ["applyPlacement", "applyEffects"],
		invariants: [
			"intentBeforeResolve",
			"pendingCellsReserved",
			"pendingGravitySettlesOnResolve"
		]
	}),
	/**
	 * Ordered in-turn phase sequence (place→move / place→fire /
	 * place→move→fire / move→fire, or deduction query→eliminate /
	 * query→guess / query→eliminate→guess before handoff). Distinct from
	 * ScheduleMultiStep (N copies of one action type). Board phases still
	 * pull ResolvedCell from PlacementDirect / InputMove; deduction phases
	 * only need the writable board scaffold.
	 */
	ScheduleInTurnPhases: (): FeatureContract => ({
		id: "ScheduleInTurnPhases",
		requires: ["CellsWritable"],
		provides: [],
		slots: [],
		hooks: ["validateInput", "nextTurn"],
		invariants: ["phaseIndexBeforeHandoff", "phaseRoutesActionType"]
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
