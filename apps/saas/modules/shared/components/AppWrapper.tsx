"use client";

import { cn } from "@repo/ui";
import { usePathname } from "next/navigation";
import type { PropsWithChildren } from "react";

import { SidebarProvider, useSidebar } from "../lib/sidebar-context";
import { NavBar } from "./NavBar";

function AppContent({ children }: PropsWithChildren) {
	const { isCollapsed } = useSidebar();
	const pathname = usePathname();
	const isSignalsWorkspace = pathname === "/signals" || pathname.endsWith("/signals");

	return (
		<div className="md:h-screen md:overflow-hidden bg-background">
			<NavBar />
			<div
				className={cn(
					"md:py-2 md:pr-2 flex",
					isSignalsWorkspace ? "md:h-screen min-h-screen" : "h-screen",
					{
						"md:ml-[280px]": !isCollapsed,
						"md:ml-[80px]": isCollapsed,
					},
				)}
			>
				<main
					className={cn(
						"md:border md:rounded-2xl w-full border-t bg-card",
						isSignalsWorkspace
							? "p-0 md:h-full md:overflow-hidden min-h-full overflow-visible"
							: "py-6 md:overflow-y-auto h-full",
					)}
				>
					<div className={cn(isSignalsWorkspace ? "h-full min-h-0" : "container")}>
						{children}
					</div>
				</main>
			</div>
		</div>
	);
}

export function AppWrapper({ children }: PropsWithChildren) {
	return (
		<SidebarProvider>
			<AppContent>{children}</AppContent>
		</SidebarProvider>
	);
}
