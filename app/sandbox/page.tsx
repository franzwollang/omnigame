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

const SandboxEditorLazy = dynamic(() => import("./editor"), {
	ssr: false,
	loading: () => (
		<div className="min-h-0 flex flex-col flex-1">
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
			className="relative flex h-full min-h-0 min-w-0 flex-1"
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

	const exampleJson = `{
   "metadata": { "name": "My Game", "version": 1 },
   "grid": { "width": 10, "height": 10, "topology": "rectangle", "wrap": false },
   "turn": { "mode": "turn" },
   "rng": { "seed": 42 }
 }`;

	useEffect(() => {
		setJsonText(exampleJson);
	}, []);

	const form = useForm<Config>({
		defaultValues: {
			metadata: { name: "My Game", version: 1 },
			grid: { width: 10, height: 10, topology: "rectangle", wrap: false },
			turn: { mode: "turn" },
			rng: { seed: 42 }
		}
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
			} else {
				setSchemaErrors([]);
			}
		} catch (e: any) {
			setJsonError(e?.message ?? "Invalid JSON");
			setSchemaErrors([]);
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
		if (isMetaSave) {
			e.preventDefault();
			formatJson();
		}
	};

	const highlight = (code: string) =>
		Prism.highlight(code, Prism.languages.json, "json");

	return (
		<div className="flex h-full w-full">
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

				<Tabs
					defaultValue="json"
					className="mt-2 flex flex-col h-full overflow-hidden"
				>
					<TabsList className="w-full justify-start">
						<TabsTrigger value="form">Form</TabsTrigger>
						<TabsTrigger value="json">JSON</TabsTrigger>
					</TabsList>
					<TabsContent
						value="form"
						className="data-[state=active]:flex data-[state=active]:flex-1 data-[state=active]:min-h-0 data-[state=inactive]:hidden flex-col"
					>
						<SandboxForm form={form} />
					</TabsContent>
					<TabsContent
						value="json"
						className="data-[state=active]:flex data-[state=active]:flex-1 data-[state=active]:min-h-0 data-[state=inactive]:hidden flex-col"
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

			{/* Canvas area */}
			<SandboxCanvasLazy />
		</div>
	);
}
