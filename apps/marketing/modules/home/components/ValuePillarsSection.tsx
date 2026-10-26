"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
	BellRingIcon,
	BitcoinIcon,
	CircleDollarSignIcon,
	CoinsIcon,
	LogInIcon,
	TargetIcon,
} from "lucide-react";
import { useLocale } from "next-intl";
import Image from "next/image";

const KOL_AVATARS = [
	"/images/hero-floating/icon-1.png",
	"/images/hero-floating/icon-2.png",
	"/images/hero-floating/icon-3.png",
	"/images/hero-floating/icon-4.png",
] as const;

const FEATURES = {
	zh: [
		{
			id: "many",
			number: "01",
			title: "多看一些，机会不只一个来源。",
			text: "热门合约与多位 KOL 的观点，集中在一个视图里。",
		},
		{
			id: "fast",
			number: "02",
			title: "信号来了，不必守着每个群。",
			text: "通过 Telegram 和 Discord 接收及时提醒。",
		},
		{
			id: "good",
			number: "03",
			title: "把不同观点，放回行情里看。",
			text: "多个 KOL 信号汇在同一张 K 线图上。",
		},
		{
			id: "save",
			number: "04",
			title: "别再为多个群的信号，月月重复付费。",
			text: "一个 Pro 计划整合行情、KOL 信号和提醒，少付多份月费。年费 US$49.99，立即省 US$313.49。",
		},
	],
	en: [
		{
			id: "many",
			number: "01",
			title: "See more. Find more perspectives.",
			text: "Popular contracts and KOL viewpoints, together in one view.",
		},
		{
			id: "fast",
			number: "02",
			title: "Stay in the loop, not every group.",
			text: "Receive timely alerts through Telegram and Discord.",
		},
		{
			id: "good",
			number: "03",
			title: "See every signal in market context.",
			text: "Bring multiple KOL signals together on one chart.",
		},
		{
			id: "save",
			number: "04",
			title: "Stop paying monthly for signals across multiple groups.",
			text: "One Pro plan brings market data, KOL signals, and alerts together. Pay less than stacking monthly group subscriptions.",
		},
	],
} as const;

const COINS = [
	{ symbol: "BTC", color: "text-amber-300", icon: BitcoinIcon },
	{ symbol: "ETH", color: "text-indigo-200", icon: CoinsIcon },
	{ symbol: "SOL", color: "text-emerald-200", icon: CircleDollarSignIcon },
] as const;

const SIGNAL_CURVE =
	"M 8 174 C 56 159, 74 117, 122 122 S 190 164, 232 128 S 286 68, 332 92 S 397 145, 442 90 S 520 84, 592 34";
const KOL_SIGNAL_POINTS = [
	{ src: KOL_AVATARS[1], left: "20%", top: "53%" },
	{ src: KOL_AVATARS[0], left: "49%", top: "40%" },
	{ src: KOL_AVATARS[2], left: "77%", top: "37%" },
] as const;

export function ValuePillarsSection() {
	const locale = useLocale();
	const reduceMotion = useReducedMotion();
	const features = locale === "zh" ? FEATURES.zh : FEATURES.en;

	return (
		<section id="value" className="scroll-mt-20 px-4 py-16 sm:px-6 md:py-24">
			<div className="max-w-6xl mx-auto">
				<header className="mb-10 max-w-3xl md:mb-16">
					<p className="text-xs font-medium tracking-[0.16em] text-foreground/45 uppercase">
						SIGNALFAST / THE ADVANTAGE
					</p>
					<h2 className="mt-4 text-4xl font-medium sm:text-5xl md:text-6xl leading-[1.08] text-foreground">
						{locale === "zh" ? (
							<>
								多、快、好、省。
								<br />
								交易信息，不必各自分散。
							</>
						) : (
							<>
								More signal.
								<br />
								Less scattered noise.
							</>
						)}
					</h2>
					<p className="mt-5 max-w-xl text-base leading-7 sm:text-lg text-foreground/55">
						{locale === "zh"
							? "从发现市场机会，到读懂 KOL 信号，再到及时收到提醒。"
							: "Discover markets, understand KOL signals, and get timely alerts."}
					</p>
				</header>

				<div className="divide-y divide-foreground/12 border-y border-foreground/12">
					{features.map((feature, index) => (
						<motion.article
							key={feature.id}
							initial={reduceMotion ? false : { opacity: 0, y: 24 }}
							whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
							viewport={{ once: true, amount: 0.2 }}
							transition={{ duration: 0.55, delay: reduceMotion ? 0 : index * 0.04 }}
							className="mobile-motion-visible gap-8 py-10 sm:py-12 md:grid-cols-[0.85fr_1.15fr] md:gap-14 md:py-16 grid grid-cols-1 items-center"
						>
							<div className="max-w-md">
								<p className="text-xs font-medium text-foreground/40 tabular-nums">
									{feature.number} / {feature.id.toUpperCase()}
								</p>
								<h3 className="mt-4 text-2xl font-medium leading-tight sm:text-3xl md:text-4xl text-foreground">
									{feature.title}
								</h3>
								<p className="mt-4 text-sm leading-6 sm:text-base sm:leading-7 text-foreground/55">
									{feature.text}
								</p>
							</div>
							<FeatureVisual
								id={feature.id}
								locale={locale}
								reduceMotion={reduceMotion}
							/>
						</motion.article>
					))}
				</div>
			</div>
		</section>
	);
}

function FeatureVisual({
	id,
	locale,
	reduceMotion,
}: {
	id: string;
	locale: string;
	reduceMotion: boolean | null;
}) {
	if (id === "many") {
		return (
			<div className="relative mx-auto aspect-[1.65] w-full max-w-[590px]" aria-hidden="true">
				<div className="left-0 border-white/10 p-4 shadow-2xl shadow-black/60 sm:p-6 absolute inset-y-[12%] w-[66%] rounded-lg border bg-[#111]">
					<div className="border-white/8 pb-3 text-xs text-white/45 flex items-center justify-between border-b">
						<span>MARKET WATCH</span>
						<span>03</span>
					</div>
					<div className="mt-1 divide-white/8 divide-y">
						{COINS.map((coin, index) => (
							<motion.div
								key={coin.symbol}
								initial={reduceMotion ? false : { opacity: 0, x: -10 }}
								whileInView={reduceMotion ? undefined : { opacity: 1, x: 0 }}
								viewport={{ once: true }}
								transition={{
									duration: 0.4,
									delay: reduceMotion ? 0 : index * 0.1,
								}}
								className="mobile-motion-visible py-3 sm:py-4 flex items-center justify-between"
							>
								<span className="gap-2.5 sm:gap-3 flex items-center">
									<span
										className={`size-7 bg-white/8 font-semibold flex items-center justify-center rounded-full text-[9px] ${coin.color}`}
									>
										<coin.icon
											className="size-4"
											strokeWidth={1.8}
											aria-hidden="true"
										/>
									</span>
									<span className="text-xs font-medium text-white/75 sm:text-sm">
										{coin.symbol}
										<span className="ml-1 text-white/35">/ USDT</span>
									</span>
								</span>
								<span className="text-white/35 sm:text-[10px] text-[9px]">
									PERPETUAL
								</span>
							</motion.div>
						))}
					</div>
				</div>
				<motion.div
					initial={reduceMotion ? false : { opacity: 0, y: 18 }}
					whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
					viewport={{ once: true }}
					transition={{ duration: 0.55, delay: reduceMotion ? 0 : 0.18 }}
					className="mobile-motion-visible bottom-0 right-0 border-white/12 p-3 sm:p-5 absolute w-[58%] rounded-lg border bg-[#171717] shadow-[0_18px_55px_rgba(0,0,0,.5)]"
				>
					<div className="text-white/45 sm:text-xs flex items-center justify-between text-[10px]">
						<span>KOL NETWORK</span>
						<span className="gap-1.5 flex items-center">
							<span className="size-1.5 bg-emerald-400 rounded-full" /> LIVE
						</span>
					</div>
					<div className="mt-4 flex items-center">
						{KOL_AVATARS.map((src, index) => (
							<motion.div
								key={src}
								initial={reduceMotion ? false : { opacity: 0, scale: 0.7 }}
								whileInView={reduceMotion ? undefined : { opacity: 1, scale: 1 }}
								viewport={{ once: true }}
								transition={{
									duration: 0.35,
									delay: reduceMotion ? 0 : 0.3 + index * 0.07,
								}}
								className={`mobile-motion-visible size-8 bg-neutral-700 sm:size-11 relative overflow-hidden rounded-full border-2 border-[#171717] ${index ? "-ml-2 sm:-ml-3" : ""}`}
							>
								<Image
									src={src}
									alt=""
									width={44}
									height={44}
									className="size-full object-cover"
								/>
							</motion.div>
						))}
						<span className="text-white/45 sm:text-xs ml-auto text-[10px]">+ KOLs</span>
					</div>
				</motion.div>
			</div>
		);
	}

	if (id === "fast") {
		return (
			<div className="relative mx-auto aspect-[1.65] w-full max-w-[590px]" aria-hidden="true">
				<div className="left-0 border-white/10 p-4 shadow-2xl shadow-black/50 sm:p-6 absolute top-[10%] w-[72%] rounded-lg border bg-[#111]">
					<div className="gap-2 border-white/8 pb-3 flex items-center border-b">
						<BellRingIcon className="size-4 text-white/55" />
						<span className="text-xs text-white/45">SIGNAL ALERT</span>
					</div>
					<div className="mt-4 gap-3 flex">
						<div className="size-9 bg-white flex shrink-0 items-center justify-center rounded-lg">
							<Image
								src="/images/contact/telegram-icon.png"
								alt=""
								width={28}
								height={28}
							/>
						</div>
						<div className="min-w-0">
							<p className="text-xs font-medium text-white/85 sm:text-sm">
								{locale === "zh" ? "新信号已送达" : "New signal delivered"}
							</p>
							<p className="mt-1 text-white/40 sm:text-xs truncate text-[10px]">
								BTC / USDT · KOL update
							</p>
						</div>
						<span className="text-white/35 ml-auto shrink-0 text-[10px]">now</span>
					</div>
				</div>
				<motion.div
					initial={reduceMotion ? false : { opacity: 0, x: 20 }}
					whileInView={reduceMotion ? undefined : { opacity: 1, x: 0 }}
					viewport={{ once: true }}
					transition={{ duration: 0.55, delay: reduceMotion ? 0 : 0.2 }}
					className="mobile-motion-visible right-0 border-white/12 p-4 sm:p-5 absolute bottom-[8%] w-[66%] rounded-lg border bg-[#191919] shadow-[0_18px_55px_rgba(0,0,0,.5)]"
				>
					<div className="gap-3 flex items-center">
						<div className="size-9 bg-white flex items-center justify-center rounded-lg">
							<Image
								src="/images/contact/discord-icon.png"
								alt=""
								width={28}
								height={28}
							/>
						</div>
						<div>
							<p className="text-xs font-medium text-white/80">Discord</p>
							<p className="mt-1 text-white/40 text-[10px]">SignalFast / alerts</p>
						</div>
						<motion.span
							animate={
								reduceMotion
									? undefined
									: { scale: [1, 1.18, 1], opacity: [0.55, 1, 0.55] }
							}
							transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
							className="size-2 bg-emerald-400 ml-auto rounded-full"
						/>
					</div>
				</motion.div>
			</div>
		);
	}

	if (id === "good") {
		return (
			<div className="relative mx-auto aspect-[1.65] w-full max-w-[590px]" aria-hidden="true">
				<div className="inset-0 border-white/10 p-4 shadow-2xl shadow-black/45 sm:p-6 absolute overflow-hidden rounded-lg border bg-[#101010]">
					<div className="border-white/8 pb-3 flex items-center justify-between border-b">
						<div className="gap-2 flex items-center">
							<span className="text-xs font-semibold text-white/80">BTC / USDT</span>
							<span className="text-white/35 text-[10px]">4H</span>
						</div>
						<span className="text-emerald-300/75 text-[10px]">KOL SIGNALS</span>
					</div>
					<div className="inset-x-4 bottom-5 top-16 sm:inset-x-6 absolute flex flex-col justify-between opacity-20">
						{Array.from({ length: 4 }).map((_, index) => (
							<span
								key={index}
								className="border-white/40 w-full border-t border-dashed"
							/>
						))}
					</div>
					<div className="inset-x-5 bottom-6 top-16 sm:inset-x-8 absolute">
						<svg
							viewBox="0 0 600 230"
							preserveAspectRatio="none"
							className="size-full overflow-visible"
							focusable="false"
						>
							<motion.path
								d={SIGNAL_CURVE}
								fill="none"
								stroke="white"
								strokeLinecap="round"
								strokeWidth="2.5"
								className="mobile-motion-visible"
								initial={reduceMotion ? false : { pathLength: 0, opacity: 0.45 }}
								whileInView={
									reduceMotion ? undefined : { pathLength: 1, opacity: 0.95 }
								}
								viewport={{ once: true }}
								transition={{ duration: 1.6, ease: "easeInOut" }}
							/>
							{KOL_SIGNAL_POINTS.map((point, index) => (
								<motion.circle
									key={point.src}
									cx={[122, 292, 462][index]}
									cy={[122, 91, 86][index]}
									r="7"
									fill="#101010"
									stroke="white"
									strokeWidth="2"
									className="mobile-motion-visible"
									initial={reduceMotion ? false : { scale: 0, opacity: 0 }}
									whileInView={
										reduceMotion ? undefined : { scale: 1, opacity: 1 }
									}
									viewport={{ once: true }}
									transition={{
										duration: 0.25,
										delay: reduceMotion ? 0 : 0.48 + index * 0.4,
									}}
								/>
							))}
						</svg>
						{KOL_SIGNAL_POINTS.map((point, index) => (
							<motion.span
								key={point.src}
								initial={reduceMotion ? false : { scale: 0.65, opacity: 0, y: 6 }}
								whileInView={
									reduceMotion ? undefined : { scale: 1, opacity: 1, y: 0 }
								}
								viewport={{ once: true }}
								transition={{
									duration: 0.3,
									delay: reduceMotion ? 0 : 0.58 + index * 0.4,
								}}
								style={{ left: point.left, top: point.top }}
								className="mobile-motion-visible size-8 sm:size-9 border-white absolute -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full border-2 bg-[#101010] shadow-[0_0_0_4px_rgba(255,255,255,.08)]"
							>
								<Image
									src={point.src}
									alt=""
									width={36}
									height={36}
									className="size-full object-cover"
								/>
							</motion.span>
						))}
					</div>
					<motion.div
						initial={reduceMotion ? false : { opacity: 0, x: 16, y: 10 }}
						whileInView={reduceMotion ? undefined : { opacity: 1, x: 0, y: 0 }}
						viewport={{ once: true }}
						transition={{ duration: 0.45, delay: reduceMotion ? 0 : 1.45 }}
						className="mobile-motion-visible bottom-3 left-3 border-white/15 p-2.5 sm:bottom-4 sm:left-5 sm:p-3 shadow-xl absolute w-[46%] rounded-md border bg-[#171717]/95"
					>
						<div className="gap-1.5 text-white/55 flex items-center text-[9px]">
							<LogInIcon className="size-3 text-emerald-300" aria-hidden="true" />
							<span>LONG · BTC/USDT</span>
						</div>
						<div className="mt-2 gap-1 grid grid-cols-3 text-[8px] tabular-nums">
							<span className="text-white/55">
								ENTRY
								<br />
								<b className="text-white/85">67,420</b>
							</span>
							<span className="text-emerald-300/75">
								TP
								<br />
								<b>69,180</b>
							</span>
							<span className="text-rose-300/75">
								SL
								<br />
								<b>66,580</b>
							</span>
						</div>
					</motion.div>
				</div>
			</div>
		);
	}

	return (
		<div className="relative mx-auto aspect-[1.65] w-full max-w-[590px]" aria-hidden="true">
			<div className="left-0 border-white/10 p-4 shadow-2xl shadow-black/50 sm:p-6 absolute top-[8%] w-[72%] rounded-lg border bg-[#111]">
				<p className="font-medium text-white/40 text-[10px] tracking-[0.14em]">
					SIGNALFAST PRO
				</p>
				<div className="mt-4 gap-2 flex items-end">
					<span className="text-3xl font-medium tracking-tight text-white sm:text-4xl">
						US$49.99
					</span>
					<span className="pb-1 text-xs text-white/45">
						/ {locale === "zh" ? "年" : "year"}
					</span>
				</div>
				<div className="mt-3 gap-2 flex items-center">
					<span className="bg-white px-2.5 py-1 font-semibold text-black rounded-full text-[10px]">
						{locale === "zh" ? "立即省 US$313.49" : "Save US$313.49 now"}
					</span>
					<span className="text-xs text-white/50">
						{locale === "zh" ? "约 86% / 7.3X" : "about 86% / 7.3X"}
					</span>
				</div>
				<div className="mt-4 gap-1.5 flex">
					{["Market data", "KOL signals", "Alerts"].map((label) => (
						<span
							key={label}
							className="rounded border-white/10 px-2 py-1 text-white/45 sm:text-[9px] border text-[8px]"
						>
							{label}
						</span>
					))}
				</div>
			</div>
			<motion.div
				initial={reduceMotion ? false : { opacity: 0, y: 18 }}
				whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
				viewport={{ once: true }}
				transition={{ duration: 0.5, delay: reduceMotion ? 0 : 0.2 }}
				className="mobile-motion-visible right-0 border-white/12 p-3 sm:p-4 absolute bottom-[5%] w-[47%] rounded-lg border bg-[#1b1b1b] shadow-[0_18px_55px_rgba(0,0,0,.5)]"
			>
				<div className="text-white/45 sm:text-[10px] flex items-center justify-between text-[9px]">
					<span>ONE PLAN</span>
					<TargetIcon className="size-3.5" aria-hidden="true" />
				</div>
				<p className="mt-3 text-xs font-medium leading-5 text-white/85 sm:text-sm">
					{locale === "zh"
						? "别让多个群的月费，一笔一笔叠起来。"
						: "Don't let monthly group fees stack up."}
				</p>
			</motion.div>
		</div>
	);
}
