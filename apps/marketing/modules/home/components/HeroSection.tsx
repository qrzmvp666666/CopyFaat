"use client";

import { Button } from "@repo/ui/components/button";
import { ArrowRightIcon, MaximizeIcon, PlayIcon, StarIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

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
				getStarted: "立即开始",
				socialProof: "999+ 用户使用 SignalFast 构建策略",
			}
		: {
				new: "🎇 Happy New Year",
				badge: "2026 Special Offer",
				getStarted: "Get Started",
				socialProof: "999+ users build strategies with SignalFast",
			};

	return (
		<div className="relative max-w-full overflow-x-hidden bg-linear-to-t from-background via-primary/5 to-background">
			<FloatingHeroIcons />
			<div className="pt-0 pb-10 md:py-16 relative z-20 container flex flex-col text-center">
				<div className="mb-2 md:mb-4 flex justify-center">
					<div className="px-3 py-1 font-normal text-sm flex flex-wrap items-center justify-center rounded-full bg-muted p-px text-foreground">
						<span className="gap-2 font-semibold flex items-center rounded-full">
							{heroCopy.new}
						</span>
						<span className="ml-1 font-medium block">{heroCopy.badge}</span>
					</div>
				</div>

				<TypewriterTitle />

				<div className="mt-4 gap-2 flex items-center justify-center">
					<Button className="sm:w-auto w-full" size="lg" variant="primary" asChild>
						<a href="#pricing">
							{heroCopy.getStarted}
							<ArrowRightIcon className="ml-2 size-4" />
						</a>
					</Button>
				</div>

				{/* Social proof */}
				<div className="mt-7 gap-3 md:mt-6 sm:flex-row flex flex-col items-center justify-center">
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
					<div className="sm:text-left text-center">
						<div className="gap-0.5 sm:justify-start flex items-center justify-center">
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

				<HeroVideoShowcase imageAlt={t("home.hero.imageAlt")} />
			</div>
		</div>
	);
}

interface FullscreenVideoElement extends HTMLVideoElement {
	webkitEnterFullscreen?: () => void;
	webkitSupportsFullscreen?: boolean;
}

function HeroVideoShowcase({ imageAlt }: { imageAlt: string }) {
	const locale = useLocale();
	const videoRef = useRef<FullscreenVideoElement>(null);
	const [hasPlayed, setHasPlayed] = useState(false);
	const [isPlaying, setIsPlaying] = useState(false);
	const [hasError, setHasError] = useState(false);
	const [isFullscreen, setIsFullscreen] = useState(false);

	useEffect(() => {
		const video = videoRef.current;
		if (!video) {
			return;
		}

		function syncFullscreen() {
			setIsFullscreen(document.fullscreenElement === video);
		}
		function enterNativeFullscreen() {
			setIsFullscreen(true);
		}
		function exitNativeFullscreen() {
			setIsFullscreen(false);
		}

		video.muted = true;
		video.defaultMuted = true;
		void video.play().catch(() => {});
		document.addEventListener("fullscreenchange", syncFullscreen);
		video.addEventListener("webkitbeginfullscreen", enterNativeFullscreen);
		video.addEventListener("webkitendfullscreen", exitNativeFullscreen);
		return () => {
			document.removeEventListener("fullscreenchange", syncFullscreen);
			video.removeEventListener("webkitbeginfullscreen", enterNativeFullscreen);
			video.removeEventListener("webkitendfullscreen", exitNativeFullscreen);
		};
	}, []);

	function openFullscreen() {
		const video = videoRef.current;
		if (!video) {
			return;
		}

		// Request fullscreen within the tap gesture, before awaiting playback.
		try {
			if (video.webkitEnterFullscreen && video.webkitSupportsFullscreen) {
				video.webkitEnterFullscreen();
			} else if (video.requestFullscreen) {
				void video.requestFullscreen().catch(() => {});
			}
		} catch {
			// Embedded browsers can disallow fullscreen; inline playback still works.
		}
		void video.play().catch(() => setIsPlaying(false));
	}

	return (
		<div
			id="hero-image-area"
			className="mb-3 md:order-last md:mt-8 md:mb-0 md:py-2 relative order-first flex w-full justify-center"
		>
			<div className="md:h-[480px] relative aspect-[480/1000] h-[clamp(200px,calc(100svh_-_360px),480px)] shrink-0">
				<video
					ref={videoRef}
					aria-label={imageAlt}
					autoPlay
					loop
					muted
					playsInline
					controls={isFullscreen}
					preload="auto"
					onCanPlay={() => {
						if (!hasPlayed) {
							void videoRef.current?.play().catch(() => {});
						}
					}}
					poster="/images/hero-video-poster.jpg"
					onPlaying={() => {
						setHasPlayed(true);
						setIsPlaying(true);
					}}
					onPause={() => setIsPlaying(false)}
					onError={() => setHasError(true)}
					className="size-full object-contain"
				>
					<source src="/videos/hero-preview.mp4" type="video/mp4" />
				</video>
				{(!hasPlayed || hasError) && (
					<Image
						src="/images/hero-video-poster.jpg"
						alt={imageAlt}
						fill
						priority
						sizes="230px"
						className="pointer-events-none object-contain"
					/>
				)}
				{!isFullscreen && !hasError && (
					<button
						type="button"
						onClick={openFullscreen}
						aria-label={
							locale === "zh" ? "全屏播放演示视频" : "Play demo video fullscreen"
						}
						className={`inset-0 focus-visible:outline-white absolute flex cursor-pointer focus-visible:outline-2 ${isPlaying ? "p-3 items-end justify-end" : "items-center justify-center"}`}
					>
						<span className="size-12 border-white/30 bg-black/70 text-white shadow-lg flex items-center justify-center rounded-full border">
							{isPlaying ? (
								<MaximizeIcon className="size-5" aria-hidden="true" />
							) : (
								<PlayIcon
									className="ml-0.5 size-5 fill-current"
									aria-hidden="true"
								/>
							)}
						</span>
					</button>
				)}
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
