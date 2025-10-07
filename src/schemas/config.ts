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
	})
	.strict();

export type Config = z.infer<typeof zConfig>;
