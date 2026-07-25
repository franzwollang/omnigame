"use client";

import { useEffect, useMemo, useState } from "react";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Config } from "@/schemas/config";
import {
	buildConfigSharePath,
	buildExploreSharePath,
	exploreLibrary,
	playableSamples,
	type ExploreSummary,
	type PlayabilityKind,
	type SampledConfig
} from "@/library";

interface LibraryExplorerModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onLoadConfig: (config: Config) => void;
	/** Optional initial explore seed (e.g. from URL). */
	initialSeed?: number;
	/** Optional initial sample count. */
	initialCount?: number;
}

const KIND_ORDER: PlayabilityKind[] = [
	"playable",
	"noise",
	"unplayable",
	"invalid"
];

const COHERENT_FRACTION = 0.35;

function kindBadgeVariant(
	kind: PlayabilityKind
): "default" | "secondary" | "outline" | "destructive" {
	switch (kind) {
		case "playable":
			return "default";
		case "noise":
			return "secondary";
		case "unplayable":
			return "outline";
		case "invalid":
			return "destructive";
	}
}

function sampleLabel(sample: SampledConfig): string {
	const name =
		sample.config?.metadata?.name ??
		(typeof (sample.raw as { metadata?: { name?: string } })?.metadata
			?.name === "string"
			? (sample.raw as { metadata: { name: string } }).metadata.name
			: `sample #${sample.index}`);
	return name;
}

function topologyHint(sample: SampledConfig): string | null {
	const topo = sample.config?.grid?.topology;
	return topo ?? null;
}

export function LibraryExplorerModal({
	open,
	onOpenChange,
	onLoadConfig,
	initialSeed,
	initialCount
}: LibraryExplorerModalProps) {
	const [seed, setSeed] = useState(initialSeed ?? 42);
	const [count, setCount] = useState(initialCount ?? 48);
	const [summary, setSummary] = useState<ExploreSummary | null>(null);
	const [filter, setFilter] = useState<PlayabilityKind | "all">("all");
	const [sortPlayableFirst, setSortPlayableFirst] = useState(true);
	const [copiedId, setCopiedId] = useState<string | null>(null);

	useEffect(() => {
		if (initialSeed != null) setSeed(initialSeed);
	}, [initialSeed]);

	useEffect(() => {
		if (initialCount != null) setCount(initialCount);
	}, [initialCount]);

	const runExplore = () => {
		const next = exploreLibrary({
			seed,
			count,
			coherentFraction: COHERENT_FRACTION,
			maxPlayoutSteps: 28
		});
		setSummary(next);
		setFilter("all");
		setCopiedId(null);
	};

	const visible = useMemo(() => {
		if (!summary) return [];
		let list =
			filter === "all"
				? [...summary.samples]
				: summary.samples.filter((s) => s.playability.kind === filter);
		if (sortPlayableFirst) {
			const rank = (k: PlayabilityKind) => KIND_ORDER.indexOf(k);
			list.sort((a, b) => {
				const kr = rank(a.playability.kind) - rank(b.playability.kind);
				if (kr !== 0) return kr;
				return (
					(b.playability.score ?? 0) - (a.playability.score ?? 0) ||
					a.index - b.index
				);
			});
		}
		return list;
	}, [summary, filter, sortPlayableFirst]);

	const playables = summary ? playableSamples(summary) : [];

	const copyShare = async (sample: SampledConfig, mode: "find" | "explore") => {
		if (!summary || !sample.config) return;
		const path =
			mode === "find"
				? buildConfigSharePath(sample.config)
				: buildExploreSharePath({
						seed: summary.seed,
						index: sample.index,
						count: summary.count,
						coherentFraction: COHERENT_FRACTION
					});
		const url =
			typeof window !== "undefined"
				? `${window.location.origin}${path}`
				: path;
		try {
			await navigator.clipboard.writeText(url);
			setCopiedId(`${sample.id}:${mode}`);
		} catch {
			setCopiedId(null);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="flex max-h-[90vh] w-full max-w-3xl flex-col gap-0 overflow-hidden p-0">
				<DialogHeader className="shrink-0 border-b px-5 py-4">
					<DialogTitle>Library explorer</DialogTitle>
					<p className="text-sm text-muted-foreground">
						Sample random configs (including graph boards), score playable
						finds, and share links back into the sandbox.
					</p>
				</DialogHeader>

				<div className="flex shrink-0 flex-wrap items-end gap-3 border-b px-5 py-3">
					<label className="flex flex-col gap-1 font-mono text-xs text-muted-foreground">
						Seed
						<input
							type="number"
							className="h-8 w-24 rounded border bg-background px-2 text-foreground"
							value={seed}
							onChange={(e) => setSeed(Number(e.target.value) || 0)}
						/>
					</label>
					<label className="flex flex-col gap-1 font-mono text-xs text-muted-foreground">
						Count
						<input
							type="number"
							min={1}
							max={200}
							className="h-8 w-20 rounded border bg-background px-2 text-foreground"
							value={count}
							onChange={(e) =>
								setCount(
									Math.min(200, Math.max(1, Number(e.target.value) || 1))
								)
							}
						/>
					</label>
					<Button size="sm" onClick={runExplore}>
						Sample
					</Button>
					<label className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
						<input
							type="checkbox"
							checked={sortPlayableFirst}
							onChange={(e) => setSortPlayableFirst(e.target.checked)}
						/>
						Rank by score
					</label>
					{summary && (
						<div className="flex flex-wrap gap-1.5 font-mono text-xs">
							{(
								[
									["playable", summary.playable],
									["noise", summary.noise],
									["unplayable", summary.unplayable],
									["invalid", summary.invalid]
								] as const
							).map(([kind, n]) => (
								<button
									key={kind}
									type="button"
									className="rounded"
									onClick={() =>
										setFilter((f) => (f === kind ? "all" : kind))
									}
								>
									<Badge
										variant={
											filter === kind || filter === "all"
												? kindBadgeVariant(kind)
												: "outline"
										}
									>
										{kind}: {n}
									</Badge>
								</button>
							))}
						</div>
					)}
				</div>

				<div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
					{!summary ? (
						<p className="text-sm text-muted-foreground">
							Click Sample to draw configs. Most will be invalid or noise;
							playable ones show a score and can be loaded or shared.
						</p>
					) : visible.length === 0 ? (
						<p className="text-sm text-muted-foreground">
							No samples in this filter.
						</p>
					) : (
						<ul className="space-y-2">
							{visible.map((sample) => {
								const kind = sample.playability.kind;
								const canLoad = kind === "playable" && sample.config;
								const topo = topologyHint(sample);
								const score = sample.playability.score;
								return (
									<li
										key={sample.id}
										className="flex items-start justify-between gap-3 rounded border px-3 py-2"
									>
										<div className="min-w-0 flex-1">
											<div className="flex flex-wrap items-center gap-2">
												<span className="truncate text-sm font-medium">
													{sampleLabel(sample)}
												</span>
												<Badge variant={kindBadgeVariant(kind)}>
													{kind}
												</Badge>
												{score != null && (
													<Badge variant="outline">score {score}</Badge>
												)}
												{topo && (
													<Badge variant="secondary">{topo}</Badge>
												)}
											</div>
											<p className="mt-0.5 font-mono text-xs text-muted-foreground line-clamp-2">
												{sample.playability.reasons[0] ?? "—"}
												{sample.playability.openingLegal != null
													? ` · open=${sample.playability.openingLegal}`
													: ""}
												{sample.playability.stepsTaken > 0
													? ` · steps=${sample.playability.stepsTaken}`
													: ""}
											</p>
										</div>
										{canLoad && (
											<div className="flex shrink-0 flex-col gap-1 sm:flex-row">
												<Button
													size="sm"
													variant="outline"
													onClick={() => {
														onLoadConfig(sample.config!);
														onOpenChange(false);
													}}
												>
													Load
												</Button>
												<Button
													size="sm"
													variant="ghost"
													onClick={() => copyShare(sample, "find")}
												>
													{copiedId === `${sample.id}:find`
														? "Copied"
														: "Share"}
												</Button>
											</div>
										)}
									</li>
								);
							})}
						</ul>
					)}
				</div>

				{summary && (
					<div className="shrink-0 border-t px-5 py-3">
						<p className="font-mono text-xs text-muted-foreground">
							{playables.length} playable / {summary.count} sampled
							{playables[0]?.playability.score != null
								? ` · top score ${playables[0].playability.score}`
								: ""}
							{filter !== "all" ? ` · filter=${filter}` : ""}
							{" · "}
							share uses ?find=… or ?librarySeed=&libraryIndex=
						</p>
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
