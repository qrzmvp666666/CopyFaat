"use client";

import { Button } from "@repo/ui/components/button";
import { CheckIcon, DownloadIcon, ExternalLinkIcon } from "lucide-react";
import { useLocale } from "next-intl";
import Link from "next/link";
import { useEffect, useState } from "react";

interface InstallPromptEvent extends Event {
	prompt: () => Promise<void>;
	userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export function PwaInstallPrompt() {
	const locale = useLocale();
	const isZh = locale === "zh";
	const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
	const [isInstalled, setIsInstalled] = useState(false);
	const [message, setMessage] = useState("");

	useEffect(() => {
		const isStandalone =
			window.matchMedia("(display-mode: standalone)").matches ||
			("standalone" in window.navigator && window.navigator.standalone === true);
		setIsInstalled(isStandalone);

		function handleInstallPrompt(event: Event) {
			event.preventDefault();
			setInstallPrompt(event as InstallPromptEvent);
		}

		function handleInstalled() {
			setIsInstalled(true);
			setInstallPrompt(null);
			setMessage(
				isZh ? "SignalFast 已添加到主屏幕。" : "SignalFast was added to your home screen.",
			);
		}

		window.addEventListener("beforeinstallprompt", handleInstallPrompt);
		window.addEventListener("appinstalled", handleInstalled);

		return () => {
			window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
			window.removeEventListener("appinstalled", handleInstalled);
		};
	}, [isZh]);

	async function installApp() {
		if (!installPrompt) {
			setMessage(
				isZh
					? "Chrome 尚未提供安装确认。请使用 Android Chrome 通过 HTTPS 或 localhost 打开此页面，并确认未处于无痕模式。"
					: "Chrome has not made installation available yet. Open this page in Android Chrome over HTTPS or localhost, and make sure Incognito mode is off.",
			);
			return;
		}

		await installPrompt.prompt();
		const choice = await installPrompt.userChoice;
		setInstallPrompt(null);
		setMessage(
			choice.outcome === "accepted"
				? isZh
					? "已确认安装，请等待桌面图标生成。"
					: "Installation accepted. The home-screen icon should appear shortly."
				: isZh
					? "你暂时取消了安装，可以稍后再试。"
					: "Installation was dismissed. You can try again later.",
		);
	}

	return (
		<main className="px-5 py-10 text-white flex min-h-dvh items-center justify-center bg-[#141414]">
			<section className="max-w-md w-full">
				<div className="mb-8 gap-4 flex items-center">
					<img
						alt="SignalFast"
						className="size-16 border-white/10 rounded-2xl border"
						height={64}
						src="/pwa-icon-192.png"
						width={64}
					/>
					<div>
						<p className="text-sm text-white/50">SignalFast</p>
						<h1 className="text-2xl font-semibold">
							{isZh ? "安装应用" : "Install the app"}
						</h1>
					</div>
				</div>

				<p className="mb-7 leading-7 text-white/65">
					{isZh
						? "将 SignalFast 添加到主屏幕，从桌面图标以独立应用窗口打开。"
						: "Add SignalFast to your home screen and open it in a standalone app window."}
				</p>

				{isInstalled ? (
					<div className="mb-5 gap-3 border-emerald-400/20 bg-emerald-400/8 p-4 text-emerald-200 flex items-center rounded-xl border">
						<CheckIcon className="size-5 shrink-0" />
						<p>{isZh ? "应用已安装" : "App installed"}</p>
					</div>
				) : (
					<Button className="w-full" onClick={installApp} size="lg" variant="primary">
						<DownloadIcon className="mr-2 size-4" />
						{isZh ? "安装到主屏幕" : "Install to home screen"}
					</Button>
				)}

				{message ? (
					<p aria-live="polite" className="mt-4 text-sm leading-6 text-white/60">
						{message}
					</p>
				) : null}

				<div className="mt-5 gap-3 sm:flex-row flex flex-col">
					<Button className="flex-1" asChild variant="outline">
						<Link href="/signals">
							{isZh ? "直接使用网页版" : "Continue to web app"}
							<ExternalLinkIcon className="ml-2 size-4" />
						</Link>
					</Button>
				</div>

				{!installPrompt && !isInstalled ? (
					<p className="mt-6 text-sm leading-6 text-white/45">
						{isZh
							? "如果没有弹出系统安装确认，请在 Chrome 菜单中选择“安装应用”。如果菜单只显示“添加到主屏幕/创建快捷方式”，请检查 HTTPS、PWA 清单和 Service Worker 是否可用。"
							: "If no system install prompt appears, choose “Install app” from Chrome’s menu. If you only see “Add to Home screen” or “Create shortcut”, check HTTPS, the web app manifest, and service worker."}
					</p>
				) : null}
			</section>
		</main>
	);
}
