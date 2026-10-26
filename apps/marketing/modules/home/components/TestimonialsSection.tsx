"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import { useEffect, useState } from "react";

import { AVATAR_PHOTO_IDS, TESTIMONIAL_KEYS } from "../lib/testimonials";

export function TestimonialsSection() {
	const t = useTranslations();
	const locale = useLocale();
	const reduceMotion = useReducedMotion();
	const [activeIndex, setActiveIndex] = useState(0);
	const items = TESTIMONIAL_KEYS.map((key) => ({
		key,
		quote: t(`home.testimonials.items.${key}.quote`),
		name: t(`home.testimonials.items.${key}.name`),
		role: t(`home.testimonials.items.${key}.role`),
	}));
	const activeItem = items[activeIndex];

	useEffect(() => {
		if (reduceMotion) return;

		const timer = window.setInterval(() => {
			setActiveIndex((index) => (index + 1) % items.length);
		}, 6500);

		return () => window.clearInterval(timer);
	}, [items.length, reduceMotion]);

	function showPrevious() {
		setActiveIndex((index) => (index - 1 + items.length) % items.length);
	}

	function showNext() {
		setActiveIndex((index) => (index + 1) % items.length);
	}

	return (
		<section className="px-4 py-8 sm:px-6 lg:py-12">
			<div className="max-w-4xl mx-auto">
				<div className="mb-7 max-w-3xl sm:mb-9 mx-auto text-center">
					<h2 className="font-medium text-2xl md:text-3xl lg:text-4xl xl:text-5xl leading-tight text-foreground">
						{t("home.testimonials.title")}
					</h2>
					<p className="mt-2 text-sm sm:text-lg text-foreground/60">
						{t("home.testimonials.subtitle")}
					</p>
				</div>

				<div
					className="border-white/10 shadow-2xl shadow-black/30 overflow-hidden rounded-2xl border bg-[#111315]"
					role="region"
					aria-roledescription={locale === "zh" ? "轮播" : "carousel"}
					aria-label={t("home.testimonials.title")}
				>
					<div className="px-4 py-3.5 border-white/10 gap-3 sm:px-5 flex items-center border-b">
						<div className="size-9 flex shrink-0 items-center justify-center rounded-full bg-[#229ED9]">
							<Image
								src="/images/contact/telegram-icon.png"
								alt=""
								width={24}
								height={24}
								className="size-6 object-contain"
							/>
						</div>
						<div className="min-w-0 flex-1">
							<p className="text-sm font-semibold text-white">
								{locale === "zh" ? "SignalFast 用户群" : "SignalFast Community"}
							</p>
							<p className="text-xs text-white/45">
								{locale === "zh" ? "用户评价" : "Member stories"}
							</p>
						</div>
						<span className="text-xs text-white/40 tabular-nums">
							{String(activeIndex + 1).padStart(2, "0")} /{" "}
							{String(items.length).padStart(2, "0")}
						</span>
					</div>

					<div className="px-4 py-7 sm:min-h-[300px] sm:px-8 sm:py-9 flex min-h-[270px] items-center">
						<AnimatePresence mode="wait" initial={false}>
							<motion.article
								key={activeItem.key}
								initial={reduceMotion ? false : { opacity: 0, y: 10 }}
								animate={{ opacity: 1, y: 0 }}
								exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
								transition={{ duration: 0.28 }}
								className="w-full"
								aria-live="polite"
							>
								<div className="max-w-2xl">
									<div className="mb-2 gap-2 flex items-center">
										<div className="size-8 border-white/10 overflow-hidden rounded-full border">
											<Image
												src={`https://i.pravatar.cc/80?img=${AVATAR_PHOTO_IDS[activeItem.key]}`}
												alt=""
												width={32}
												height={32}
												className="size-full object-cover"
												unoptimized
											/>
										</div>
										<span className="text-xs font-medium text-[#7ecbff]">
											{activeItem.name}
										</span>
									</div>
									<div className="px-4 py-3.5 sm:px-5 sm:py-4 rounded-2xl rounded-tl-sm bg-[#202b36]">
										<p className="text-sm leading-7 text-white/90 sm:text-base sm:leading-8">
											{activeItem.quote}
										</p>
										<div className="mt-2 gap-2 text-white/40 flex items-center justify-end text-[11px]">
											<span>{activeItem.role}</span>
											<span aria-hidden="true">·</span>
											<span>SignalFast</span>
										</div>
									</div>
								</div>
							</motion.article>
						</AnimatePresence>
					</div>

					<div className="px-4 py-3 border-white/10 sm:px-5 flex items-center justify-between border-t">
						<p className="text-xs text-white/40">
							{locale === "zh"
								? "SignalFast 用户分享"
								: "Shared by SignalFast members"}
						</p>
						<div className="gap-2 flex items-center">
							<button
								type="button"
								onClick={showPrevious}
								aria-label={locale === "zh" ? "上一条评价" : "Previous review"}
								className="size-8 border-white/15 hover:bg-white/10 text-white/75 focus-visible:ring-white/70 flex items-center justify-center rounded-full border transition-colors focus-visible:ring-2 focus-visible:outline-none"
							>
								<ChevronLeftIcon className="size-4" aria-hidden="true" />
							</button>
							<button
								type="button"
								onClick={showNext}
								aria-label={locale === "zh" ? "下一条评价" : "Next review"}
								className="size-8 border-white/15 hover:bg-white/10 text-white/75 focus-visible:ring-white/70 flex items-center justify-center rounded-full border transition-colors focus-visible:ring-2 focus-visible:outline-none"
							>
								<ChevronRightIcon className="size-4" aria-hidden="true" />
							</button>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
