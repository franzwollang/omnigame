import type { Config } from "@/schemas/config";
import { init } from "z3-solver";

export type Z3Result = { ok: true } | { ok: false; errors: string[] };

export async function solveZ3Config(cfg: Config): Promise<Z3Result> {
	const { Context } = await init();
	const Z3: any = new (Context as any)("cfg");

	// Enums as ints
	const placement = Z3.Int.const("placement"); // 0=direct,1=gravity
	const input = Z3.Int.const("input"); // 0=cell,1=column,2=row,3=move
	const overflow = Z3.Int.const("overflow"); // 0=reject,1=pop_bottom

	const s = new Z3.Solver();

	// Domains
	s.add(placement.ge(Z3.Int.val(0)), placement.le(Z3.Int.val(1)));
	s.add(input.ge(Z3.Int.val(0)), input.le(Z3.Int.val(3)));
	s.add(overflow.ge(Z3.Int.val(0)), overflow.le(Z3.Int.val(1)));

	// Bind values from cfg
	s.add(placement.eq(Z3.Int.val(cfg.placement.mode === "direct" ? 0 : 1)));
	const inputCode =
		cfg.input.mode === "cell"
			? 0
			: cfg.input.mode === "column"
				? 1
				: cfg.input.mode === "row"
					? 2
					: 3;
	s.add(input.eq(Z3.Int.val(inputCode)));
	s.add(
		overflow.eq(
			Z3.Int.val(cfg.placement.overflow === "reject" ? 0 : 1)
		)
	);

	// Constraints (structural implications)
	// input.column|row -> placement.gravity
	s.add(Z3.Implies(input.eq(Z3.Int.val(1)), placement.eq(Z3.Int.val(1))));
	s.add(Z3.Implies(input.eq(Z3.Int.val(2)), placement.eq(Z3.Int.val(1))));
	// overflow != reject -> placement.gravity
	s.add(Z3.Implies(overflow.neq(Z3.Int.val(0)), placement.eq(Z3.Int.val(1))));
	// capture+gravity allowed: capture runs after gravity resolves a cell
	// adjacency / win length only apply to n_in_a_row objectives
	if (cfg.objective.mode === "n_in_a_row") {
		if (!cfg.win) {
			return { ok: false, errors: ["Z3: win required for n_in_a_row"] };
		}
		const adjAny =
			cfg.win.adjacency.horizontal ||
			cfg.win.adjacency.vertical ||
			cfg.win.adjacency.backDiagonal ||
			cfg.win.adjacency.forwardDiagonal;
		if (!adjAny)
			return { ok: false, errors: ["Z3: no adjacency directions enabled"] };
		const maxDim = Math.max(cfg.grid.width, cfg.grid.height);
		if (cfg.win.length < 2 || cfg.win.length > maxDim)
			return { ok: false, errors: ["Z3: win length out of bounds"] };
	}

	const res = await s.check();
	if (res !== "sat") {
		return { ok: false, errors: ["Z3: configuration constraints UNSAT"] };
	}
	return { ok: true };
}
