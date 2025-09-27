"use client";

import { cn } from "@/lib/style";
import { Loader2 } from "lucide-react";

type CenteredLoaderProps = {
	className?: string;
	iconClassName?: string;
};

export function CenteredLoader({
	className,
	iconClassName
}: CenteredLoaderProps) {
	return (
		<div className={cn("flex items-center justify-center", className)}>
			<Loader2
				className={cn("animate-spin text-muted-foreground", iconClassName)}
			/>
		</div>
	);
}

export default CenteredLoader;
