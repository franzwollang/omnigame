import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = {
	title: "What is OmniGame?",
	description:
		"A functional, data-driven game engine: rules as data, pure state transitions, and interactive composition."
};

export default function AboutPage() {
	const homeHref = "/" as Route;
	const sandboxHref = "/sandbox" as Route;
	return (
		<div className="relative min-h-screen bg-gradient-to-b from-[#020617] via-[#01030f] to-[#000208] text-foreground">
			{/* Background subtle neutral glows */}
			<div
				aria-hidden
				className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
			>
				<div className="absolute -top-44 left-1/2 h-[520px] w-[840px] -translate-x-1/2 rounded-full bg-gradient-to-b from-slate-400/5 via-slate-600/5 to-transparent blur-3xl" />
				<div className="absolute bottom-[-12%] left-1/2 h-64 w-[70%] -translate-x-1/2 rounded-full bg-gradient-to-t from-slate-700/5 to-transparent blur-2xl" />
			</div>

			<div className="relative z-10 mx-auto w-full max-w-5xl px-6 py-14 sm:py-20">
				<header className="flex items-center justify-between gap-4">
					<Link
						href={homeHref}
						className="text-sm text-muted-foreground hover:text-foreground"
					>
						← Home
					</Link>
					<div className="flex items-center gap-2">
						<Button asChild size="sm" variant="outline">
							<Link href={sandboxHref}>Open sandbox</Link>
						</Button>
					</div>
				</header>

				<div className="mt-10 space-y-6">
					<div className="space-y-3">
						<p className="text-xs uppercase tracking-[0.25em] text-primary">
							OmniGame
						</p>
						<h1 className="text-balance text-4xl font-extrabold tracking-tight sm:text-5xl">
							Functional programming and data-driven design you can see
						</h1>
						<p className="max-w-3xl text-balance text-lg leading-relaxed text-muted-foreground sm:text-xl">
							OmniGame is a visual sandbox for a simple idea from software
							engineering: many “different” systems are just compositions of a
							small set of primitives. Here, the domain is grid games—so the
							abstractions are concrete, interactive, and fun to explore.
						</p>
					</div>

					<p className="max-w-3xl leading-relaxed text-muted-foreground">
						Instead of hardcoding each game as bespoke logic, OmniGame treats a
						game as <span className="text-foreground">rules as data</span>. You
						describe topology, entities, operators, constraints, and objectives
						in a typed configuration. The engine interprets that description to
						validate it, generate legal actions, and run a deterministic
						simulation.
					</p>
					<p className="max-w-3xl leading-relaxed text-muted-foreground">
						This makes FP and data-driven design tangible: you can change a
						parameter and immediately see behavior change, because the runtime
						is built from composable, reusable functions rather than
						feature-specific branching.
					</p>
				</div>

				<section className="mt-10 grid gap-4 md:grid-cols-2">
					<Card className="border border-white/10 bg-slate-950/50 backdrop-blur-sm supports-[backdrop-filter]:backdrop-blur-sm">
						<CardContent className="space-y-3 py-6">
							<h2 className="text-lg font-semibold">FP, made explicit</h2>
							<p className="text-sm leading-relaxed text-muted-foreground">
								The engine is centered around pure state transitions:
								<span className="text-foreground">
									{" "}
									State → Action → State
								</span>
								. The “rules” aren’t hidden behind UI code or ad-hoc conditionals;
								they’re functions with stable interfaces that compose.
							</p>
							<ul className="space-y-2 text-sm leading-relaxed text-muted-foreground">
								<li>
									<span className="text-foreground">Determinism</span>: seeded RNG
									and replayable runs make behavior debuggable.
								</li>
								<li>
									<span className="text-foreground">Composition</span>: operators
									and constraints combine to form new games without new engine
									branches.
								</li>
								<li>
									<span className="text-foreground">Semantics</span>: “what happens”
									is described by data + pure interpreters, not implicit side
									effects.
								</li>
							</ul>
						</CardContent>
					</Card>

					<Card className="border border-white/10 bg-slate-950/50 backdrop-blur-sm supports-[backdrop-filter]:backdrop-blur-sm">
						<CardContent className="space-y-3 py-6">
							<h2 className="text-lg font-semibold">Data-driven design</h2>
							<p className="text-sm leading-relaxed text-muted-foreground">
								In OmniGame, “a game” is a configuration object: topology,
								entities/tokens, input mapping, placement policy, constraints,
								end conditions. The UI edits that data; the engine interprets it.
							</p>
							<p className="text-sm leading-relaxed text-muted-foreground">
								This separation is the transferable lesson: when you make your
								system’s rules explicit data, you unlock validation, tooling,
								introspection, and reuse—without coupling behavior to a pile of
								conditionals.
							</p>
						</CardContent>
					</Card>
				</section>

				<section className="mt-10 space-y-4">
					<h2 className="text-2xl font-semibold">
						How this helps you build better software
					</h2>
					<div className="grid gap-4 md:grid-cols-3">
						<Card className="border border-white/10 bg-slate-950/50 backdrop-blur-sm supports-[backdrop-filter]:backdrop-blur-sm">
							<CardContent className="space-y-2 py-6">
								<p className="text-sm uppercase tracking-[0.2em] text-primary">
									Factor systems into primitives
								</p>
								<p className="text-sm leading-relaxed text-muted-foreground">
									Look for the few operations your domain repeats (validate,
									transform, query, score). Give them crisp types and semantics.
									You’ll get reuse and clarity for free.
								</p>
							</CardContent>
						</Card>
						<Card className="border border-white/10 bg-slate-950/50 backdrop-blur-sm supports-[backdrop-filter]:backdrop-blur-sm">
							<CardContent className="space-y-2 py-6">
								<p className="text-sm uppercase tracking-[0.2em] text-primary">
									Make rules explicit (not implicit)
								</p>
								<p className="text-sm leading-relaxed text-muted-foreground">
									When behavior is “rules as data,” you can validate configs,
									explain decisions (“why was this illegal?”), generate UIs, and
									build debuggable tooling around the same core.
								</p>
							</CardContent>
						</Card>
						<Card className="border border-white/10 bg-slate-950/50 backdrop-blur-sm supports-[backdrop-filter]:backdrop-blur-sm">
							<CardContent className="space-y-2 py-6">
								<p className="text-sm uppercase tracking-[0.2em] text-primary">
									Push side effects to the edges
								</p>
								<p className="text-sm leading-relaxed text-muted-foreground">
									Keep the core a pure, deterministic “kernel” and attach adapters
									for UI, persistence, and networking. This improves testability,
									replay, and refactoring speed.
								</p>
							</CardContent>
						</Card>
					</div>

					<p className="max-w-3xl leading-relaxed text-muted-foreground">
						If you can learn to see games as compositions of primitives, you can
						learn to see software the same way. The practical skill is spotting
						repeated structure, naming it, typing it, and building the smallest
						set of composable operations that generates the rest.
					</p>

					<div className="pt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
						<Button asChild>
							<Link href={sandboxHref}>Try it in the sandbox</Link>
						</Button>
						<Button asChild variant="outline">
							<Link href={homeHref}>Back to the landing page</Link>
						</Button>
					</div>
				</section>

				<footer className="mt-14 border-t border-border/60 pt-6 text-sm text-muted-foreground">
					<p>
						Under the hood, OmniGame centers deterministic{" "}
						<code className="rounded bg-muted px-1 py-0.5 text-foreground">
							State → Action → State
						</code>{" "}
						reducers, explicit RNG, and composable rule interpreters.
					</p>
				</footer>
			</div>
		</div>
	);
}

