"use client";

import { useLocale } from "next-intl";
import { useEffect, useState } from "react";

import { getTypewriterData } from "../lib/typewriter-features";

const TYPE_SPEED = 80;
const DELETE_SPEED = 40;
const PAUSE_AFTER_TYPE = 5000;
const PAUSE_AFTER_DELETE = 300;

export function TypewriterTitle() {
	const locale = useLocale();
	const { prefix, features } = getTypewriterData(locale);
	const initialTitle = features[0]?.title ?? "";

	const [displayed, setDisplayed] = useState(initialTitle);
	const [featureIndex, setFeatureIndex] = useState(0);
	const [isDeleting, setIsDeleting] = useState(false);
	const [subtitleVisible, setSubtitleVisible] = useState(true);

	const target = features[featureIndex]?.title ?? "";
	const subtitle = features[featureIndex]?.subtitle ?? "";
	const isAnimated = features.length > 1;
	const titleMinHeight = prefix ? "min-h-[2.5em] md:min-h-[2.4em]" : "min-h-[1.15em]";

	useEffect(() => {
		setDisplayed(initialTitle);
		setFeatureIndex(0);
		setIsDeleting(false);
		setSubtitleVisible(true);
	}, [initialTitle]);

	useEffect(() => {
		if (!isAnimated) {
			return;
		}

		if (!isDeleting && displayed === target) {
			const pause = setTimeout(() => setIsDeleting(true), PAUSE_AFTER_TYPE);
			return () => clearTimeout(pause);
		}

		if (isDeleting && displayed === "") {
			setSubtitleVisible(false);
			const pause = setTimeout(() => {
				setIsDeleting(false);
				setFeatureIndex((i) => (i + 1) % features.length);
				setSubtitleVisible(true);
			}, PAUSE_AFTER_DELETE);
			return () => clearTimeout(pause);
		}

		const delay = isDeleting ? DELETE_SPEED : TYPE_SPEED;
		const timer = setTimeout(() => {
			setDisplayed(
				isDeleting
					? target.slice(0, displayed.length - 1)
					: target.slice(0, displayed.length + 1),
			);
		}, delay);
		return () => clearTimeout(timer);
	}, [displayed, featureIndex, isAnimated, isDeleting, target, features.length]);

	return (
		<>
			<h1
				className={`font-medium text-4xl md:text-5xl lg:text-6xl xl:text-7xl leading-tight max-w-3xl mx-auto text-balance text-foreground ${titleMinHeight}`}
			>
				{prefix && <span className="block">{prefix}</span>}
				<span className="block text-primary">
					{displayed}
					{isAnimated && (
						<span className="ml-0.5 animate-pulse inline-block h-[0.85em] w-[2px] bg-primary align-middle" />
					)}
				</span>
			</h1>
			<p
				className={`mt-2 text-sm sm:text-lg max-w-3xl mx-auto text-balance text-foreground/60 transition-opacity duration-300 ${subtitleVisible ? "opacity-100" : "opacity-0"}`}
			>
				{subtitle}
			</p>
		</>
	);
}
