"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
	error,
	reset
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useEffect(() => {
		console.error("GlobalError:", error);
	}, [error]);

	return (
		<html>
			<body>
				<div className="flex min-h-screen items-center justify-center p-6">
					<div className="max-w-md w-full rounded-lg border p-6">
						<h1 className="mb-2 text-xl font-semibold">Something went wrong</h1>
						<p className="mb-4 text-sm text-muted-foreground break-all">
							{error.message}
						</p>
						{error.digest && (
							<p className="mb-4 text-xs text-muted-foreground">
								Digest: {error.digest}
							</p>
						)}
						<div className="flex gap-2">
							<Button onClick={() => reset()} variant="outline">
								Try again
							</Button>
							<Button onClick={() => window.location.reload()}>Reload</Button>
						</div>
					</div>
				</div>
			</body>
		</html>
	);
}
