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
				/**
				 * Toroidal adjacency for rectangle and hex_offset boards.
				 * Graph wrap is N/A — authors add cross-seam edges explicitly.
				 */
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
		// realtime deferred; manual_tick = Life generations; simultaneous = joint place/move
		turn: z
			.object({
				mode: z.literal("turn"),
				/**
				 * alternating = classic turns;
				 * manual_tick = global scheduler step;
				 * simultaneous = both players submit a place or move per round (joint resolve).
				 */
				schedule: z
					.enum(["alternating", "manual_tick", "simultaneous"])
					.default("alternating"),
				/**
				 * Actions before schedule handoff: under alternating, successful
				 * places before the opponent's turn; under simultaneous, places
				 * each seat submits per joint round (move rounds are always 1). Default 1.
				 */
				actionsPerTurn: z.number().int().min(1).max(8).optional(),
				/**
				 * Hidden simultaneous: each seat commits privately; joint resolve when both
				 * have committed. Requires schedule = simultaneous. Default false = open joint.
				 */
				commitReveal: z.boolean().optional(),
				/**
				 * Simultaneous conflict resolution. `joint` = both-or-neither (default);
				 * `x_first` / `o_first` = apply seats in order, earlier seat wins same-cell.
				 * Requires schedule = simultaneous when not joint.
				 */
				resolveOrder: z
					.enum(["joint", "x_first", "o_first"])
					.default("joint")
					.optional(),
				/**
				 * Ordered in-turn action types before handoff
				 * (place→move, place→fire, place→move→fire, or move→fire).
				 * Distinct from actionsPerTurn (N copies of one action type).
				 */
				phases: z
					.array(z.enum(["place", "move", "fire"]))
					.min(2)
					.max(3)
					.optional()
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
				// move = piece relocation; cell/column/row = placement; deduction = query/guess
				mode: z.enum(["cell", "column", "row", "move", "deduction"])
			})
			.strict()
			.default({ mode: "cell" as const }),
		/**
		 * Piece movement; required when input.mode = "move".
		 * orthogonal | diagonal | king on rectangle with sliding `range` 1..8
		 * (blocker-aware ray walk; range 1 = adjacent only).
		 * `capture: "replace"` — move onto enemy clears occupant then lands
		 * (rectangle + move input; path empty except destination).
		 * Simultaneous + replace: joint uses vacated-origin path checks with a
		 * hybrid restore when the destination is the opponent's origin (so
		 * replace is still required to land on a fleeing piece; slides may
		 * pass through a vacating blocker). Ordered uses sequential capture
		 * apply (priority can capture before prey flees). Works with sliding
		 * `range > 1` on rectangle. Ordered simultaneous + range > 1 uses
		 * sequential path revalidation. hex_offset / graph use topology
		 * neighbors (orthogonal, range 1 only).
		 */
		movement: z
			.object({
				adjacency: z
					.enum(["orthogonal", "diagonal", "king"])
					.default("orthogonal"),
				range: z.number().int().min(1).max(8).default(1),
				capture: z.enum(["none", "replace"]).default("none")
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
						mode: z.enum(["flip", "liberties"]).default("flip"),
						/**
						 * Ko / superko for liberties games:
						 * - false: off
						 * - true | "point": simple (point) ko — forbid immediate
						 *   recapture of a single stone just captured
						 * - "positional": positional superko — forbid any prior
						 *   public-board position (cells hash)
						 * - "situational": situational superko — forbid any prior
						 *   (board, side-to-move) pair
						 */
						ko: z
							.union([
								z.boolean(),
								z.enum(["point", "positional", "situational"])
							])
							.default(false)
					})
					.strict()
					.optional(),
				// pop_out_* paired with gravity direction (see refine below)
				overflow: z
					.enum([
						"reject",
						"pop_out_bottom",
						"pop_out_top",
						"pop_out_left",
						"pop_out_right"
					])
					.default("reject"),
				/**
				 * Delayed (queued) place: intent lands after this many intervening
				 * successful places (0 = immediate). Supports direct cell place or
				 * gravity column/row (landing settled at resolve time).
				 */
				delayTurns: z.number().int().min(0).max(8).optional()
			})
			.strict()
			.default({ mode: "direct" as const, overflow: "reject" as const }),
		observation: z
			.object({
				mode: z
					.enum(["full", "hit_miss", "fog", "deduction"])
					.default("full"),
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
		/**
		 * Deduction / Guess Who-lite: shared public roster + traits; each seat
		 * gets a secret character. Query yes/no traits; guess to win.
		 */
		deduction: z
			.object({
				roster: z
					.array(
						z
							.object({
								id: z.string().min(1),
								traits: z.record(z.string(), z.boolean())
							})
							.strict()
					)
					.min(2)
					.max(12),
				traits: z.array(z.string().min(1)).min(1).max(6),
				wrongGuess: z.enum(["lose", "end_turn"]).default("lose")
			})
			.strict()
			.optional(),
		objective: z
			.object({
				mode: z
					.enum([
						"n_in_a_row",
						"destroy_hidden",
						"connect_or_destroy",
						"reach_row",
						"area_control",
						"identify_secret",
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
		// Required for n_in_a_row / connect_or_destroy; unused for destroy_hidden / reach_row / area_control / identify_secret / none
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
		const deductionInput = cfg.input.mode === "deduction";
		const deductionObs = cfg.observation.mode === "deduction";
		const identifySecret = cfg.objective.mode === "identify_secret";
		const hasDeductionBlock = cfg.deduction !== undefined;
		const deductionActive =
			deductionInput || deductionObs || identifySecret || hasDeductionBlock;
		const destroyHidden = cfg.objective.mode === "destroy_hidden";
		const connectOrDestroy = cfg.objective.mode === "connect_or_destroy";
		const reachRow = cfg.objective.mode === "reach_row";
		const areaControl = cfg.objective.mode === "area_control";
		const moveInput = cfg.input.mode === "move";
		const manualTick = cfg.turn.schedule === "manual_tick";
		const simultaneous = cfg.turn.schedule === "simultaneous";
		const actionsPerTurn = cfg.turn.actionsPerTurn ?? 1;
		const multiStep = actionsPerTurn > 1;
		const delayTurns = cfg.placement.delayTurns ?? 0;
		const delayedPlace = delayTurns > 0;
		const inTurnPhases = (cfg.turn.phases?.length ?? 0) > 0;
		const hexBoard = cfg.grid.topology === "hex_offset";
		const graphBoard = cfg.grid.topology === "graph";
		const needsHitMiss = destroyHidden || connectOrDestroy;

		// Deduction / Guess Who-lite: input + observation + objective + block lockstep
		if (deductionActive) {
			if (!deductionInput) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["input", "mode"],
					message:
						"deduction requires input.mode = 'deduction' (lockstep with observation/objective/deduction block)"
				});
			}
			if (!deductionObs) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["observation", "mode"],
					message:
						"deduction requires observation.mode = 'deduction' (lockstep with input/objective/deduction block)"
				});
			}
			if (!identifySecret) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["objective", "mode"],
					message:
						"deduction requires objective.mode = 'identify_secret' (lockstep with input/observation/deduction block)"
				});
			}
			if (!hasDeductionBlock) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["deduction"],
					message: "deduction requires a deduction block (roster + traits)"
				});
			}
			if (cfg.win !== undefined) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["win"],
					message: "deduction / identify_secret does not use win"
				});
			}
			if (cfg.movement) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["movement"],
					message: "deduction is incompatible with movement"
				});
			}
			if (cfg.fleet) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["fleet"],
					message: "deduction is incompatible with fleet"
				});
			}
			if (hitMiss || fog) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["observation", "mode"],
					message:
						"deduction is incompatible with hit_miss / fog observation"
				});
			}
			if (simultaneous) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["turn", "schedule"],
					message: "deduction is incompatible with simultaneous"
				});
			}
			if (manualTick) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["turn", "schedule"],
					message: "deduction is incompatible with manual_tick"
				});
			}
			if (cfg.turn.commitReveal === true) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["turn", "commitReveal"],
					message: "deduction is incompatible with commitReveal"
				});
			}
			if (inTurnPhases) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["turn", "phases"],
					message: "deduction is incompatible with turn.phases"
				});
			}
			if (multiStep) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["turn", "actionsPerTurn"],
					message: "deduction requires actionsPerTurn = 1"
				});
			}
			if (delayedPlace) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["placement", "delayTurns"],
					message: "deduction is incompatible with delayTurns"
				});
			}
			if (gravityImplied || Boolean(cfg.placement.capture?.enabled)) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["placement"],
					message:
						"deduction is incompatible with gravity / placement.capture"
				});
			}
			if (hexBoard || graphBoard) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["grid", "topology"],
					message: "deduction requires topology = 'rectangle'"
				});
			}
			if (cfg.initial.length > 0) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["initial"],
					message: "deduction is incompatible with initial seeds"
				});
			}
			if (cfg.grid.wrap) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["grid", "wrap"],
					message: "deduction is incompatible with grid.wrap"
				});
			}
			if (cfg.deduction) {
				const traitKeys = cfg.deduction.traits;
				const traitSet = new Set(traitKeys);
				if (traitSet.size !== traitKeys.length) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						path: ["deduction", "traits"],
						message: "deduction.traits entries must be unique"
					});
				}
				const ids = new Set<string>();
				for (let i = 0; i < cfg.deduction.roster.length; i++) {
					const entry = cfg.deduction.roster[i]!;
					if (ids.has(entry.id)) {
						ctx.addIssue({
							code: z.ZodIssueCode.custom,
							path: ["deduction", "roster", i, "id"],
							message: "deduction.roster ids must be unique"
						});
					}
					ids.add(entry.id);
					const keys = Object.keys(entry.traits);
					const keySet = new Set(keys);
					if (
						keys.length !== traitKeys.length ||
						!traitKeys.every((t) => keySet.has(t))
					) {
						ctx.addIssue({
							code: z.ZodIssueCode.custom,
							path: ["deduction", "roster", i, "traits"],
							message:
								"every roster entry must have exactly the keys in deduction.traits"
						});
					}
				}
			}
		}
		// Toroidal wrap: rectangle + hex_offset; graph uses explicit edges instead
		if (
			cfg.grid.wrap &&
			cfg.grid.topology !== "rectangle" &&
			cfg.grid.topology !== "hex_offset"
		) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["grid", "wrap"],
				message:
					"grid.wrap is only supported for topology = 'rectangle' | 'hex_offset' (graph: add wrap edges explicitly)"
			});
		}
		const captureEnabled = Boolean(cfg.placement.capture?.enabled);
		const captureMode = cfg.placement.capture?.mode ?? "flip";
		const libertyCapture = captureEnabled && captureMode === "liberties";
		const koRaw = cfg.placement.capture?.ko;
		const koOn =
			koRaw === true ||
			koRaw === "point" ||
			koRaw === "positional" ||
			koRaw === "situational";

		if (koOn && !libertyCapture) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["placement", "capture", "ko"],
				message: "capture.ko requires capture.mode = 'liberties'"
			});
		}

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
			if (simultaneous) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["turn", "schedule"],
					message: "area_control is incompatible with simultaneous"
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

		// Hex foothold: cell + n-in-a-row, or move + reach_row (topology-aware movement).
		// No gravity/column/tick/capture on hex.
		if (hexBoard) {
			const hexMove = moveInput && reachRow;
			if (hexMove) {
				if (cfg.movement && cfg.movement.adjacency !== "orthogonal") {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						path: ["movement", "adjacency"],
						message:
							"hex_offset move requires movement.adjacency = 'orthogonal' (diagonal/king deferred)"
					});
				}
				if (cfg.movement && cfg.movement.range !== 1) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						path: ["movement", "range"],
						message:
							"hex_offset move requires movement.range = 1 (sliding deferred)"
					});
				}
			} else {
				if (cfg.objective.mode !== "n_in_a_row") {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						path: ["objective", "mode"],
						message:
							"hex_offset requires objective.mode = 'n_in_a_row' (or move + reach_row)"
					});
				}
				if (cfg.input.mode !== "cell") {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						path: ["input", "mode"],
						message:
							"hex_offset requires input.mode = 'cell' (or move + reach_row)"
					});
				}
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
		}

		// Graph foothold: explicit adjacency; cell + n-in-a-row, or move + reach_row.
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
			const graphMove = moveInput && reachRow;
			if (graphMove) {
				if (cfg.movement && cfg.movement.adjacency !== "orthogonal") {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						path: ["movement", "adjacency"],
						message:
							"graph move requires movement.adjacency = 'orthogonal' (uses explicit edges)"
					});
				}
				if (cfg.movement && cfg.movement.range !== 1) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						path: ["movement", "range"],
						message:
							"graph move requires movement.range = 1 (sliding deferred)"
					});
				}
			} else {
				if (cfg.objective.mode !== "n_in_a_row") {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						path: ["objective", "mode"],
						message:
							"graph requires objective.mode = 'n_in_a_row' (or move + reach_row)"
					});
				}
				if (cfg.input.mode !== "cell") {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						path: ["input", "mode"],
						message:
							"graph requires input.mode = 'cell' (or move + reach_row)"
					});
				}
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

		// Simultaneous joint place (cell + n-in-a-row) or joint move (move + reach_row)
		if (simultaneous) {
			const simMove = moveInput;
			const simPlace = cfg.input.mode === "cell";
			if (!simMove && !simPlace) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["input", "mode"],
					message:
						"simultaneous requires input.mode = 'cell' (joint place) or 'move' (joint move)"
				});
			}
			if (simPlace) {
				if (cfg.objective.mode !== "n_in_a_row") {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						path: ["objective", "mode"],
						message:
							"simultaneous place requires objective.mode = 'n_in_a_row'"
					});
				}
				if (gravityImplied || captureEnabled) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						path: ["placement"],
						message:
							"simultaneous requires direct placement without capture/gravity"
					});
				}
			}
			if (simMove) {
				// reach_row pairing enforced below with moveInput !== reachRow
				// Topology-aware movement: rectangle | hex_offset | graph
				if ((cfg.turn.actionsPerTurn ?? 1) > 1) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						path: ["turn", "actionsPerTurn"],
						message:
							"simultaneous move does not support actionsPerTurn > 1"
					});
				}
				if (cfg.turn.commitReveal === true) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						path: ["turn", "commitReveal"],
						message:
							"simultaneous move is incompatible with commitReveal (deferred)"
					});
				}
				// Joint simultaneous sliding: vacated-origin paths.
				// Ordered simultaneous sliding: sequential path revalidation.
				// Simultaneous replace (any range): joint = vacated-origin hybrid
				// (restore fleeing dest); ordered = sequential capture apply.
			}
			if (hitMiss) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["observation", "mode"],
					message: "simultaneous is incompatible with hit_miss observation"
				});
			}
			if (fog) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["observation", "mode"],
					message: "simultaneous is incompatible with fog observation"
				});
			}
			if (cfg.fleet) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["fleet"],
					message: "simultaneous is incompatible with fleet placement"
				});
			}
			if (delayedPlace) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["placement", "delayTurns"],
					message:
						"placement.delayTurns > 0 requires turn.schedule = 'alternating' (not simultaneous)"
				});
			}
			// Multi-action simultaneous place (actionsPerTurn > 1) is allowed on
			// rectangle | hex_offset | graph — same topologies as single-action
			// simultaneous place. Alternating multi-step uses the same topologies.
			// Simultaneous move is single-action on rectangle | hex_offset | graph.
		} else if (cfg.turn.commitReveal === true) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["turn", "commitReveal"],
				message:
					"turn.commitReveal requires turn.schedule = 'simultaneous'"
			});
		} else if (
			cfg.turn.resolveOrder !== undefined &&
			cfg.turn.resolveOrder !== "joint"
		) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["turn", "resolveOrder"],
				message:
					"turn.resolveOrder other than 'joint' requires turn.schedule = 'simultaneous'"
			});
		}

		// Multi-step / multi-action foothold (actionsPerTurn > 1)
		if (multiStep) {
			if (
				cfg.turn.schedule !== "alternating" &&
				cfg.turn.schedule !== "simultaneous"
			) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["turn", "schedule"],
					message:
						"actionsPerTurn > 1 requires turn.schedule = 'alternating' or 'simultaneous'"
				});
			}
			if (cfg.objective.mode !== "n_in_a_row") {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["objective", "mode"],
					message: "actionsPerTurn > 1 requires objective.mode = 'n_in_a_row'"
				});
			}
			if (cfg.input.mode !== "cell") {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["input", "mode"],
					message: "actionsPerTurn > 1 requires input.mode = 'cell'"
				});
			}
			if (gravityImplied || captureEnabled) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["placement"],
					message:
						"actionsPerTurn > 1 requires direct placement without capture/gravity"
				});
			}
			if (hitMiss) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["observation", "mode"],
					message: "actionsPerTurn > 1 is incompatible with hit_miss observation"
				});
			}
			if (fog) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["observation", "mode"],
					message: "actionsPerTurn > 1 is incompatible with fog observation"
				});
			}
			if (moveInput) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["input", "mode"],
					message: "actionsPerTurn > 1 is incompatible with move input"
				});
			}
			if (cfg.fleet) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["fleet"],
					message: "actionsPerTurn > 1 is incompatible with fleet placement"
				});
			}
			// Alternating multi-step and simultaneous multi-action both allow
			// rectangle | hex_offset | graph (same topologies as single-action
			// place / simultaneous). Other topology gates stay above.
			if (delayedPlace) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["placement", "delayTurns"],
					message:
						"actionsPerTurn > 1 is incompatible with placement.delayTurns > 0"
				});
			}
		}

		// Delayed (queued) place foothold (delayTurns > 0)
		if (delayedPlace) {
			if (cfg.turn.schedule !== "alternating") {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["turn", "schedule"],
					message:
						"placement.delayTurns > 0 requires turn.schedule = 'alternating'"
				});
			}
			if (cfg.objective.mode !== "n_in_a_row") {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["objective", "mode"],
					message:
						"placement.delayTurns > 0 requires objective.mode = 'n_in_a_row'"
				});
			}
			const gravityDelayed =
				gravityImplied &&
				(cfg.input.mode === "column" || cfg.input.mode === "row") &&
				!captureEnabled;
			const directDelayed =
				cfg.input.mode === "cell" && !gravityImplied && !captureEnabled;
			if (!gravityDelayed && !directDelayed) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["placement"],
					message:
						"placement.delayTurns > 0 requires direct cell place, or gravity with column/row input (no capture)"
				});
			}
			if (cfg.placement.overflow !== "reject") {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["placement", "overflow"],
					message:
						"placement.delayTurns > 0 is incompatible with pop-out overflow"
				});
			}
			if (hitMiss) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["observation", "mode"],
					message:
						"placement.delayTurns > 0 is incompatible with hit_miss observation"
				});
			}
			if (fog) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["observation", "mode"],
					message:
						"placement.delayTurns > 0 is incompatible with fog observation"
				});
			}
			if (moveInput) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["input", "mode"],
					message: "placement.delayTurns > 0 is incompatible with move input"
				});
			}
			if (cfg.fleet) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["fleet"],
					message: "placement.delayTurns > 0 is incompatible with fleet placement"
				});
			}
			if (hexBoard || graphBoard) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["grid", "topology"],
					message:
						"placement.delayTurns foothold requires topology = 'rectangle' (hex/graph deferred)"
				});
			}
		}

		// In-turn phase sequence (place→move / place→fire / place→move→fire / move→fire)
		if (inTurnPhases) {
			const phases = cfg.turn.phases!;
			const hasMove = phases.includes("move");
			const hasFire = phases.includes("fire");
			const isTriple =
				phases.length === 3 &&
				phases[0] === "place" &&
				phases[1] === "move" &&
				phases[2] === "fire";
			const isMoveFire =
				phases.length === 2 &&
				phases[0] === "move" &&
				phases[1] === "fire";
			if (cfg.turn.schedule !== "alternating") {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["turn", "schedule"],
					message:
						"turn.phases requires turn.schedule = 'alternating'"
				});
			}
			if (multiStep) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["turn", "actionsPerTurn"],
					message:
						"turn.phases is incompatible with actionsPerTurn > 1 (phases sequence action types; actionsPerTurn repeats one type)"
				});
			}
			if (delayedPlace) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["placement", "delayTurns"],
					message: "turn.phases is incompatible with placement.delayTurns > 0"
				});
			}
			if (simultaneous || cfg.turn.commitReveal === true) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["turn", "phases"],
					message:
						"turn.phases is incompatible with simultaneous / commitReveal"
				});
			}
			if (phases[0] !== "place" && !isMoveFire) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["turn", "phases"],
					message:
						"turn.phases must start with 'place', or be exactly ['move','fire']"
				});
			}
			if (!hasMove && !hasFire) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["turn", "phases"],
					message:
						"turn.phases must include 'move' or 'fire' (e.g. ['place','move'], ['place','fire'], ['place','move','fire'], or ['move','fire'])"
				});
			}
			if (hasMove && hasFire && !isTriple && !isMoveFire) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["turn", "phases"],
					message:
						"turn.phases with both move and fire must be ['place','move','fire'] or ['move','fire']"
				});
			}
			if (isTriple) {
				if (!connectOrDestroy) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						path: ["objective", "mode"],
						message:
							"turn.phases place→move→fire requires objective.mode = 'connect_or_destroy' (dual end: n-in-a-row or sink fleet)"
					});
				}
				if (!hitMiss) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						path: ["observation", "mode"],
						message:
							"turn.phases place→move→fire requires observation.mode = 'hit_miss'"
					});
				}
				if (!cfg.movement) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						path: ["movement"],
						message: "turn.phases place→move→fire requires a movement block"
					});
				}
				if (!cfg.win) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						path: ["win"],
						message:
							"turn.phases place→move→fire requires a win block (connect leg)"
					});
				}
			} else if (isMoveFire) {
				if (!hitMiss) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						path: ["observation", "mode"],
						message:
							"turn.phases move→fire requires observation.mode = 'hit_miss'"
					});
				}
				if (cfg.objective.mode !== "destroy_hidden") {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						path: ["objective", "mode"],
						message:
							"turn.phases move→fire requires objective.mode = 'destroy_hidden'"
					});
				}
				if (!cfg.movement) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						path: ["movement"],
						message: "turn.phases move→fire requires a movement block"
					});
				}
				const publicSeeds = (cfg.initial ?? []).filter(
					(p) => (p.visibility ?? "public") === "public"
				);
				if (publicSeeds.length === 0) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						path: ["initial"],
						message:
							"turn.phases move→fire requires public initial seeds (movable spotters); fleets stay owner-hidden"
					});
				}
			} else {
				if (hasMove && cfg.objective.mode !== "n_in_a_row") {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						path: ["objective", "mode"],
						message:
							"turn.phases with 'move' requires objective.mode = 'n_in_a_row'"
					});
				}
				if (hasFire && !hitMiss) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						path: ["observation", "mode"],
						message:
							"turn.phases with 'fire' requires observation.mode = 'hit_miss'"
					});
				}
				if (hasFire && cfg.objective.mode !== "destroy_hidden") {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						path: ["objective", "mode"],
						message:
							"turn.phases with 'fire' requires objective.mode = 'destroy_hidden'"
					});
				}
				if (hasMove && !cfg.movement) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						path: ["movement"],
						message: "turn.phases with 'move' requires a movement block"
					});
				}
				if (hasFire && cfg.movement) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						path: ["movement"],
						message: "turn.phases place→fire does not use a movement block"
					});
				}
				if (hasMove && hitMiss) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						path: ["observation", "mode"],
						message:
							"turn.phases place→move is incompatible with hit_miss observation"
					});
				}
			}
			if (cfg.input.mode !== "cell") {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["input", "mode"],
					message:
						"turn.phases requires input.mode = 'cell' (place/fire phases); move phase uses movement"
				});
			}
			if (gravityImplied || captureEnabled) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["placement"],
					message:
						"turn.phases requires direct placement without capture/gravity"
				});
			}
			if (fog) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["observation", "mode"],
					message: "turn.phases is incompatible with fog observation"
				});
			}
			if (cfg.fleet) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["fleet"],
					message:
						"turn.phases is incompatible with fleet placement (use seeded initial ships for place→fire / place→move→fire / move→fire)"
				});
			}
			if (hexBoard || graphBoard) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["grid", "topology"],
					message:
						"turn.phases foothold requires topology = 'rectangle' (hex/graph deferred)"
				});
			}
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

		// Capture-by-replacement: rectangle move foothold
		if (cfg.movement?.capture === "replace") {
			if (!moveInput) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["movement", "capture"],
					message:
						"movement.capture = 'replace' requires input.mode = 'move'"
				});
			}
			if (cfg.grid.topology !== "rectangle") {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["movement", "capture"],
					message:
						"movement.capture = 'replace' requires rectangle topology (hex/graph deferred)"
				});
			}
			if (captureEnabled) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["movement", "capture"],
					message:
						"movement.capture = 'replace' is incompatible with placement.capture"
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
		// pop_out_* ↔ matching gravity direction
		if (
			cfg.placement.overflow === "pop_out_bottom" &&
			cfg.placement.gravity?.direction !== undefined &&
			cfg.placement.gravity.direction !== "down"
		) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["placement", "overflow"],
				message:
					"overflow 'pop_out_bottom' requires gravity direction 'down'"
			});
		}
		if (
			cfg.placement.overflow === "pop_out_top" &&
			(cfg.placement.gravity?.direction ?? "down") !== "up"
		) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["placement", "overflow"],
				message:
					"overflow 'pop_out_top' requires gravity direction 'up'"
			});
		}
		if (
			cfg.placement.overflow === "pop_out_right" &&
			cfg.placement.gravity?.direction !== "right"
		) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["placement", "overflow"],
				message:
					"overflow 'pop_out_right' requires gravity direction 'right'"
			});
		}
		if (
			cfg.placement.overflow === "pop_out_left" &&
			cfg.placement.gravity?.direction !== "left"
		) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["placement", "overflow"],
				message:
					"overflow 'pop_out_left' requires gravity direction 'left'"
			});
		}

		// Deduction observation/objective must not force destroy_hidden pairing
		if (!deductionObs && !identifySecret && hitMiss !== needsHitMiss) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: hitMiss ? ["objective", "mode"] : ["observation", "mode"],
				message:
					"observation.mode 'hit_miss' must pair with objective.mode 'destroy_hidden' or 'connect_or_destroy'"
			});
		}

		if (connectOrDestroy && !inTurnPhases) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["turn", "phases"],
				message:
					"objective.mode 'connect_or_destroy' requires turn.phases ['place','move','fire']"
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

		if (
			cfg.objective.mode === "n_in_a_row" ||
			cfg.objective.mode === "connect_or_destroy"
		) {
			if (!cfg.win) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["win"],
					message:
						"win is required when objective.mode = 'n_in_a_row' or 'connect_or_destroy'"
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
