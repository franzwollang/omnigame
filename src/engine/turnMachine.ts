// Minimal TurnMachine scaffold (non-invasive). We'll integrate gradually.
export type TurnPhase =
	| "idle"
	| "awaitInput"
	| "placing"
	| "checking"
	| "ended";

export type TurnContext = {
	phase: TurnPhase;
};

export function createInitialTurnContext(): TurnContext {
	return { phase: "awaitInput" };
}

export function nextPhase(
	ctx: TurnContext,
	event: { type: string }
): TurnContext {
	switch (ctx.phase) {
		case "awaitInput":
			if (event.type === "place" || event.type === "activateColumn")
				return { phase: "placing" };
			return ctx;
		case "placing":
			return { phase: "checking" };
		case "checking":
			// placeholder; real logic will consider win/draw
			return { phase: "awaitInput" };
		default:
			return ctx;
	}
}
