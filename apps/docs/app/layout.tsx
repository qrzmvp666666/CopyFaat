import "./global.css";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { RootProvider } from "fumadocs-ui/provider/next";
import type { Metadata } from "next";

import { source } from "@/lib/source";

export const metadata: Metadata = {
	title: "CopyFast 文档",
	description: "了解 CopyFast 的 Telegram 与 Discord 社群消息监控和同步流程。",
	metadataBase: new URL(process.env.NEXT_PUBLIC_DOCS_URL ?? "http://localhost:4102"),
};

export default function Layout({ children }: LayoutProps<"/">) {
	return (
		<html lang="zh" className="dark" suppressHydrationWarning>
			<body className="flex min-h-screen flex-col">
				<RootProvider
					theme={{
						defaultTheme: "dark",
						enableSystem: false,
					}}
					search={{
						options: {
							api: "/api/search",
						},
					}}
				>
					<DocsLayout
						tree={source.getPageTree()}
						nav={{
							title: (
								<span className="gap-2 font-semibold flex items-center text-foreground">
									<img
										src="/images/brand/copyfast-logo.svg"
										alt=""
										aria-hidden
										width={32}
										height={32}
										className="size-8 object-contain"
									/>
									<span>CopyFast</span>
								</span>
							),
						}}
						sidebar={{ collapsible: true }}
					>
						{children}
					</DocsLayout>
				</RootProvider>
			</body>
		</html>
	);
}
