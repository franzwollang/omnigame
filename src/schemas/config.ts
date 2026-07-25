import { z } from "zod";

export const zConfig = z
	.object({
		metadata: z.object({ name: z.string(), version: z.number() }).strict(),
		grid: z
			.object({
				width: z.number().int().positive(),
				height: z.number().int().positive(),
				/**
				 * rectangle = classic grid; hex_offset = odd-r pointy-top hex;
				 * graph = explicit adjacency over embedded {row,col} nodes.
				 */
				topology: z
					.enum(["rectangle", "hex_offset", "graph"])
					.default("rectangle"),
				/** Toroidal adjacency for rectangle boards (hex/graph wrap deferred). */
				wrap: z.boolean().default(false),
				/** Playable nodes when topology = graph (inactive slots stay empty). */
				nodes: z
					.array(
						z
							.object({
								row: z.number().int().nonnegative(),
								col: z.number().int().nonnegative(),
								/** Optional canvas layout (y-down authoring space). */
								x: z.number().optional(),
								y: z.number().optional()
							})
							.strict()
					)
					.min(2)
					.optional(),
				/** Undirected edges as "row,col" endpoint pairs. */
				edges: z
					.array(
						z.tuple([
							z.string().regex(/^\d+,\d+$/),
							z.string().regex(/^\d+,\d+$/)
						])
					)
					.min(1)
					.optional()
			})
			.strict(),
		// realtime deferred; manual_tick unlocks discrete Life-style generations
		turn: z
			.object({
				mode: z.literal("turn"),
				/** alternating = classic turns; manual_tick = global scheduler step. */
				schedule: z
					.enum(["alternating", "manual_tick"])
					.default("alternating")
			})
			.strict()
			.default({ mode: "turn" as const, schedule: "alternating" as const }),
		/** Discrete world-step rules; required when turn.schedule = "manual_tick". */
		scheduler: z
			.object({
				rules: z.literal("life_b3s23"),
				neighborhood: z.literal("moore").default("moore")
			})
			.strict()
			.optional(),
		// seed consumed by Effect RNG helpers; engine stepping not yet seeded
		rng: z.object({ seed: z.number() }).strict(),
		input: z
			.object({
				// move = piece relocation; cell/column/row = placement
				mode: z.enum(["cell", "column", "row", "move"])
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
						// down|up ↔ column input; left|right ↔ row input
						direction: z
							.enum(["down", "up", "left", "right"])
							.default("down"),
						wrap: z.literal(false).default(false)
					})
					.optional(),
				capture: z
					.object({
						enabled: z.boolean().default(false),
						/** flip = Reversi sandwich; liberties = Go-lite group removal. */
						mode: z.enum(["flip", "liberties"]).default("flip")
					})
					.strict()
					.optional(),
				// pop_out_top / horizontal pop-out deferred
				overflow: z.enum(["reject", "pop_out_bottom"]).default("reject")
			})
			.strict()
			.default({ mode: "direct" as const, overflow: "reject" as const }),
		observation: z
			.object({
				mode: z.enum(["full", "hit_miss", "fog"]).default("full"),
				/** Vision radius when mode = fog (ignored otherwise). */
				radius: z.number().int().min(0).max(32).default(1),
				/** Rectangle distance metric for fog; hex uses cube, graph uses BFS. */
				metric: z.enum(["chebyshev", "manhattan"]).default("chebyshev")
			})
			.strict()
			.default({
				mode: "full" as const,
				radius: 1,
				metric: "chebyshev" as const
			}),
		/**
		 * Multi-ship placement phase for hit_miss games.
		 * Each player places contiguous orthogonal ships of these lengths onto
		 * the hidden layer before combat (fire) begins.
		 */
		fleet: z
			.object({
				ships: z.array(z.number().int().min(1).max(10)).min(1).max(8)
			})
			.strict()
			.optional(),
		objective: z
			.object({
				mode: z
					.enum([
						"n_in_a_row",
						"destroy_hidden",
						"reach_row",
						"area_control",
						"none"
					])
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
		// Required for n_in_a_row; unused for destroy_hidden / reach_row / area_control / none
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
		const fog = cfg.observation.mode === "fog";
		const destroyHidden = cfg.objective.mode === "destroy_hidden";
		const reachRow = cfg.objective.mode === "reach_row";
		const areaControl = cfg.objective.mode === "area_control";
		const moveInput = cfg.input.mode === "move";
		const manualTick = cfg.turn.schedule === "manual_tick";
		const hexBoard = cfg.grid.topology === "hex_offset";
		const graphBoard = cfg.grid.topology === "graph";
		// Toroidal wrap is rectangle-only for now (hex/graph wrap deferred)
		if (cfg.grid.wrap && cfg.grid.topology !== "rectangle") {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["grid", "wrap"],
				message: "grid.wrap is only supported for topology = 'rectangle'"
			});
		}
		const captureEnabled = Boolean(cfg.placement.capture?.enabled);
		const captureMode = cfg.placement.capture?.mode ?? "flip";
		const libertyCapture = captureEnabled && captureMode === "liberties";

		// Liberties / area_control (Go-lite) must be paired
		if (libertyCapture !== areaControl) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: libertyCapture
					? ["objective", "mode"]
					: ["placement", "capture", "mode"],
				message:
					"capture.mode 'liberties' and objective.mode 'area_control' must be used together"
			});
		}
		if (areaControl) {
			if (!captureEnabled) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["placement", "capture"],
					message: "area_control requires placement.capture.enabled"
				});
			}
			if (cfg.input.mode !== "cell") {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["input", "mode"],
					message: "area_control requires input.mode = 'cell'"
				});
			}
			if (gravityImplied) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["placement"],
					message: "area_control requires direct placement (no gravity)"
				});
			}
			if (hitMiss) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["observation", "mode"],
					message: "area_control is incompatible with hit_miss observation"
				});
			}
			if (manualTick) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["turn", "schedule"],
					message: "area_control is incompatible with manual_tick"
				});
			}
			if (moveInput) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["input", "mode"],
					message: "area_control is incompatible with move input"
				});
			}
		}

		// Hex foothold: direct cell placement + n-in-a-row only (no gravity/column/move/tick/capture)
		if (hexBoard) {
			if (cfg.objective.mode !== "n_in_a_row") {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["objective", "mode"],
					message: "hex_offset requires objective.mode = 'n_in_a_row'"
				});
			}
			if (cfg.input.mode !== "cell") {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["input", "mode"],
					message: "hex_offset requires input.mode = 'cell'"
				});
			}
			if (gravityImplied || captureEnabled) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["placement"],
					message:
						"hex_offset requires direct placement without capture/gravity"
				});
			}
			if (hitMiss) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["observation", "mode"],
					message: "hex_offset is incompatible with hit_miss observation"
				});
			}
			if (manualTick) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["turn", "schedule"],
					message: "hex_offset is incompatible with manual_tick"
				});
			}
			if (moveInput) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["input", "mode"],
					message: "hex_offset is incompatible with move input"
				});
			}
		}

		// Graph foothold: explicit adjacency; same restricted surface as hex
		if (graphBoard) {
			if (!cfg.grid.nodes || cfg.grid.nodes.length < 2) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["grid", "nodes"],
					message: "graph topology requires grid.nodes (≥ 2)"
				});
			}
			if (!cfg.grid.edges || cfg.grid.edges.length < 1) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["grid", "edges"],
					message: "graph topology requires grid.edges (≥ 1)"
				});
			}
			if (cfg.objective.mode !== "n_in_a_row") {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["objective", "mode"],
					message: "graph requires objective.mode = 'n_in_a_row'"
				});
			}
			if (cfg.input.mode !== "cell") {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["input", "mode"],
					message: "graph requires input.mode = 'cell'"
				});
			}
			if (gravityImplied || captureEnabled) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["placement"],
					message: "graph requires direct placement without capture/gravity"
				});
			}
			if (hitMiss) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["observation", "mode"],
					message: "graph is incompatible with hit_miss observation"
				});
			}
			if (manualTick) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["turn", "schedule"],
					message: "graph is incompatible with manual_tick"
				});
			}
			if (moveInput) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["input", "mode"],
					message: "graph is incompatible with move input"
				});
			}
			if (cfg.win && cfg.win.adjacency.mode !== "composite") {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["win", "adjacency", "mode"],
					message: "graph requires win.adjacency.mode = 'composite' (path win)"
				});
			}

			const nodeKeys = new Set<string>();
			if (cfg.grid.nodes) {
				for (let i = 0; i < cfg.grid.nodes.length; i++) {
					const n = cfg.grid.nodes[i];
					if (
						n.row < 0 ||
						n.col < 0 ||
						n.row >= cfg.grid.height ||
						n.col >= cfg.grid.width
					) {
						ctx.addIssue({
							code: z.ZodIssueCode.custom,
							path: ["grid", "nodes", i],
							message: "graph node out of grid bounds"
						});
					}
					const key = `${n.row},${n.col}`;
					if (nodeKeys.has(key)) {
						ctx.addIssue({
							code: z.ZodIssueCode.custom,
							path: ["grid", "nodes", i],
							message: "duplicate graph node position"
						});
					} else {
						nodeKeys.add(key);
					}
				}
			}
			if (cfg.grid.edges) {
				for (let i = 0; i < cfg.grid.edges.length; i++) {
					const [a, b] = cfg.grid.edges[i];
					if (a === b) {
						ctx.addIssue({
							code: z.ZodIssueCode.custom,
							path: ["grid", "edges", i],
							message: "graph edge cannot be a self-loop"
						});
					}
					if (!nodeKeys.has(a) || !nodeKeys.has(b)) {
						ctx.addIssue({
							code: z.ZodIssueCode.custom,
							path: ["grid", "edges", i],
							message: "graph edge endpoints must be declared nodes"
						});
					}
				}
			}
		} else if (cfg.grid.nodes || cfg.grid.edges) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["grid", "topology"],
				message: "grid.nodes / grid.edges require topology = 'graph'"
			});
		}

		// Manual tick / Life scheduler foothold
		if (manualTick) {
			if (!cfg.scheduler) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["scheduler"],
					message: "turn.schedule 'manual_tick' requires a scheduler block"
				});
			}
			if (cfg.objective.mode !== "none") {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["objective", "mode"],
					message: "manual_tick requires objective.mode = 'none'"
				});
			}
			if (cfg.input.mode !== "cell") {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["input", "mode"],
					message: "manual_tick requires input.mode = 'cell'"
				});
			}
			if (gravityImplied || captureEnabled) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["placement"],
					message:
						"manual_tick requires direct placement without capture/gravity"
				});
			}
			if (hitMiss) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["observation", "mode"],
					message: "manual_tick is incompatible with hit_miss observation"
				});
			}
			if (moveInput) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["input", "mode"],
					message: "manual_tick is incompatible with move input"
				});
			}
		} else if (cfg.scheduler) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["scheduler"],
				message: "scheduler requires turn.schedule = 'manual_tick'"
			});
		}

		// column / row input require gravity placement (mode or enabled sugar)
		if (cfg.input.mode === "column" && !gravityImplied) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["input", "mode"],
				message:
					"input.mode = 'column' requires placement.mode = 'gravity' (or gravity.enabled)"
			});
		}
		if (cfg.input.mode === "row" && !gravityImplied) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["input", "mode"],
				message:
					"input.mode = 'row' requires placement.mode = 'gravity' (or gravity.enabled)"
			});
		}

		// Axis pairing: column ↔ vertical (down|up); row ↔ horizontal (left|right)
		const gravityDir = cfg.placement.gravity?.direction ?? "down";
		const verticalDir = gravityDir === "down" || gravityDir === "up";
		const horizontalDir = gravityDir === "left" || gravityDir === "right";
		if (gravityImplied && cfg.input.mode === "column" && horizontalDir) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["placement", "gravity", "direction"],
				message:
					"gravity direction 'left'/'right' requires input.mode = 'row' (column is vertical)"
			});
		}
		if (gravityImplied && cfg.input.mode === "row" && verticalDir) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["placement", "gravity", "direction"],
				message:
					"gravity direction 'down'/'up' requires input.mode = 'column' (row is horizontal)"
			});
		}
		if (
			gravityImplied &&
			cfg.input.mode === "cell" &&
			(horizontalDir || verticalDir)
		) {
			// cell + gravity is allowed only for vertical historically? Prefer honesty:
			// gravity always needs a line axis (column or row).
			if (horizontalDir) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["input", "mode"],
					message:
						"horizontal gravity (left/right) requires input.mode = 'row'"
				});
			}
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
			if (gravityImplied || captureEnabled) {
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
		// pop_out_bottom is the exit-side symmetric to gravity down only
		if (
			cfg.placement.overflow === "pop_out_bottom" &&
			cfg.placement.gravity?.direction !== undefined &&
			cfg.placement.gravity.direction !== "down"
		) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["placement", "overflow"],
				message:
					"overflow 'pop_out_bottom' requires gravity direction 'down' (pop_out_top / horizontal pop-out deferred)"
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

		if (fog && destroyHidden) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["observation", "mode"],
				message:
					"observation.mode 'fog' is incompatible with objective.mode 'destroy_hidden'"
			});
		}

		if (fog && manualTick) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["observation", "mode"],
				message: "fog observation is incompatible with manual_tick"
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
			if (gravityImplied || captureEnabled) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["placement"],
					message:
						"hit_miss observation requires direct placement without capture/gravity"
				});
			}
			const owners = cfg.initial.filter((p) => p.visibility === "owner");
			const hasFleet = Boolean(cfg.fleet && cfg.fleet.ships.length > 0);
			if (!hasFleet && owners.length === 0) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["initial"],
					message:
						"hit_miss requires fleet.ships (placement phase) or at least one initial seed with visibility = 'owner'"
				});
			}
			if (hasFleet && owners.length > 0) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["fleet"],
					message:
						"fleet.ships (placement phase) cannot be combined with owner initial seeds — use one or the other"
				});
			}
			if (hasFleet) {
				const cellsNeeded = cfg.fleet!.ships.reduce((a, b) => a + b, 0);
				const capacity = cfg.grid.width * cfg.grid.height;
				if (cellsNeeded * 2 > capacity) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						path: ["fleet", "ships"],
						message: `fleet.ships need ${cellsNeeded} cells per player but board only has ${capacity}`
					});
				}
			}
		} else if (cfg.fleet) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["fleet"],
				message: "fleet is only valid with observation.mode = 'hit_miss'"
			});
		}

		if (cfg.objective.mode === "n_in_a_row") {
			if (!cfg.win) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["win"],
					message: "win is required when objective.mode = 'n_in_a_row'"
				});
			} else {
				// adjacency must have at least one direction enabled (lattice only)
				if (
					!graphBoard &&
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
				// win length must be <= max(width,height) — or node count on graphs
				const maxDim = graphBoard
					? (cfg.grid.nodes?.length ?? 0)
					: Math.max(cfg.grid.width, cfg.grid.height);
				if (maxDim > 0 && (cfg.win.length < 2 || cfg.win.length > maxDim)) {
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
			} else if (graphBoard && cfg.grid.nodes) {
				const onNode = cfg.grid.nodes.some(
					(n) => n.row === p.row && n.col === p.col
				);
				if (!onNode) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						path: ["initial", i],
						message: "initial seed must land on a graph node"
					});
				}
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
