/**
 * Effect foothold: deterministic seeded RNG for core / future kernel edges.
 * Gameplay does not yet consume RNG during play; this proves Effect + seed plumbing.
 */

import { Context, Effect, Layer } from "effect";

/** Mulberry32 — small, fast, deterministic PRNG from a 32-bit seed. */
export function mulberry32(seed: number): () => number {
	let t = seed >>> 0;
	return () => {
		t = (t + 0x6d2b79f5) >>> 0;
		let r = Math.imul(t ^ (t >>> 15), 1 | t);
		r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
		return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
	};
}

export class Rng extends Context.Tag("omnigame/Rng")<
	Rng,
	{
		readonly next: Effect.Effect<number>;
		readonly nextInt: (maxExclusive: number) => Effect.Effect<number>;
	}
>() {}

/** Layer providing Rng from `config.rng.seed`. */
export function RngLive(seed: number): Layer.Layer<Rng> {
	const nextFloat = mulberry32(seed);
	return Layer.succeed(Rng, {
		next: Effect.sync(() => nextFloat()),
		nextInt: (maxExclusive: number) =>
			Effect.sync(() => {
				if (maxExclusive <= 0) {
					throw new Error("nextInt requires maxExclusive > 0");
				}
				return Math.floor(nextFloat() * maxExclusive);
			})
	});
}

/** Run an Effect that needs Rng with a concrete seed. */
export function runWithSeed<A, E>(
	seed: number,
	program: Effect.Effect<A, E, Rng>
): A {
	return Effect.runSync(program.pipe(Effect.provide(RngLive(seed))));
}

/** Sync helper for tests: draw `count` floats from seed. */
export function seededSequence(seed: number, count: number): number[] {
	const next = mulberry32(seed);
	return Array.from({ length: count }, () => next());
}
