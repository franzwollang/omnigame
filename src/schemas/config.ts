import { z } from "zod";

export const zConfig = z
	.object({
		metadata: z.object({ name: z.string(), version: z.number() }).strict(),
		grid: z
			.object({
				width: z.number().int().positive(),
				height: z.number().int().positive(),
				topology: z.literal("rectangle"),
				wrap: z.boolean()
			})
			.strict(),
		turn: z.object({ mode: z.enum(["turn", "realtime"]) }).strict(),
		rng: z.object({ seed: z.number() }).strict(),
		input: z
			.object({
				mode: z.enum(["cell", "column"]) // how user clicks map to actions
			})
			.strict()
			.default({ mode: "cell" as const }),
		placement: z
			.object({
				mode: z.enum(["direct", "gravity"]).default("direct"),
				gravity: z
					.object({
						enabled: z.boolean().default(false),
						direction: z.enum(["down", "up", "left", "right"]).default("down"),
						wrap: z.boolean().default(false)
					})
					.optional(),
				capture: z.object({ enabled: z.boolean().default(false) }).optional(),
				overflow: z
					.enum(["reject", "pop_out_bottom", "pop_out_top"])
					.default("reject")
			})
			.strict()
			.default({ mode: "direct" as const, overflow: "reject" as const }),
		win: z
			.object({
				length: z.number().int().min(3),
				adjacency: z
					.object({
						mode: z.enum(["linear", "composite"]),
						horizontal: z.boolean(),
						vertical: z.boolean(),
						backDiagonal: z.boolean(),
						forwardDiagonal: z.boolean()
					})
					.strict()
			})
			.strict(),
		tokens: z
			.array(
				z
					.object({
						id: z.string(),
						label: z.string().optional(),
						players: z.array(z.enum(["X", "O"])).min(1),
						asset: z
							.object({
								type: z.literal("image"),
								url: z.string().url().or(z.string().startsWith("/"))
							})
							.strict()
							.optional()
					})
					.strict()
			)
			.default([]),
		placements: z
			.array(
				z
					.object({
						row: z.number().int().nonnegative(),
						col: z.number().int().nonnegative(),
						tokenId: z.string()
					})
					.strict()
			)
			.default([]),
		initial: z
			.array(
				z
					.object({
						row: z.number().int().nonnegative(),
						col: z.number().int().nonnegative(),
						player: z.enum(["X", "O"])
					})
					.strict()
			)
			.default([])
	})
	.strict()
	.superRefine((cfg, ctx) => {
		// column input requires gravity placement
		if (cfg.input.mode === "column" && cfg.placement.mode !== "gravity") {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["input", "mode"],
				message: "input.mode = 'column' requires placement.mode = 'gravity'"
			});
		}
		// overflow only valid under gravity
		if (
			cfg.placement.mode !== "gravity" &&
			cfg.placement.overflow !== "reject"
		) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["placement", "overflow"],
				message: "overflow !== 'reject' requires placement.mode = 'gravity'"
			});
		}
		// adjacency must have at least one direction enabled
		if (
			!cfg.win.adjacency.horizontal &&
			!cfg.win.adjacency.vertical &&
			!cfg.win.adjacency.backDiagonal &&
			!cfg.win.adjacency.forwardDiagonal
		) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["win", "adjacency"],
				message: "At least one adjacency direction must be enabled"
			});
		}
		// win length must be <= max(width,height)
		const maxDim = Math.max(cfg.grid.width, cfg.grid.height);
		if (cfg.win.length < 2 || cfg.win.length > maxDim) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["win", "length"],
				message: `win.length must be between 2 and ${maxDim}`
			});
		}
		// initial seeds must be in bounds
		for (let i = 0; i < cfg.initial.length; i++) {
			const p = cfg.initial[i];
			if (
				p.row < 0 ||
				p.col < 0 ||
				p.row >= cfg.grid.height ||
				p.col >= cfg.grid.width
			) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["initial", i],
					message: "initial seed out of grid bounds"
				});
			}
		}

		// no duplicate seeds at same (row,col)
		const seen = new Set<string>();
		for (let i = 0; i < cfg.initial.length; i++) {
			const p = cfg.initial[i];
			const key = `${p.row},${p.col}`;
			if (seen.has(key)) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["initial", i],
					message: "duplicate initial seed position"
				});
			} else {
				seen.add(key);
			}
		}

		// token placements within bounds and refer to declared tokens
		const tokenIds = new Set(cfg.tokens.map((t) => t.id));
		for (let i = 0; i < cfg.placements.length; i++) {
			const p = cfg.placements[i];
			if (
				p.row < 0 ||
				p.col < 0 ||
				p.row >= cfg.grid.height ||
				p.col >= cfg.grid.width
			) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["placements", i],
					message: "token placement out of grid bounds"
				});
			}
			if (!tokenIds.has(p.tokenId)) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["placements", i, "tokenId"],
					message: "tokenId not declared in tokens"
				});
			}
		}
	});

export type Config = z.infer<typeof zConfig>;
