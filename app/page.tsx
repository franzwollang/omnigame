"use client";

import { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import GamePage from "./sandbox/page";
import { cn } from "@/lib/style";

export default function HomePage() {
	const overviewRef = useRef<HTMLElement | null>(null);
	const gameRef = useRef<HTMLElement | null>(null);

	const onClick = () => {
		gameRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
	};

	useEffect(() => {
		if (!overviewRef.current && !gameRef.current) return;
		let currentPath = window.location.pathname;
		const setPath = (path: string) => {
			if (currentPath === path) return;
			currentPath = path;
			window.history.replaceState(null, "", path);
		};

		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (!entry.isIntersecting) continue;
					if (entry.target === gameRef.current) {
						setPath("/sandbox");
					} else if (entry.target === overviewRef.current) {
						setPath("/");
					}
				}
			},
			{ threshold: 0.6 }
		);

		if (overviewRef.current) observer.observe(overviewRef.current);
		if (gameRef.current) observer.observe(gameRef.current);

		return () => observer.disconnect();
	}, []);

	return (
		<div className="h-screen snap-y snap-mandatory overflow-y-scroll scroll-smooth">
			<main
				ref={overviewRef}
				id="overview"
				className="snap-start relative flex h-screen w-full flex-col items-center justify-center bg-background px-6 py-24"
			>
				{/* Background subtle neutral glows */}
				<div
					aria-hidden
					className="pointer-events-none absolute inset-0 overflow-hidden"
				>
					<div className="absolute -top-40 left-1/2 h-[520px] w-[800px] -translate-x-1/2 rounded-full bg-gradient-to-b from-slate-400/10 via-slate-600/10 to-transparent blur-3xl" />
					<div className="absolute bottom-[-10%] left-1/2 h-56 w-[60%] -translate-x-1/2 rounded-full bg-gradient-to-t from-slate-700/10 to-transparent blur-2xl" />
					{/* Soft spotlight for focus */}
					<div className="absolute inset-0 flex items-center justify-center">
						<div className="h-72 w-[60%] rounded-full bg-gradient-to-b from-slate-100/10 to-transparent blur-2xl" />
					</div>
				</div>
				<div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-10 text-center">
					<div className="space-y-6">
						<h1 className="text-balance bg-gradient-to-b from-slate-200 to-slate-500 bg-clip-text text-6xl font-extrabold tracking-tight text-transparent sm:text-7xl">
							OmniGame
						</h1>
						{/* Underline divider for focal anchor */}
						<div className="mx-auto h-px w-32 bg-gradient-to-r from-transparent via-slate-400/50 to-transparent" />
						<h2 className="text-balance text-2xl font-medium text-muted-foreground sm:text-3xl">
							Compose every grid game from data & pure functions
						</h2>
						<p className="mx-auto max-w-2xl text-balance text-lg text-muted-foreground sm:text-xl">
							OmniGame turns game design into functional composition. Pick
							mechanics, tweak parameters, explore the configuration space, and
							watch Snake, Tic-Tac-Toe, Battleship (and everything between)
							emerge from data.
						</p>
					</div>

					<div className="grid w-full max-w-3xl grid-cols-1 gap-4 text-sm text-muted-foreground sm:grid-cols-2">
						<Card className="h-full border border-white/5 bg-background/60 backdrop-blur-sm supports-[backdrop-filter]:backdrop-blur-sm">
							<CardContent className="flex h-full flex-col gap-2 py-6">
								<p className="text-sm uppercase tracking-[0.2em] text-primary">
									Pure & deterministic
								</p>
								<p>
									Game logic is expressed as `State → Event → State` reducers
									with explicit randomness, making every run reproducible and
									debuggable.
								</p>
							</CardContent>
						</Card>
						<Card className="h-full border border-white/5 bg-background/60 backdrop-blur-sm supports-[backdrop-filter]:backdrop-blur-sm">
							<CardContent className="flex h-full flex-col gap-2 py-6">
								<p className="text-sm uppercase tracking-[0.2em] text-primary">
									Data-driven
								</p>
								<p>
									Mechanics are built from reusable operators. Changing a config
									control is enough to morph one game into another.
								</p>
							</CardContent>
						</Card>
					</div>

					<Button
						onClick={onClick}
						variant="outline"
						className="group relative border-border/60 bg-background/70 px-5 py-2 text-sm font-medium shadow-sm backdrop-blur-sm transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/50"
					>
						<span className="relative">Open the sandbox</span>
					</Button>
				</div>
			</main>
			<section
				ref={gameRef}
				id="game"
				aria-label="game-embed"
				className="snap-start h-screen"
			>
				<GamePage />
			</section>
		</div>
	);
}
