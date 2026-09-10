import type { GameState } from "@/engine/types";
import { getCell } from "@/engine/types";
import type {
	GameKernel,
	KernelAction,
	PlayerId,
	Seed
} from "@/engine/kernel";
import { playerOf } from "@/engine/kernel";
import type { Agent } from "@/agents/types";

function centerBias(state: GameState, action: KernelAction): number {
	const cx = (state.grid.width - 1) / 2;
	const cy = (state.grid.height - 1) / 2;
	let row = cy;
	let col = cx;
	switch (action.type) {
		case "place":
		case "fire":
		case "reveal":
		case "flip":
		case "commitPlace":
			row = action.position.row;
			col = action.position.col;
			break;
		case "move":
		case "commitMove":
			row = action.to.row;
			col = action.to.col;
			break;
		case "activateColumn":
		case "popOutColumn":
			col = action.col;
			row = cy;
			break;
		case "activateRow":
		case "popOutRow":
			row = action.row;
			col = cx;
			break;
		default:
			return 0;
	}
	const dist = Math.abs(row - cy) + Math.abs(col - cx);
	return -dist;
}

function captureBias(state: GameState, action: KernelAction): number {
	if (
		action.type !== "place" &&
		action.type !== "move" &&
		action.type !== "commitPlace" &&
		action.type !== "commitMove"
	) {
		return 0;
	}
	// Prefer placing near opponent pieces (local flip / liberty pressure heuristic).
	const pos =
		action.type === "place" || action.type === "commitPlace"
			? action.position
			: action.to;
	let near = 0;
	for (const [dr, dc] of [
		[-1, 0],
		[1, 0],
		[0, -1],
		[0, 1],
		[-1, -1],
		[-1, 1],
		[1, -1],
		[1, 1]
	] as const) {
		const r = pos.row + dr;
		const c = pos.col + dc;
		if (r < 0 || c < 0 || r >= state.grid.height || c >= state.grid.width) {
			continue;
		}
		const cell = getCell(state.grid, { row: r, col: c });
		if (cell && cell !== state.currentPlayer && cell !== "hit" && cell !== "miss") {
			near += 1;
		}
	}
	return near;
}

/**
 * Greedy 1-ply: win now > block opponent win > capture proximity > center.
 * Uses `kernel.stepSync` only (no reducer bypass).
 */
export function createGreedyAgent(_seed: Seed = 0): Agent {
	return {
		kind: "greedy",
		reset(_s: Seed) {
			/* deterministic; seed unused */
		},
		act(kernel: GameKernel, state: GameState, player: PlayerId): KernelAction | null {
			const legal = kernel.legalActions(state, player);
			if (legal.length === 0) return null;

			const me = playerOf(player);
			const simultaneous =
				(kernel.config.turnSchedule ?? "alternating") === "simultaneous";

			// Immediate win (alternating only — single place is a no-op when joint)
			if (!simultaneous) {
				for (const action of legal) {
					const next = kernel.stepSync(state, action).nextState;
					if (next.status === "won" && next.winner === me) {
						return action;
					}
				}
			}

			// Block opponent: if we pass a turn somehow not available, simulate
			// opponent best immediate win after our move and avoid those when possible.
			const safe: KernelAction[] = [];
			for (const action of legal) {
				if (simultaneous) {
					safe.push(action);
					continue;
				}
				const after = kernel.stepSync(state, action).nextState;
				if (after.status !== "playing") {
					safe.push(action);
					continue;
				}
				const opp = kernel.currentPlayer(after);
				if (opp === "simultaneous") {
					safe.push(action);
					continue;
				}
				const oppLegal = kernel.legalActions(after, opp);
				const oppCanWin = oppLegal.some((oa) => {
					const terminal = kernel.stepSync(after, oa).nextState;
					return (
						terminal.status === "won" &&
						terminal.winner === playerOf(opp)
					);
				});
				if (!oppCanWin) safe.push(action);
			}

			const pool = safe.length > 0 ? safe : legal;
			let best = pool[0]!;
			let bestScore = Number.NEGATIVE_INFINITY;
			for (const action of pool) {
				const score =
					captureBias(state, action) * 10 + centerBias(state, action);
				if (score > bestScore) {
					bestScore = score;
					best = action;
				}
			}
			return best;
		}
	};
}
