/**
 * Effect foothold: seeded PRNG as a small pure Effect service boundary.
 * Game stepping does not yet thread this through the reducer (M1+ Kernel).
 */
import { Effect, Context, Layer, Ref } from "effect";

/** Mulberry32 — compact deterministic 32-bit PRNG. */
export function mulberry32(seed: number): () => number {
	let t = seed >>> 0;
	return () => {
		t += 0x6d2b79f5;
		let r = Math.imul(t ^ (t >>> 15), 1 | t);
		r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
		return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
	};
}

export class Rng extends Context.Tag("omnigame/Rng")<
	Rng,
	{ readonly next: Effect.Effect<number> }
>() {}

/** Live Layer from a numeric seed (matches `config.rng.seed`). */
export const RngLive = (seed: number): Layer.Layer<Rng> => {
	const nextFn = mulberry32(seed);
	return Layer.effect(
		Rng,
		Ref.make(0).pipe(
			Effect.map((lock) => ({
				next: Ref.update(lock, (n) => n + 1).pipe(Effect.map(() => nextFn()))
			}))
		)
	);
};

/** Draw `n` floats in [0, 1) from the seeded RNG. */
export const takeN = (n: number): Effect.Effect<ReadonlyArray<number>, never, Rng> =>
	Effect.flatMap(Rng, (rng) =>
		Effect.all(Array.from({ length: n }, () => rng.next))
	);

/** Run a seeded draw to a plain array (handy for tests / adapters). */
export function runSeeded(seed: number, n: number): ReadonlyArray<number> {
	return Effect.runSync(takeN(n).pipe(Effect.provide(RngLive(seed))));
}
