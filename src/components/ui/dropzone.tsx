"use client";

import type { ReactNode } from "react";
import { useCallback } from "react";
import {
	useDropzone,
	type DropEvent,
	type DropzoneOptions,
	type FileRejection
} from "react-dropzone";

import { cn } from "@/lib/style";

export interface DropzoneProps extends DropzoneOptions {
	className?: string;
	children?: ReactNode;
}

export function Dropzone({
	className,
	children,
	onDrop,
	...options
}: DropzoneProps) {
	const handleDrop = useCallback(
		<T extends File>(
			accepted: T[],
			rejected: FileRejection[],
			event: DropEvent
		) => {
			onDrop?.(accepted, rejected, event);
		},
		[onDrop]
	);

	const { getRootProps, getInputProps, isDragActive } = useDropzone({
		onDrop: handleDrop,
		...options
	});

	return (
		<div
			{...getRootProps()}
			className={cn(
				"flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-muted-foreground/40 bg-muted/30 p-10 text-sm text-muted-foreground transition-colors hover:border-muted-foreground",
				isDragActive && "border-primary text-primary",
				className
			)}
		>
			<input {...getInputProps()} />
			{children ??
				(isDragActive
					? "Drop the files here"
					: "Drag & drop files or click to browse")}
		</div>
	);
}
