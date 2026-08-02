"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Prism from "prismjs";
import "prismjs/components/prism-json";
import { zConfig } from "@/schemas/config";
import type { Config } from "@/schemas/config";
import { useForm } from "react-hook-form";
import deepEqual from "fast-deep-equal";
import SandboxEditor from "./editor";
import SandboxForm from "./form";
import SandboxCanvas from "./canvas";
import dynamic from "next/dynamic";
import CenteredLoader from "@/components/loader";
import { useGameEngine } from "@/engine/useGameEngine";
import {
	formatKernelEvent,
	highlightCellsForActions,
	jointEliminateFromActions,
	jointGuessFromActions,
	jointMoveFromActions,
	jointPlaceFromActions,
	jointPlacesFromActions,
	jointQueryFromActions
} from "@/engine/kernel";
import type { KernelAction, PlayerId } from "@/engine/kernel";
import { compileToGameConfig } from "@/compiler";
import { validateConfig } from "@/engine/validateConfig";
import { createAgent, type AgentKind } from "@/agents";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle
} from "@/components/ui/dialog";
import { PresetsModal } from "@/components/presets-modal";
import { LibraryExplorerModal } from "@/components/library-explorer-modal";
import { examplePresets, type ExamplePreset } from "@/presets/registry";
import { parseSandboxShare } from "@/library";
import { Maximize2, Minimize2 } from "lucide-react";

const SandboxEditorLazy = dynamic(() => import("./editor"), {
	ssr: false,
	loading: () => (
		<div className="flex flex-col flex-1 min-h-0">
			<div className="flex-1 min-h-0 rounded-md border">
				<CenteredLoader className="h-full" iconClassName="h-32 w-32" />
			</div>
		</div>
	)
});

const SandboxCanvasLazy = dynamic(() => import("./canvas"), {
	ssr: false,
	loading: () => (
		<CenteredLoader
			className="flex relative flex-1 min-w-0 h-full min-h-0"
			iconClassName="h-32 w-32"
		/>
	)
});

export default function GamePage() {
	const scrollRootRef = useRef<HTMLDivElement | null>(null);
	const editorWrapperRef = useRef<HTMLDivElement | null>(null);
	const fromFormUpdateRef = useRef(false);
	const [jsonText, setJsonText] = useState("");
	const [jsonError, setJsonError] = useState<string | null>(null);
	const [schemaErrors, setSchemaErrors] = useState<string[]>([]);
	const [currentConfig, setCurrentConfig] = useState<Config | null>(null);
	const [presetsModalOpen, setPresetsModalOpen] = useState(false);
	const [libraryModalOpen, setLibraryModalOpen] = useState(false);
	const [libraryShareSeed, setLibraryShareSeed] = useState<number | undefined>();
	const [libraryShareCount, setLibraryShareCount] = useState<
		number | undefined
	>();
	const [shareNotice, setShareNotice] = useState<string | null>(null);
	const shareLoadedRef = useRef(false);
	const [fullscreenMode, setFullscreenMode] = useState<"form" | "json" | null>(
		null
	);
	const [activeTab, setActiveTab] = useState<"form" | "json">("json");
	const [showLegalOverlay, setShowLegalOverlay] = useState(true);
	const [agentKind, setAgentKind] = useState<AgentKind>("random");
	const agentRef = useRef(createAgent("random", 0));

	// Compiler owns Config→GameConfig (macros + flatten); sandbox does not.
	const engineConfig = useMemo(
		() => compileToGameConfig(currentConfig).gameConfig,
		[currentConfig]
	);
	const playSeed = currentConfig?.rng?.seed ?? 0;
	const {
		state: gameState,
		viewState,
		observation,
		eventLog,
		actionLog,
		selectedFrom,
		pendingPlacements,
		pendingMoves,
		simultaneousSeat,
		commitReveal,
		resolveOrder,
		actionsPerRound,
		lastIllegal,
		legalActionsList,
		kernel,
		dispatchAction,
		placeMove,
		activateColumn,
		activateRow,
		popOutColumn,
		popOutRow,
		tick,
		pass,
		reset,
		replayFromTranscript
	} = useGameEngine(engineConfig, playSeed);
	const overflow = currentConfig?.placement.overflow;
	const enablePopOut =
		overflow === "pop_out_bottom" ||
		overflow === "pop_out_top" ||
		overflow === "pop_out_left" ||
		overflow === "pop_out_right";
	const popOutSide: "top" | "bottom" | "left" | "right" =
		overflow === "pop_out_top"
			? "top"
			: overflow === "pop_out_left"
				? "left"
				: overflow === "pop_out_right"
					? "right"
					: "bottom";
	const enableTick = currentConfig?.turn.schedule === "manual_tick";
	const enableSimultaneous =
		currentConfig?.turn.schedule === "simultaneous";
	const enableSimultaneousMove =
		enableSimultaneous && currentConfig?.input.mode === "move";
	const enableSimultaneousDeduction =
		enableSimultaneous && currentConfig?.input.mode === "deduction";
	const enableJointAgentSearch = enableSimultaneous;
	const enableCommitRevealDeductionJoint =
		enableSimultaneousDeduction && commitReveal;
	const enablePass = currentConfig?.objective.mode === "area_control";
	const eventLines = useMemo(
		() => eventLog.map(formatKernelEvent),
		[eventLog]
	);
	const highlightCells = useMemo(
		() =>
			highlightCellsForActions(gameState, legalActionsList, {
				selectedFrom,
				gravityDirection: engineConfig.gravityDirection ?? "down"
			}),
		[gameState, legalActionsList, selectedFrom, engineConfig.gravityDirection]
	);

	useEffect(() => {
		agentRef.current = createAgent(agentKind, playSeed);
	}, [agentKind, playSeed]);

	const stepAgent = () => {
		if (gameState.status !== "playing") return;
		const side = kernel.currentPlayer(gameState);
		if (side === "simultaneous") {
			const budget = actionsPerRound;
			if (commitReveal) {
				if (enableSimultaneousDeduction) {
					const seat: PlayerId | null = !gameState.committedDeduction
						?.X
						? 0
						: !gameState.committedDeduction?.O
							? 1
							: null;
					if (seat === null) return;
					const action = agentRef.current.act(kernel, gameState, seat);
					if (action) dispatchAction(action);
					return;
				}
				if ((engineConfig.inputMode ?? "cell") === "move") {
					const xLen = gameState.committedMoves?.X?.length ?? 0;
					const oLen = gameState.committedMoves?.O?.length ?? 0;
					const seat: PlayerId | null =
						xLen < budget ? 0 : oLen < budget ? 1 : null;
					if (seat === null) return;
					const action = agentRef.current.act(kernel, gameState, seat);
					if (action) dispatchAction(action);
					return;
				}
				const xLen = gameState.committedPlacements?.X?.length ?? 0;
				const oLen = gameState.committedPlacements?.O?.length ?? 0;
				const seat: PlayerId | null =
					xLen < budget ? 0 : oLen < budget ? 1 : null;
				if (seat === null) return;
				const action = agentRef.current.act(kernel, gameState, seat);
				if (action) dispatchAction(action);
				return;
			}
			if (budget <= 1) {
				const a0 = agentRef.current.act(kernel, gameState, 0);
				const a1 = agentRef.current.act(kernel, gameState, 1);
				if (!a0 || !a1) return;
				const joint =
					jointPlaceFromActions(a0, a1) ??
					jointMoveFromActions(a0, a1) ??
					jointQueryFromActions(a0, a1) ??
					jointGuessFromActions(a0, a1) ??
					jointEliminateFromActions(a0, a1);
				if (joint) dispatchAction(joint);
				return;
			}
			const pickN = (pid: PlayerId): KernelAction[] | null => {
				const picked: KernelAction[] = [];
				const used = new Set<string>();
				for (let i = 0; i < budget; i++) {
					const legal = kernel.legalActions(gameState, pid).filter((a) => {
						if (a.type !== "place") return false;
						return !used.has(`${a.position.row},${a.position.col}`);
					});
					const wrapped = {
						...kernel,
						legalActions: (s: typeof gameState, p: PlayerId) =>
							p === pid ? legal : kernel.legalActions(s, p)
					};
					const action = agentRef.current.act(wrapped, gameState, pid);
					if (!action || action.type !== "place") return null;
					used.add(`${action.position.row},${action.position.col}`);
					picked.push(action);
				}
				return picked;
			};
			const xs = pickN(0);
			const os = pickN(1);
			if (!xs || !os) return;
			const joint = jointPlacesFromActions(xs, os);
			if (joint) dispatchAction(joint);
			return;
		}
		const action = agentRef.current.act(kernel, gameState, side);
		if (action) dispatchAction(action);
	};

	const initialJson = useMemo(() => {
		const preset = examplePresets["tic-tac-toe"];
		return JSON.stringify(preset.config, null, 2);
	}, []);

	useEffect(() => {
		setJsonText(initialJson);
	}, [initialJson]);

	const form = useForm<Config>({
		defaultValues: examplePresets["tic-tac-toe"].config
	});

	useEffect(() => {
		const subscription = form.watch((values) => {
			if (!values) return;
			try {
				const next = JSON.stringify(values as Config, null, 2);
				fromFormUpdateRef.current = true;
				setJsonText(next);
			} catch {}
		});
		return () => subscription.unsubscribe();
	}, [form]);

	useEffect(() => {
		try {
			const parsed = JSON.parse(jsonText) as unknown;
			setJsonError(null);
			// Zod shape + feature contracts (client). Z3 SMT stays optional/server-only.
			const structural = validateConfig(parsed);
			if (!structural.ok) {
				setSchemaErrors(structural.errors);
				setCurrentConfig(null);
				return;
			}
			const result = zConfig.safeParse(parsed);
			if (!result.success) {
				const msgs = result.error.issues.map(
					(i) => `${i.path.join(".") || "root"}: ${i.message}`
				);
				setSchemaErrors(msgs);
				setCurrentConfig(null);
			} else {
				setSchemaErrors([]);
				setCurrentConfig(result.data);
			}
		} catch (e: any) {
			setJsonError(e?.message ?? "Invalid JSON");
			setSchemaErrors([]);
			setCurrentConfig(null);
		}
	}, [jsonText]);

	useEffect(() => {
		if (fromFormUpdateRef.current) {
			fromFormUpdateRef.current = false;
			return;
		}
		try {
			const parsed = JSON.parse(jsonText);
			const result = zConfig.safeParse(parsed);
			if (!result.success) return;
			const next = result.data as Config;
			const current = form.getValues();
			if (!deepEqual(current, next)) {
				form.reset(next, {
					keepDefaultValues: true,
					keepDirty: false,
					keepTouched: true
				});
			}
		} catch {}
	}, [jsonText, form]);

	const formatJson = () => {
		const viewport = scrollRootRef.current?.querySelector(
			"[data-radix-scroll-area-viewport]"
		) as HTMLDivElement | null;
		const savedScrollTop = viewport ? viewport.scrollTop : 0;

		const textarea = editorWrapperRef.current?.querySelector(
			"textarea"
		) as HTMLTextAreaElement | null;
		const selStart = textarea?.selectionStart ?? null;

		try {
			const parsed = JSON.parse(jsonText);
			const pretty = JSON.stringify(parsed, null, 2);
			if (pretty !== jsonText) {
				setJsonText(pretty);
				requestAnimationFrame(() => {
					if (viewport) viewport.scrollTop = savedScrollTop;
					if (textarea && selStart !== null) {
						const newPos = Math.min(selStart, pretty.length);
						textarea.selectionStart = newPos;
						textarea.selectionEnd = newPos;
					}
				});
			}
		} catch {}
	};

	const handleKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
		const isMetaSave = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "f";
		const isMetaK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
		if (isMetaSave) {
			e.preventDefault();
			formatJson();
		} else if (isMetaK) {
			e.preventDefault();
			setPresetsModalOpen(true);
		}
	};

	const handleSelectPreset = (preset: ExamplePreset) => {
		const newJson = JSON.stringify(preset.config, null, 2);
		setJsonText(newJson);
		form.reset(preset.config);
		// reset engine state explicitly; config change will also reinit
		reset();
		setPresetsModalOpen(false);
	};

	const handleLoadLibraryConfig = (config: Config) => {
		const newJson = JSON.stringify(config, null, 2);
		setJsonText(newJson);
		form.reset(config);
		reset();
	};

	// Deep-link: /sandbox?find=… or ?librarySeed=&libraryIndex=
	useEffect(() => {
		if (shareLoadedRef.current) return;
		if (typeof window === "undefined") return;
		const params = new URLSearchParams(window.location.search);
		if (
			!params.has("find") &&
			!(params.has("librarySeed") && params.has("libraryIndex"))
		) {
			return;
		}
		shareLoadedRef.current = true;
		const decoded = parseSandboxShare(params);
		if (!decoded) {
			setShareNotice("Could not resolve shared library find from URL.");
			return;
		}
		handleLoadLibraryConfig(decoded.config);
		if (decoded.kind === "explore") {
			setLibraryShareSeed(decoded.params.seed);
			if (decoded.params.count != null) {
				setLibraryShareCount(decoded.params.count);
			}
			setLibraryModalOpen(true);
			setShareNotice(
				`Loaded explore find #${decoded.params.index} (seed ${decoded.params.seed}).`
			);
		} else {
			setShareNotice(
				`Loaded shared find “${decoded.config.metadata.name}”.`
			);
		}
	}, [form]);

	const highlight = (code: string) =>
		Prism.highlight(code, Prism.languages.json, "json");

	return (
		<div className="flex w-full h-full">
			{/* Side panel (md+) with description and editor/form toggle */}
			<aside className="relative hidden h-full w-[480px] shrink-0 border-r bg-background p-4 text-foreground md:flex md:flex-col">
				<span className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
					Sandbox
				</span>
				<h2 className="text-2xl font-semibold">
					Composable runtime playground
				</h2>
				<p className="text-sm text-muted-foreground">
					This WebGL canvas visualizes the current OmniGame
					configuration—entities, rules, and transitions—using a deterministic
					render loop built on Three.js.
				</p>
				{shareNotice && (
					<p className="mt-2 font-mono text-xs text-muted-foreground">
						{shareNotice}{" "}
						<button
							type="button"
							className="underline"
							onClick={() => setShareNotice(null)}
						>
							dismiss
						</button>
					</p>
				)}
				<div className="mt-4 flex gap-2">
					<Button
						variant="outline"
						className="flex-1"
						onClick={() => setPresetsModalOpen(true)}
					>
						Browse presets
					</Button>
					<Button
						variant="outline"
						className="flex-1"
						onClick={() => setLibraryModalOpen(true)}
						title="Sample random configs; load playable finds"
					>
						Library
					</Button>
				</div>

				<div className="mt-4 space-y-1">
					<div className="flex items-center justify-between gap-2">
						<p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
							Kernel events
							{gameState.status === "playing"
								? enableSimultaneous
									? ` · simultaneous${
											commitReveal ? " commit-reveal" : ""
										}${
											resolveOrder !== "joint"
												? ` · ${resolveOrder}`
												: ""
										}${
											actionsPerRound > 1
												? ` · ${actionsPerRound}/seat`
												: ""
										}${
											simultaneousSeat
												? ` · ${simultaneousSeat} choosing${
														actionsPerRound > 1
															? ` (${
																	commitReveal
																		? (gameState.committedPlacements?.[
																				simultaneousSeat
																			]?.length ?? 0)
																		: (pendingPlacements[simultaneousSeat]
																				?.length ?? 0)
																}/${actionsPerRound})`
															: ""
													}`
												: ""
										}`
									: ` · ${gameState.currentPlayer} to move${
											gameState.turnPhaseIndex != null &&
											(engineConfig.turnPhases?.length ?? 0) > 0
												? ` · ${engineConfig.turnPhases![gameState.turnPhaseIndex]}`
												: ""
										}${
											gameState.actionsRemaining != null
												? ` · ${gameState.actionsRemaining} left`
												: ""
										}${
											(gameState.pendingPlaces?.length ?? 0) > 0
												? ` · ${gameState.pendingPlaces!.length} pending`
												: ""
										}`
								: ""}
						</p>
						<div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
							<Button
								variant="outline"
								size="sm"
								className="h-7 px-2 text-xs"
								disabled={actionLog.length === 0}
								onClick={() => replayFromTranscript()}
								title="Re-run seed + action log through GameIR"
							>
								Replay ({actionLog.length})
							</Button>
							{enableTick && (
								<Button
									variant="outline"
									size="sm"
									className="h-7 px-2 text-xs"
									disabled={gameState.status !== "playing"}
									onClick={() => tick()}
									title="Advance one Life generation"
								>
									Tick
								</Button>
							)}
							{enablePass && (
								<Button
									variant="outline"
									size="sm"
									className="h-7 px-2 text-xs"
									disabled={gameState.status !== "playing"}
									onClick={() => pass()}
									title="Pass turn (two consecutive passes end Go Lite)"
								>
									Pass
								</Button>
							)}
						</div>
					</div>
					{eventLines.length === 0 ? (
						<p className="font-mono text-xs text-muted-foreground">
							No steps yet — play from the board.
						</p>
					) : (
						<ul className="max-h-40 space-y-0.5 overflow-y-auto font-mono text-xs text-muted-foreground">
							{eventLines.map((line, i) => (
								<li key={`${i}-${line}`}>{line}</li>
							))}
						</ul>
					)}
					{lastIllegal && (
						<p className="mt-1 font-mono text-xs text-amber-700 dark:text-amber-400">
							Why illegal: {lastIllegal.reason} — {lastIllegal.detail}
						</p>
					)}
					<div className="mt-2 flex flex-wrap items-center gap-2">
						<label className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
							<input
								type="checkbox"
								checked={showLegalOverlay}
								onChange={(e) => setShowLegalOverlay(e.target.checked)}
								className="rounded border-muted-foreground"
							/>
							Legal overlay ({highlightCells.length})
						</label>
						<select
							className="h-7 rounded border bg-background px-1 font-mono text-xs"
							value={agentKind}
							onChange={(e) =>
								setAgentKind(e.target.value as AgentKind)
							}
							aria-label="Agent kind"
						>
							<option value="random">random</option>
							<option value="greedy">greedy</option>
							<option value="hunt">hunt</option>
							<option value="mcts">
								mcts
								{enableJointAgentSearch ? " (joint search)" : ""}
							</option>
							<option value="uct">
								uct
								{enableJointAgentSearch ? " (joint search)" : ""}
							</option>
						</select>
						<Button
							variant="outline"
							size="sm"
							className="h-7 px-2 text-xs"
							disabled={
								gameState.status !== "playing" ||
								legalActionsList.length === 0
							}
							onClick={stepAgent}
							title={
								enableSimultaneous &&
								(agentKind === "mcts" || agentKind === "uct")
									? enableCommitRevealDeductionJoint
										? "Under commitReveal simultaneous deduction, MCTS/UCT search fresh-round joint query/guess/eliminate plans (sequential commitQuery/commitGuess/commitEliminate)"
										: "Under simultaneous, MCTS/UCT search joint place/move/query/guess/eliminate (open) or commitReveal fresh-round place/move/deduction plans"
									: "Play one kernel legal action from the selected agent"
							}
						>
							Agent step
						</Button>
					</div>
					{enableSimultaneous &&
						(agentKind === "mcts" ||
							agentKind === "uct" ||
							agentKind === "greedy") && (
							<p className="mt-1 font-mono text-xs text-muted-foreground">
								{agentKind === "greedy"
									? "Greedy skips lookahead under simultaneous (single place/move/query/guess is a no-op until joint)."
									: enableCommitRevealDeductionJoint
										? "MCTS/UCT: commitReveal deduction fresh-round joint query/guess/eliminate plan search (sequential commitQuery/commitGuess/commitEliminate)."
										: "MCTS/UCT: joint place/move/query/guess/eliminate search under open simultaneous (incl. multi-action place); commitReveal fresh-round joint place/move/deduction plan search (sequential commits)."}
							</p>
						)}
					{enableTick && (
						<p className="mt-1 font-mono text-xs text-muted-foreground">
							Life Lite: place cells, then Tick for B3/S23 step
						</p>
					)}
					{enableSimultaneous && (
						<p className="mt-1 font-mono text-xs text-muted-foreground">
							{enableSimultaneousMove ? (
								<>
									{commitReveal ? (
										<>
											Hidden simultaneous move
											{actionsPerRound > 1
												? ` (${actionsPerRound}/round)`
												: ""}
											: select {simultaneousSeat ?? "X"}
											&apos;s piece then destination (own commit
											destination
											{actionsPerRound > 1 ? "s" : ""} overlaid;
											opponent hidden); board reveals when both fill
											budget; same destination →{" "}
											{resolveOrder === "joint"
												? "neither moves"
												: `${resolveOrder === "x_first" ? "X" : "O"} wins cell`}
										</>
									) : (
										<>
											Simultaneous move
											{resolveOrder !== "joint"
												? ` (${resolveOrder})`
												: ""}
											: select {simultaneousSeat ?? "X"}&apos;s piece then
											destination
											{pendingMoves.X
												? ` (X ${pendingMoves.X.map((m) => `${m.from.row},${m.from.col}→${m.to.row},${m.to.col}`).join("+")})`
												: ""}
											{pendingMoves.O
												? ` (O ${pendingMoves.O.map((m) => `${m.from.row},${m.from.col}→${m.to.row},${m.to.col}`).join("+")})`
												: ""}
											; same destination →{" "}
											{resolveOrder === "joint"
												? "neither moves"
												: `${resolveOrder === "x_first" ? "X" : "O"} wins cell`}
										</>
									)}
								</>
							) : commitReveal ? (
								<>
									Hidden simultaneous
									{actionsPerRound > 1
										? ` (${actionsPerRound} commits/seat)`
										: ""}
									: commit for {simultaneousSeat ?? "X"} (own commits
									visible only to that seat); board reveals when both
									fill their budget; same cell →{" "}
									{resolveOrder === "joint"
										? "neither places"
										: `${resolveOrder === "x_first" ? "X" : "O"} wins cell`}
								</>
							) : (
								<>
									Simultaneous
									{resolveOrder !== "joint"
										? ` (${resolveOrder})`
										: ""}
									{actionsPerRound > 1
										? ` · ${actionsPerRound} places/seat`
										: ""}
									: click a cell for {simultaneousSeat ?? "X"}
									{pendingPlacements.X && pendingPlacements.X.length > 0
										? ` (X@${pendingPlacements.X.map((p) => `${p.row},${p.col}`).join("+")})`
										: ""}
									{pendingPlacements.O && pendingPlacements.O.length > 0
										? ` (O@${pendingPlacements.O.map((p) => `${p.row},${p.col}`).join("+")})`
										: ""}
									; same cell →{" "}
									{resolveOrder === "joint"
										? "neither places"
										: `${resolveOrder === "x_first" ? "X" : "O"} wins cell`}
								</>
							)}
						</p>
					)}
					{enablePass && (
						<p className="mt-1 font-mono text-xs text-muted-foreground">
							Go Lite: place stones (liberties +{" "}
							{currentConfig?.placement.capture?.ko === "situational"
								? "situational superko"
								: currentConfig?.placement.capture?.ko === "positional"
									? "positional superko"
									: "simple ko"}
							); Pass twice to score
						</p>
					)}
					{currentConfig?.observation.mode === "hit_miss" &&
						(gameState.phase ?? "combat") === "placement" && (
							<p className="mt-1 font-mono text-xs text-muted-foreground">
								Placement: lay ships{" "}
								{currentConfig.fleet?.ships?.join("+") ?? "?"} as contiguous
								lines ({gameState.currentPlayer}&apos;s turn)
							</p>
						)}
					{currentConfig?.observation.mode === "hit_miss" &&
						(gameState.phase ?? "combat") === "combat" && (
							<p className="mt-1 font-mono text-xs text-muted-foreground">
								Combat: click a cell to fire (hit/miss)
							</p>
						)}
					{currentConfig?.observation.mode === "flood_reveal" && (
						<p className="mt-1 font-mono text-xs text-muted-foreground">
							Flood reveal: click a cell to open a region (mine loses; clear
							board = draw)
						</p>
					)}
					{currentConfig?.input.mode === "move" && (
						<p className="mt-1 font-mono text-xs text-muted-foreground">
							{selectedFrom
								? `Selected (${selectedFrom.row},${selectedFrom.col}) — click destination`
								: "Move: click your piece, then an adjacent empty cell"}
						</p>
					)}
				</div>

				<Tabs
					value={activeTab}
					onValueChange={(v) => setActiveTab(v as "form" | "json")}
					className="flex overflow-hidden flex-col mt-2 h-full"
				>
					<div className="flex justify-between items-center mb-2">
						<TabsList className="justify-start">
							<TabsTrigger value="form">Form</TabsTrigger>
							<TabsTrigger value="json">JSON</TabsTrigger>
						</TabsList>
						<Button
							variant="outline"
							size="sm"
							onClick={() => {
								if (fullscreenMode) {
									setFullscreenMode(null);
								} else {
									setFullscreenMode(activeTab);
								}
							}}
							className="ml-2"
						>
							{fullscreenMode ? (
								<>
									<Minimize2 className="mr-2 w-4 h-4" />
									Exit Fullscreen
								</>
							) : (
								<>
									<Maximize2 className="mr-2 w-4 h-4" />
									Fullscreen
								</>
							)}
						</Button>
					</div>
					<TabsContent
						value="form"
						className={`data-[state=active]:flex data-[state=active]:flex-1 data-[state=active]:min-h-0 data-[state=inactive]:hidden flex-col ${
							fullscreenMode === "form" ? "hidden" : ""
						}`}
					>
						<SandboxForm form={form} />
					</TabsContent>
					<TabsContent
						value="json"
						className={`data-[state=active]:flex data-[state=active]:flex-1 data-[state=active]:min-h-0 data-[state=inactive]:hidden flex-col ${
							fullscreenMode === "json" ? "hidden" : ""
						}`}
					>
						<SandboxEditorLazy
							jsonText={jsonText}
							jsonError={jsonError}
							schemaErrors={schemaErrors}
							onChange={(code) => setJsonText(code)}
							onFormat={formatJson}
							scrollRootRef={scrollRootRef}
							editorWrapperRef={editorWrapperRef}
							onKeyDown={handleKeyDown}
						/>
					</TabsContent>
				</Tabs>
			</aside>

			{/* Canvas area with results overlay */}
			<div className="relative flex-1 min-w-0">
				<SandboxCanvasLazy
					gameState={viewState}
					onCellClick={placeMove}
					onActivateColumn={activateColumn}
					onActivateRow={activateRow}
					enablePopOutButtons={enablePopOut}
					popOutSide={popOutSide}
					onPopOutColumn={
						enablePopOut &&
						(popOutSide === "top" || popOutSide === "bottom")
							? popOutColumn
							: undefined
					}
					onPopOutRow={
						enablePopOut &&
						(popOutSide === "left" || popOutSide === "right")
							? popOutRow
							: undefined
					}
					inputMode={
						currentConfig?.input.mode === "deduction"
							? "cell"
							: (currentConfig?.input.mode ?? "cell")
					}
					topology={currentConfig?.grid.topology ?? "rectangle"}
					graph={engineConfig.graph}
					highlightCells={highlightCells}
					selectedCell={selectedFrom}
					showLegalOverlay={showLegalOverlay}
					fogVisible={observation.visible}
					gravityDirection={
						currentConfig?.placement.gravity?.direction ?? "down"
					}
					tokens={currentConfig?.tokens ?? []}
					placements={currentConfig?.placements ?? []}
				/>
				{gameState.status !== "playing" && (
					<div className="flex absolute inset-0 z-10 justify-center items-center p-6 pointer-events-none">
						<div className="overflow-hidden w-full max-w-sm rounded-xl border shadow-2xl backdrop-blur pointer-events-auto border-zinc-700/60 bg-zinc-900/90 text-zinc-100">
							<div className="flex gap-3 items-center px-5 pt-5">
								<div className="flex-1">
									<p className="text-xs tracking-widest uppercase text-zinc-400">
										Game Over
									</p>
									<h3 className="mt-1 text-xl font-semibold">
										{gameState.status === "won"
											? `${gameState.winner} wins`
											: "Draw"}
									</h3>
								</div>
							</div>
							<div className="px-5 pt-4 pb-5">
								<Button
									onClick={reset}
									className="w-full border bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border-zinc-700"
								>
									Reset board
								</Button>
							</div>
						</div>
					</div>
				)}
			</div>

			{/* Fullscreen Modals */}
			{fullscreenMode === "json" && (
				<Dialog open={true} onOpenChange={() => setFullscreenMode(null)}>
					<DialogContent className="max-w-[90vw] h-[90vh] w-full p-0 bg-black flex flex-col">
						<DialogHeader className="flex-shrink-0 p-4 pb-2">
							<DialogTitle className="flex justify-between items-center">
								<span>JSON Editor</span>
								<Button
									variant="outline"
									size="sm"
									onClick={() => setFullscreenMode(null)}
								>
									<Minimize2 className="mr-2 w-4 h-4" />
									Exit Fullscreen
								</Button>
							</DialogTitle>
						</DialogHeader>
						<div className="px-4 pb-4 h-[calc(100%-0px)] min-h-0 overflow-auto">
							{/* Ensure internal ScrollArea receives full height; no extra wrappers needed */}
							<SandboxEditor
								jsonText={jsonText}
								jsonError={jsonError}
								schemaErrors={schemaErrors}
								onChange={(code) => setJsonText(code)}
								onFormat={formatJson}
								scrollRootRef={scrollRootRef}
								editorWrapperRef={editorWrapperRef}
								onKeyDown={handleKeyDown}
							/>
						</div>
					</DialogContent>
				</Dialog>
			)}

			{fullscreenMode === "form" && (
				<Dialog open={true} onOpenChange={() => setFullscreenMode(null)}>
					<DialogContent className="max-w-[90vw] max-h-[90vh] w-full h-full p-0 bg-black flex flex-col">
						<DialogHeader className="flex-shrink-0 p-4 pb-2">
							<DialogTitle className="flex justify-between items-center">
								<span>Form Editor</span>
								<Button
									variant="outline"
									size="sm"
									onClick={() => setFullscreenMode(null)}
								>
									<Minimize2 className="mr-2 w-4 h-4" />
									Exit Fullscreen
								</Button>
							</DialogTitle>
						</DialogHeader>
						<div className="overflow-auto flex-1 px-4 pb-4 min-h-0">
							<SandboxForm form={form} />
						</div>
					</DialogContent>
				</Dialog>
			)}

			<PresetsModal
				open={presetsModalOpen}
				onOpenChange={setPresetsModalOpen}
				onSelectPreset={handleSelectPreset}
			/>
			<LibraryExplorerModal
				open={libraryModalOpen}
				onOpenChange={setLibraryModalOpen}
				onLoadConfig={handleLoadLibraryConfig}
				initialSeed={libraryShareSeed}
				initialCount={libraryShareCount}
			/>
		</div>
	);
}
