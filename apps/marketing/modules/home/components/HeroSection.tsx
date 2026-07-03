"use client";

import { config } from "@config";
import { Button } from "@repo/ui/components/button";
import type { MotionValue } from "framer-motion";
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";
import { ArrowRightIcon, StarIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import { useRef } from "react";

import heroImageDark from "../../../public/images/hero-image-dark.png";
import heroImage from "../../../public/images/hero-image.png";
import { AVATAR_PHOTO_IDS, TESTIMONIAL_KEYS } from "../lib/testimonials";
import { TypewriterTitle } from "./TypewriterTitle";

interface FloatingIcon {
	alt: string;
	className: string;
	delay: string;
	duration: string;
	src: string;
}

const FLOATING_ICONS: FloatingIcon[] = [
	{
		alt: "KOL avatar",
		className: "left-[7%] top-[45%] size-[72px]",
		delay: "-1s",
		duration: "9s",
		src: "/images/hero-floating/icon-1.png",
	},
	{
		alt: "KOL avatar",
		className: "left-[9%] top-[5%] size-16",
		delay: "-4s",
		duration: "11s",
		src: "/images/hero-floating/icon-2.png",
	},
	{
		alt: "Trading community",
		className: "right-[9%] top-[5%] size-16",
		delay: "-2.5s",
		duration: "10s",
		src: "/images/hero-floating/icon-3.png",
	},
	{
		alt: "KOL channel",
		className: "right-[7%] top-[46%] size-[68px]",
		delay: "-5.5s",
		duration: "12s",
		src: "/images/hero-floating/icon-4.png",
	},
	{
		alt: "Discord",
		className: "left-[16%] top-[78%] size-[60px]",
		delay: "-7s",
		duration: "10.5s",
		src: "/images/hero-floating/icon-5.png",
	},
	{
		alt: "Telegram",
		className: "right-[16%] top-[78%] size-[60px]",
		delay: "-3.5s",
		duration: "9.5s",
		src: "/images/hero-floating/icon-6.png",
	},
];

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
			<FloatingHeroIcons />
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

				<MacHeroShowcase imageAlt={t("home.hero.imageAlt")} />
			</div>
		</div>
	);
}

function MacHeroShowcase({ imageAlt }: { imageAlt: string }) {
	const containerRef = useRef<HTMLDivElement>(null);
	const prefersReducedMotion = useReducedMotion();
	const { scrollYProgress } = useScroll({
		target: containerRef,
		offset: ["start end", "end start"],
	});
	const rawRotateX = useTransform(
		scrollYProgress,
		[0, 0.28, 0.52, 1],
		prefersReducedMotion ? [0, 0, 0, 0] : [2.5, 1, 0, 0],
	);
	const rawScale = useTransform(
		scrollYProgress,
		[0, 0.28, 0.52, 1],
		prefersReducedMotion ? [1, 1, 1, 1] : [0.97, 0.995, 1, 1],
	);
	const rawTranslateY = useTransform(
		scrollYProgress,
		[0, 0.28, 0.52, 1],
		prefersReducedMotion ? [0, 0, 0, 0] : [6, 3, 0, 0],
	);
	const rawBaseTranslateY = useTransform(
		scrollYProgress,
		[0, 0.28, 0.52, 1],
		prefersReducedMotion ? [0, 0, 0, 0] : [7, 3, 0, 0],
	);
	const gentleSpring = {
		damping: 34,
		mass: 1.08,
		stiffness: 48,
	};
	const rotateX = useSpring(rawRotateX, gentleSpring);
	const scale = useSpring(rawScale, gentleSpring);
	const translateY = useSpring(rawTranslateY, gentleSpring);
	const baseTranslateY = useSpring(rawBaseTranslateY, gentleSpring);

	return (
		<div
			id="hero-image-area"
			className="scroll-mt-20 mt-3 py-2 sm:min-h-[28rem] md:min-h-[34rem] md:py-5 lg:-mt-1 lg:min-h-[36rem] relative flex min-h-[26rem] items-start justify-center"
		>
			<div
				ref={containerRef}
				className="hero-mac-stage group max-w-6xl pt-8 md:pt-10 lg:pt-12 relative mx-auto w-full"
			>
				<div
					aria-hidden="true"
					className="hero-mac-backdrop inset-x-0 top-4 absolute mx-auto h-[76%] w-[92%] rounded-[32px]"
				/>

				<MacScreenCard
					rotateX={rotateX}
					scale={scale}
					translateY={translateY}
					imageAlt={imageAlt}
				/>

				<motion.div
					aria-hidden="true"
					style={{ y: baseTranslateY }}
					className="h-4 md:h-5 relative z-10 w-full"
				>
					<div className="hero-mac-base border-white/8 shadow-2xl shadow-black/45 top-0 sm:w-[calc(100%+2.75rem)] md:w-[calc(100%+3.5rem)] absolute left-1/2 h-full w-[calc(100%+2rem)] -translate-x-1/2 rounded-b-[999px] border bg-[linear-gradient(180deg,#24252a_0%,#121317_72%,#050506_100%)]">
						<div className="bottom-0 h-1 bg-black/40 blur-md absolute inset-x-[6%] rounded-full" />
					</div>
				</motion.div>
			</div>
		</div>
	);
}

function MacScreenCard({
	imageAlt,
	rotateX,
	scale,
	translateY,
}: {
	imageAlt: string;
	rotateX: MotionValue<number>;
	scale: MotionValue<number>;
	translateY: MotionValue<number>;
}) {
	return (
		<motion.div
			style={{
				rotateX,
				scale,
				y: translateY,
				transformPerspective: 1000,
				transformOrigin: "50% 50%",
				boxShadow:
					"0 0 0 1px rgba(255,255,255,.08), 0 18px 38px rgba(0,0,0,.32), 0 54px 70px rgba(0,0,0,.28), 0 132px 90px rgba(0,0,0,.18)",
			}}
			className="hero-mac-lid border-white/12 p-1.5 shadow-2xl shadow-black/45 ease-out group-hover:-translate-y-1 md:p-2 relative z-20 mx-auto rounded-[26px] border bg-[#0a0a0b] transition-transform duration-700"
		>
			<div className="border-white/10 overflow-hidden rounded-[20px] border bg-[#08090a]">
				<MacWindowChrome />

				<div className="relative aspect-[3024/1654] overflow-hidden bg-[#08090a]">
					<Image
						src={heroImage}
						alt={imageAlt}
						fill
						className="object-cover dark:hidden"
						priority
						sizes="(min-width: 1280px) 1152px, calc(100vw - 48px)"
					/>
					<Image
						src={heroImageDark}
						alt={imageAlt}
						fill
						className="hidden object-cover dark:block"
						priority
						sizes="(min-width: 1280px) 1152px, calc(100vw - 48px)"
					/>

					<div
						aria-hidden="true"
						className="inset-0 pointer-events-none absolute bg-[linear-gradient(115deg,rgba(255,255,255,0.14)_0%,rgba(255,255,255,0)_24%,rgba(255,255,255,0)_100%)] opacity-0 dark:opacity-70"
					/>
				</div>
			</div>
		</motion.div>
	);
}

function MacWindowChrome() {
	return (
		<div className="h-8 gap-2 border-white/10 px-3 text-white/70 md:h-10 md:px-4 flex items-center border-b bg-[#111214]/95">
			<div className="gap-1.5 flex shrink-0 items-center">
				<span className="size-2.5 rounded-full bg-[#ff5f57]" />
				<span className="size-2.5 rounded-full bg-[#ffbd2e]" />
				<span className="size-2.5 rounded-full bg-[#28c840]" />
			</div>
			<div className="ml-1 h-6 min-w-0 max-w-36 gap-2 bg-white/7 px-3 sm:flex hidden items-center rounded-t-lg text-[11px]">
				<Image
					src="/images/brand/signalfast-logo-mark.png"
					alt=""
					width={16}
					height={16}
					className="size-4"
				/>
				<span className="font-medium text-white/80 truncate">SignalFast</span>
			</div>
			<div className="h-5 min-w-0 border-white/7 bg-black/25 px-3 text-white/42 shadow-inner shadow-black/30 sm:text-[11px] mx-auto flex max-w-[520px] flex-[0.62] items-center justify-center rounded-full border text-[10px]">
				<span className="truncate">signalfast.localhost:4101</span>
			</div>
			<div className="gap-2 md:flex hidden shrink-0 items-center">
				<span className="size-1.5 bg-white/35 rounded-full" />
				<span className="size-1.5 bg-white/35 rounded-full" />
				<span className="size-1.5 bg-white/35 rounded-full" />
			</div>
		</div>
	);
}

function FloatingHeroIcons() {
	return (
		<div
			aria-hidden="true"
			className="inset-x-0 top-8 lg:block pointer-events-none absolute z-10 mx-auto hidden h-[430px] max-w-[1800px]"
		>
			{FLOATING_ICONS.map((icon) => (
				<div key={icon.src} className={`absolute ${icon.className}`}>
					<div
						className="hero-floating-icon border-white/20 p-1 shadow-2xl backdrop-blur-md dark:border-white/10 dark:bg-white/8 dark:shadow-black/40 relative size-full overflow-hidden rounded-2xl border bg-background/35 opacity-55 shadow-primary/10 dark:opacity-45"
						style={{
							animationDelay: icon.delay,
							animationDuration: icon.duration,
						}}
					>
						<Image
							src={icon.src}
							alt={icon.alt}
							width={96}
							height={96}
							className="size-full rounded-xl object-cover saturate-90"
						/>
					</div>
				</div>
			))}
		</div>
	);
}
