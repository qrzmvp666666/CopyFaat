"use client";

import { config } from "@config";
import { Button } from "@repo/ui/components/button";
import { ArrowRightIcon, StarIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";

import heroImageDark from "../../../public/images/hero-image-dark.png";
import heroImage from "../../../public/images/hero-image.png";
import { AVATAR_PHOTO_IDS, TESTIMONIAL_KEYS } from "../lib/testimonials";
import { TypewriterTitle } from "./TypewriterTitle";

export function HeroSection() {
	const t = useTranslations();
	const locale = useLocale();
	const isZh = locale === "zh";
	const heroCopy = isZh
		? {
				new: "🎇 新年快乐",
				badge: "2026 特价优惠",
				getStarted: "免费开始",
				documentation: "查看引导",
				socialProof: "999+ 用户使用 SignalFast 构建策略",
			}
		: {
				new: "🎇 Happy New Year",
				badge: "2026 Special Offer",
				getStarted: "Start Free",
				documentation: "View Guide",
				socialProof: "999+ users build strategies with SignalFast",
			};

	return (
		<div className="relative max-w-full overflow-x-hidden bg-linear-to-t from-background via-primary/5 to-background">
			<div className="py-8 md:py-16 relative z-20 container text-center">
				<div className="mb-4 flex justify-center">
					<div className="px-3 py-1 font-normal text-sm flex flex-wrap items-center justify-center rounded-full bg-muted p-px text-foreground">
						<span className="gap-2 font-semibold flex items-center rounded-full">
							{heroCopy.new}
						</span>
						<span className="ml-1 font-medium block">{heroCopy.badge}</span>
					</div>
				</div>

				<TypewriterTitle />

				<div className="mt-4 gap-2 flex items-center justify-center">
					<Button size="lg" variant="primary" asChild>
						<a href={config.saasUrl}>
							{heroCopy.getStarted}
							<ArrowRightIcon className="ml-2 size-4" />
						</a>
					</Button>
					<Button variant="ghost" size="lg" asChild>
						<a href="#hero-image-area">{heroCopy.documentation}</a>
					</Button>
				</div>

				{/* Social proof */}
				<div className="mt-6 gap-3 flex items-center justify-center">
					<div className="flex items-center">
						{TESTIMONIAL_KEYS.map((key, i) => (
							<div
								key={key}
								className={`size-9 overflow-hidden rounded-full border-2 border-background ${i > 0 ? "-ml-3" : ""}`}
							>
								<Image
									src={`https://i.pravatar.cc/72?img=${AVATAR_PHOTO_IDS[key]}`}
									alt={key}
									width={36}
									height={36}
									className="size-full object-cover"
									unoptimized
								/>
							</div>
						))}
					</div>
					<div className="text-left">
						<div className="gap-0.5 flex items-center">
							{Array.from({ length: 5 }).map((_, i) => (
								<StarIcon
									key={i}
									className="size-4 fill-yellow-400 text-yellow-400"
								/>
							))}
						</div>
						<p className="mt-0.5 text-xs text-muted-foreground">
							{heroCopy.socialProof}
						</p>
					</div>
				</div>

				<div id="hero-image-area" className="scroll-mt-20 mt-7 lg:mt-9 max-w-6xl mx-auto">
					<div className="p-1.5 md:p-2 shadow-2xl dark:border-white/10 dark:bg-white/[0.04] dark:shadow-black/40 relative overflow-hidden rounded-3xl border border-primary/10 bg-primary/5 shadow-primary/5">
						<div className="relative aspect-[3342/2126] overflow-hidden rounded-2xl">
							<Image
								src={heroImage}
								alt={t("home.hero.imageAlt")}
								fill
								className="object-cover dark:hidden"
								priority
								sizes="(min-width: 1280px) 1152px, calc(100vw - 48px)"
							/>
							<Image
								src={heroImageDark}
								alt={t("home.hero.imageAlt")}
								fill
								className="hidden object-cover dark:block"
								priority
								sizes="(min-width: 1280px) 1152px, calc(100vw - 48px)"
							/>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
