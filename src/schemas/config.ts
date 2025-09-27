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
		rng: z.object({ seed: z.number() }).strict()
	})
	.strict();

export type Config = z.infer<typeof zConfig>;
