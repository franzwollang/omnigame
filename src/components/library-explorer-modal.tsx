"use client";

import { useMemo, useState } from "react";
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
}

const KIND_ORDER: PlayabilityKind[] = [
	"playable",
	"noise",
	"unplayable",
	"invalid"
];

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

export function LibraryExplorerModal({
	open,
	onOpenChange,
	onLoadConfig
}: LibraryExplorerModalProps) {
	const [seed, setSeed] = useState(42);
	const [count, setCount] = useState(24);
	const [summary, setSummary] = useState<ExploreSummary | null>(null);
	const [filter, setFilter] = useState<PlayabilityKind | "all">("all");

	const runExplore = () => {
		const next = exploreLibrary({
			seed,
			count,
			coherentFraction: 0.35,
			maxPlayoutSteps: 28
		});
		setSummary(next);
		setFilter("all");
	};

	const visible = useMemo(() => {
		if (!summary) return [];
		if (filter === "all") return summary.samples;
		return summary.samples.filter((s) => s.playability.kind === filter);
	}, [summary, filter]);

	const playables = summary ? playableSamples(summary) : [];

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="flex max-h-[85vh] w-full max-w-2xl flex-col gap-0 overflow-hidden p-0">
				<DialogHeader className="shrink-0 border-b px-5 py-4">
					<DialogTitle>Library explorer</DialogTitle>
					<p className="text-sm text-muted-foreground">
						Sample random configs and see how rare playable hybrids are
						(Library of Babel framing). Load a playable find into the sandbox.
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
							max={100}
							className="h-8 w-20 rounded border bg-background px-2 text-foreground"
							value={count}
							onChange={(e) =>
								setCount(Math.min(100, Math.max(1, Number(e.target.value) || 1)))
							}
						/>
					</label>
					<Button size="sm" onClick={runExplore}>
						Sample
					</Button>
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
							playable ones can be loaded into the composer.
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
												<Badge variant={kindBadgeVariant(kind)}>{kind}</Badge>
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
											<Button
												size="sm"
												variant="outline"
												className="shrink-0"
												onClick={() => {
													onLoadConfig(sample.config!);
													onOpenChange(false);
												}}
											>
												Load
											</Button>
										)}
									</li>
								);
							})}
						</ul>
					)}
				</div>

				{summary && playables.length > 0 && (
					<div className="shrink-0 border-t px-5 py-3">
						<p className="mb-2 font-mono text-xs text-muted-foreground">
							{playables.length} playable / {summary.count} sampled
							{filter !== "all" ? ` · filter=${filter}` : ""}
						</p>
						<div className="flex flex-wrap gap-1">
							{KIND_ORDER.map((k) => (
								<span key={k} className="sr-only">
									{k}
								</span>
							))}
						</div>
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
