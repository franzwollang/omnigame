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
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle
} from "@/components/ui/dialog";
import { PresetsModal } from "@/components/presets-modal";
import { examplePresets, type ExamplePreset } from "@/presets/registry";
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
	const [fullscreenMode, setFullscreenMode] = useState<"form" | "json" | null>(
		null
	);
	const [activeTab, setActiveTab] = useState<"form" | "json">("json");

	// Initialize game engine from config
	const engineConfig = {
		gridWidth: currentConfig?.grid.width ?? 3,
		gridHeight: currentConfig?.grid.height ?? 3,
		winLength: currentConfig?.win.length ?? 3,
		adjacency: currentConfig?.win.adjacency ?? {
			mode: "linear" as const,
			horizontal: true,
			vertical: true,
			backDiagonal: true,
			forwardDiagonal: true
		},
		inputMode: (currentConfig as any)?.input?.mode ?? "cell",
		placementMode: (currentConfig as any)?.placement?.mode ?? "direct",
		gravityDirection:
			(currentConfig as any)?.placement?.gravity?.direction ?? "down",
		captureEnabled: Boolean(
			(currentConfig as any)?.placement?.capture?.enabled
		),
		initial: (currentConfig as any)?.initial ?? []
	};
	const {
		state: gameState,
		placeMove,
		activateColumn,
		reset
	} = useGameEngine(engineConfig);

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
				<div className="mt-4">
					<Button
						variant="outline"
						className="w-full"
						onClick={() => setPresetsModalOpen(true)}
					>
						Browse presets
					</Button>
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
					gameState={gameState}
					onCellClick={placeMove}
					onActivateColumn={activateColumn}
					inputMode={(currentConfig as any)?.input?.mode ?? "cell"}
					// pass tokens/placements for rendering
					tokens={(currentConfig as any)?.tokens ?? []}
					placements={(currentConfig as any)?.placements ?? []}
				/>
				{gameState.status !== "playing" && (
					<div className="flex absolute inset-0 z-10 justify-center items-center p-6 pointer-events-none">
						<div className="overflow-hidden w-full max-w-sm rounded-xl border shadow-2xl backdrop-blur pointer-events-auto border-zinc-700/60 bg-zinc-900/90 text-zinc-100">
							<div className="flex gap-3 items-center px-5 pt-5">
								<div
									className={`h-10 w-10 flex items-center justify-center rounded-full ${
										gameState.status === "won"
											? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/30"
											: "bg-sky-500/15 text-sky-300 ring-1 ring-sky-400/30"
									}`}
								>
									{gameState.status === "won" ? (
										<span className="text-lg">✓</span>
									) : (
										<span className="text-lg">≡</span>
									)}
								</div>
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
		</div>
	);
}
