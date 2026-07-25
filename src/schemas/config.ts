import { z } from "zod";

export const zConfig = z
	.object({
		metadata: z.object({ name: z.string(), version: z.number() }).strict(),
		grid: z
			.object({
				width: z.number().int().positive(),
				height: z.number().int().positive(),
				topology: z.literal("rectangle"),
				// wrap deferred to M1+ GameKernel; only false is accepted today
				wrap: z.literal(false)
			})
			.strict(),
		// realtime deferred to M1+; only turn-based is supported
		turn: z.object({ mode: z.literal("turn") }).strict(),
		// seed consumed by Effect RNG helpers; engine stepping not yet seeded
		rng: z.object({ seed: z.number() }).strict(),
		input: z
			.object({
				// move = piece relocation (select from → to); cell/column = placement
				mode: z.enum(["cell", "column", "move"])
			})
			.strict()
			.default({ mode: "cell" as const }),
		/** Orthogonal step movement; required when input.mode = "move". */
		movement: z
			.object({
				adjacency: z.literal("orthogonal").default("orthogonal"),
				range: z.literal(1).default(1)
			})
			.strict()
			.optional(),
		placement: z
			.object({
				mode: z.enum(["direct", "gravity"]).default("direct"),
				gravity: z
					.object({
						enabled: z.boolean().default(false),
						// non-down directions deferred to M1+
						direction: z.literal("down").default("down"),
						wrap: z.literal(false).default(false)
					})
					.optional(),
				capture: z.object({ enabled: z.boolean().default(false) }).optional(),
				// pop_out_top deferred to M1+
				overflow: z.enum(["reject", "pop_out_bottom"]).default("reject")
			})
			.strict()
			.default({ mode: "direct" as const, overflow: "reject" as const }),
		observation: z
			.object({
				mode: z.enum(["full", "hit_miss"]).default("full")
			})
			.strict()
			.default({ mode: "full" as const }),
		objective: z
			.object({
				mode: z
					.enum(["n_in_a_row", "destroy_hidden", "reach_row"])
					.default("n_in_a_row"),
				/** Target home rows for reach_row (e.g. X→0, O→height-1). */
				targetRows: z
					.object({
						X: z.number().int().nonnegative(),
						O: z.number().int().nonnegative()
					})
					.strict()
					.optional()
			})
			.strict()
			.default({ mode: "n_in_a_row" as const }),
		// Required for n_in_a_row; unused for destroy_hidden / reach_row
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
			.strict()
			.optional(),
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
						player: z.enum(["X", "O"]),
						/** owner = hidden fleet cell (hit/miss); public = visible seed. */
						visibility: z.enum(["public", "owner"]).default("public")
					})
					.strict()
			)
			.default([])
	})
	.strict()
	.superRefine((cfg, ctx) => {
		const gravityImplied =
			cfg.placement.mode === "gravity" ||
			cfg.placement.gravity?.enabled === true;
		const hitMiss = cfg.observation.mode === "hit_miss";
		const destroyHidden = cfg.objective.mode === "destroy_hidden";
		const reachRow = cfg.objective.mode === "reach_row";
		const moveInput = cfg.input.mode === "move";

		// column input requires gravity placement (mode or enabled sugar)
		if (cfg.input.mode === "column" && !gravityImplied) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["input", "mode"],
				message:
					"input.mode = 'column' requires placement.mode = 'gravity' (or gravity.enabled)"
			});
		}

		// Move games: step pieces; pair with reach_row (Step Race foothold)
		if (moveInput !== reachRow) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: moveInput ? ["objective", "mode"] : ["input", "mode"],
				message:
					"input.mode 'move' and objective.mode 'reach_row' must be used together"
			});
		}
		if (moveInput) {
			if (!cfg.movement) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["movement"],
					message: "input.mode = 'move' requires a movement block"
				});
			}
			if (gravityImplied || cfg.placement.capture?.enabled) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["placement"],
					message:
						"move input requires direct placement without capture/gravity"
				});
			}
			if (hitMiss) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["observation", "mode"],
					message: "move input is incompatible with hit_miss observation"
				});
			}
			const publicSeeds = cfg.initial.filter(
				(p) => (p.visibility ?? "public") === "public"
			);
			const hasX = publicSeeds.some((p) => p.player === "X");
			const hasO = publicSeeds.some((p) => p.player === "O");
			if (!hasX || !hasO) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["initial"],
					message:
						"move / reach_row requires public initial seeds for both X and O"
				});
			}
		}
		if (reachRow) {
			const targets = cfg.objective.targetRows;
			if (!targets) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["objective", "targetRows"],
					message: "objective.mode 'reach_row' requires targetRows for X and O"
				});
			} else {
				for (const [player, row] of [
					["X", targets.X],
					["O", targets.O]
				] as const) {
					if (row < 0 || row >= cfg.grid.height) {
						ctx.addIssue({
							code: z.ZodIssueCode.custom,
							path: ["objective", "targetRows", player],
							message: `targetRows.${player} must be in [0, ${cfg.grid.height - 1}]`
						});
					}
				}
			}
		}
		// overflow only valid under gravity
		if (cfg.placement.overflow !== "reject" && !gravityImplied) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["placement", "overflow"],
				message:
					"overflow !== 'reject' requires placement.mode = 'gravity' (or gravity.enabled)"
			});
		}

		if (hitMiss !== destroyHidden) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: hitMiss ? ["objective", "mode"] : ["observation", "mode"],
				message:
					"observation.mode 'hit_miss' and objective.mode 'destroy_hidden' must be used together"
			});
		}

		if (hitMiss) {
			if (cfg.input.mode !== "cell") {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["input", "mode"],
					message: "hit_miss observation requires input.mode = 'cell'"
				});
			}
			if (gravityImplied || cfg.placement.capture?.enabled) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["placement"],
					message:
						"hit_miss observation requires direct placement without capture/gravity"
				});
			}
			const owners = cfg.initial.filter((p) => p.visibility === "owner");
			if (owners.length === 0) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["initial"],
					message:
						"hit_miss requires at least one initial seed with visibility = 'owner'"
				});
			}
		}

		if (cfg.objective.mode === "n_in_a_row") {
			if (!cfg.win) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["win"],
					message: "win is required when objective.mode = 'n_in_a_row'"
				});
			} else {
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
			}
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
/** Authoring/input shape (defaults applied on parse). */
export type ConfigInput = z.input<typeof zConfig>;
