"use client";

import { RefObject } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import Editor from "react-simple-code-editor";
import Prism from "prismjs";
import "prismjs/components/prism-json";

type Props = {
	jsonText: string;
	jsonError: string | null;
	schemaErrors: string[];
	onChange: (code: string) => void;
	onFormat: () => void;
	scrollRootRef: RefObject<HTMLDivElement>;
	editorWrapperRef: RefObject<HTMLDivElement>;
	onKeyDown: React.KeyboardEventHandler<HTMLDivElement>;
};

export default function SandboxEditor(props: Props) {
	const {
		jsonText,
		jsonError,
		schemaErrors,
		onChange,
		onFormat,
		scrollRootRef,
		editorWrapperRef,
		onKeyDown
	} = props;

	const highlight = (code: string) =>
		Prism.highlight(code, Prism.languages.json, "json");

	return (
		<div className="flex-1 min-h-0 flex flex-col">
			<div className="mb-2 flex h-10 items-center justify-between gap-3">
				<div>
					{jsonError ? (
						<div className="inline-block rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1 text-xs text-destructive">
							{jsonError}
						</div>
					) : schemaErrors.length ? (
						<div className="inline-block rounded-md border border-amber-400/40 bg-amber-400/10 px-2 py-1 text-xs text-amber-600">
							{schemaErrors[0]}
						</div>
					) : (
						<div className="inline-block rounded-md border border-emerald-400/40 bg-emerald-400/10 px-2 py-1 text-xs text-emerald-600">
							Config valid
						</div>
					)}
				</div>
				<Button variant="outline" size="sm" onClick={onFormat}>
					Format (⌘/Ctrl+F)
				</Button>
			</div>
			<ScrollArea
				ref={scrollRootRef}
				className="rounded-md border h-full min-h-0"
			>
				<div
					ref={editorWrapperRef}
					className="editor h-full min-h-0"
					onKeyDown={onKeyDown}
				>
					<Editor
						value={jsonText}
						onValueChange={onChange}
						highlight={highlight}
						padding={12}
						textareaId="omnigame-json-editor"
					/>
				</div>
			</ScrollArea>
		</div>
	);
}
