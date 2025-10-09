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
	.strict();

export type Config = z.infer<typeof zConfig>;
