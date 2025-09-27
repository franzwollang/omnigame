import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
	title: "OmniGame Sandbox",
	description:
		"Explore the functional, data-driven game engine in a live Three.js playground."
};

export default function GameLayout({ children }: { children: ReactNode }) {
	return <div className="h-screen w-full">{children}</div>;
}
