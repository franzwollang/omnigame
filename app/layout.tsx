import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import "prismjs/themes/prism.css";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
	title: "OmniGame",
	description: "OmniGame UI shell"
};

export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html lang="en" suppressHydrationWarning>
			<body
				className={`${inter.className} min-h-screen bg-background font-sans antialiased`}
			>
				<ThemeProvider attribute="class" defaultTheme="system" enableSystem>
					{children}
					<Toaster />
				</ThemeProvider>
			</body>
		</html>
	);
}
