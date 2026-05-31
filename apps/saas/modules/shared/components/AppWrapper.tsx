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
				className={cn("md:py-2 md:pr-2 flex h-screen", {
					"md:ml-[280px]": !isCollapsed,
					"md:ml-[80px]": isCollapsed,
				})}
			>
				<main
					className={cn(
						"md:border md:rounded-2xl md:overflow-y-auto h-full w-full border-t bg-card",
						isSignalsWorkspace ? "p-0 overflow-hidden" : "py-6",
					)}
				>
					<div className={cn(!isSignalsWorkspace && "container")}>{children}</div>
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
