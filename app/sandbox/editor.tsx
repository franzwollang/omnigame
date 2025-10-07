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
		<div className="flex flex-col h-full min-h-0">
			<div className="flex gap-3 justify-between items-center mb-2 h-10">
				<div>
					{jsonError ? (
						<div className="inline-block px-2 py-1 text-xs rounded-md border border-destructive/40 bg-destructive/10 text-destructive">
							{jsonError}
						</div>
					) : schemaErrors.length ? (
						<div className="inline-block px-2 py-1 text-xs text-amber-600 rounded-md border border-amber-400/40 bg-amber-400/10">
							{schemaErrors[0]}
						</div>
					) : (
						<div className="inline-block px-2 py-1 text-xs text-emerald-600 rounded-md border border-emerald-400/40 bg-emerald-400/10">
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
				className="h-full min-h-0 rounded-md border"
			>
				<div
					ref={editorWrapperRef}
					className="h-full min-h-0 editor"
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
