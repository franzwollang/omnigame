import type { Config } from "@/schemas/config";
import { init } from "z3-solver";

export type Z3Result = { ok: true } | { ok: false; errors: string[] };

export async function solveZ3Config(cfg: Config): Promise<Z3Result> {
	const { Context } = await init();
	const Z3: any = new (Context as any)("cfg");

	// Enums as ints
	const placement = Z3.Int.const("placement"); // 0=direct,1=gravity
	const input = Z3.Int.const("input"); // 0=cell,1=column
	const overflow = Z3.Int.const("overflow"); // 0=reject,1=pop_bottom,2=pop_top

	const s = new Z3.Solver();

	// Domains
	s.add(placement.ge(Z3.Int.val(0)), placement.le(Z3.Int.val(1)));
	s.add(input.ge(Z3.Int.val(0)), input.le(Z3.Int.val(1)));
	s.add(overflow.ge(Z3.Int.val(0)), overflow.le(Z3.Int.val(2)));

	// Bind values from cfg
	s.add(placement.eq(Z3.Int.val(cfg.placement.mode === "direct" ? 0 : 1)));
	s.add(input.eq(Z3.Int.val(cfg.input.mode === "cell" ? 0 : 1)));
	s.add(
		overflow.eq(
			Z3.Int.val(
				cfg.placement.overflow === "reject"
					? 0
					: cfg.placement.overflow === "pop_out_bottom"
					? 1
					: 2
			)
		)
	);

	// Constraints (structural implications)
	// input.column -> placement.gravity
	s.add(Z3.Implies(input.eq(Z3.Int.val(1)), placement.eq(Z3.Int.val(1))));
	// overflow != reject -> placement.gravity
	s.add(Z3.Implies(overflow.neq(Z3.Int.val(0)), placement.eq(Z3.Int.val(1))));
	// capture+gravity allowed: capture runs after gravity resolves a cell
	// adjacency: at least one direction enabled (fast pre-check)
	const adjAny =
		cfg.win.adjacency.horizontal ||
		cfg.win.adjacency.vertical ||
		cfg.win.adjacency.backDiagonal ||
		cfg.win.adjacency.forwardDiagonal;
	if (!adjAny)
		return { ok: false, errors: ["Z3: no adjacency directions enabled"] };
	// win length bounds (fast pre-check)
	const maxDim = Math.max(cfg.grid.width, cfg.grid.height);
	if (cfg.win.length < 2 || cfg.win.length > maxDim)
		return { ok: false, errors: ["Z3: win length out of bounds"] };

	const res = await s.check();
	if (res !== "sat") {
		return { ok: false, errors: ["Z3: configuration constraints UNSAT"] };
	}
	return { ok: true };
}
