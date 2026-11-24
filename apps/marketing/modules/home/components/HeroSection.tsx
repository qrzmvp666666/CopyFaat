"use client";

/* oxlint-disable jsx-a11y/media-has-caption -- Existing product recording has no supplied caption track; player retains native audio controls. */

import { getSaasUrl } from "@shared/lib/saas-url";
import {
	ArrowUpRightIcon,
	ChartCandlestickIcon,
	LayoutDashboardIcon,
	RadioIcon,
	PlayIcon,
	XIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import { Dialog } from "radix-ui";
import { useState } from "react";

const TAB_ICONS = [LayoutDashboardIcon, ChartCandlestickIcon, RadioIcon, PlayIcon];
export function HeroSection() {
	const t = useTranslations("home.island");
	const locale = useLocale();
	const [activeTab, setActiveTab] = useState(0);
	const [videoOpen, setVideoOpen] = useState(false);
	const tabs = t.raw("tabs") as string[];
	return (
		<>
			<section className="island-hero">
				<div className="island-scatter" aria-hidden="true" />
				<h1>
					<span>{t("line1")}</span>
					<span className="island-green">{t("line2")}</span>
				</h1>
				<p>
					{t("intro")}
					<br />
					{t("intro2")}
				</p>
				<div className="island-hero-actions">
					<a
						className="island-button island-button-primary"
						href={getSaasUrl(locale, "/install")}
					>
						{t("start")}
						<ArrowUpRightIcon size={16} />
					</a>
					<a className="island-button island-button-secondary" href="#pricing">
						{t("plans")}
					</a>
				</div>
			</section>
			<section className="island-demo" aria-label={t("demoTitle")}>
				<div
					className={`island-product-frame island-product-view-${activeTab}`}
					id="product-preview"
					role="tabpanel"
					aria-labelledby={`preview-tab-${activeTab}`}
				>
					<Image
						src="/images/hero-image-dark.png"
						alt={t("demoDescription")}
						width={3024}
						height={1654}
						priority
						sizes="(max-width: 760px) 94vw, 1060px"
						className="island-product-image"
					/>
				</div>
				<div className="island-demo-controls" role="tablist" aria-label={t("demoTitle")}>
					{tabs.slice(0, 3).map((tab, index) => {
						const Icon = TAB_ICONS[index];
						return (
							<button
								key={tab}
								type="button"
								role="tab"
								id={`preview-tab-${index}`}
								aria-controls="product-preview"
								aria-selected={activeTab === index}
								tabIndex={activeTab === index ? 0 : -1}
								onClick={() => setActiveTab(index)}
								onKeyDown={(event) => {
									if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
										event.preventDefault();
										const next =
											(index + (event.key === "ArrowRight" ? 1 : 2)) % 3;
										setActiveTab(next);
										document.getElementById(`preview-tab-${next}`)?.focus();
									}
								}}
							>
								<Icon size={14} />
								{tab}
							</button>
						);
					})}
					<button type="button" onClick={() => setVideoOpen(true)}>
						<PlayIcon size={13} />
						{tabs[3]}
					</button>
				</div>
				<h2>{t("demoTitle")}</h2>
				<p className="island-muted">{t("demoDescription")}</p>
			</section>
			<div className="island-community">
				<p>{t("trusted")}</p>
				<div>
					<span>
						<Image
							src="/images/contact/telegram-icon.png"
							width={22}
							height={22}
							alt=""
						/>
						Telegram
					</span>
					<span>
						<Image
							src="/images/contact/discord-icon.png"
							width={25}
							height={25}
							alt=""
						/>
						Discord
					</span>
					<span className="island-community-word">BTC</span>
					<span className="island-community-word">ETH</span>
					<span className="island-community-word">SOL</span>
				</div>
			</div>
			<Dialog.Root open={videoOpen} onOpenChange={setVideoOpen}>
				<Dialog.Portal>
					<Dialog.Overlay className="island-dialog-overlay" />
					<Dialog.Content className="island-video-dialog" aria-describedby={undefined}>
						<Dialog.Title className="sr-only">{t("videoLabel")}</Dialog.Title>
						<video
							controls
							autoPlay
							playsInline
							preload="metadata"
							poster="/images/hero-video-poster.jpg"
						>
							<source src="/videos/hero-preview.mp4" type="video/mp4" />
							<track
								kind="captions"
								src={`/videos/hero-preview.${locale}.vtt`}
								srcLang={locale}
								label={locale === "zh" ? "中文" : "English"}
								default
							/>
						</video>
						<Dialog.Close className="island-video-close" aria-label={t("close")}>
							<XIcon size={20} />
						</Dialog.Close>
					</Dialog.Content>
				</Dialog.Portal>
			</Dialog.Root>
		</>
	);
}
