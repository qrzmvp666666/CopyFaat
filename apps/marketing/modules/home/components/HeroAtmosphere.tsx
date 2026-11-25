"use client";

import { useEffect, useRef } from "react";

interface Ripple {
	x: number;
	y: number;
	startedAt: number;
}

export function HeroAtmosphere() {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		const hero = canvas?.closest("section");
		const context = canvas?.getContext("2d");
		if (!canvas || !hero || !context) return;

		const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
		const pointer = window.matchMedia("(pointer: fine)");
		const ripples: Ripple[] = [];
		let width = 0;
		let height = 0;
		let frame = 0;
		let lastRipple = -Infinity;
		let visible = true;

		function draw(now: number) {
			if (!context) return;
			context.clearRect(0, 0, width, height);
			context.font = '10px "Departure Mono", monospace';
			context.textAlign = "center";
			for (let index = ripples.length - 1; index >= 0; index--) {
				if (now - ripples[index].startedAt > 1800) ripples.splice(index, 1);
			}
			for (let row = 0; row * 24 < height; row++) {
				for (let column = 0; column * 24 < width; column++) {
					const seed = Math.abs(Math.sin(row * 127.1 + column * 311.7) * 43758.5453) % 1;
					if (seed < 0.23) continue;
					const x = column * 24 + 12;
					const y = row * 24 + 12;
					let offsetX = 0;
					let offsetY = 0;
					let energy = 0;
					for (const ripple of ripples) {
						const dx = x - ripple.x;
						const dy = y - ripple.y;
						const distance = Math.hypot(dx, dy);
						const age = (now - ripple.startedAt) / 1000;
						const envelope =
							Math.exp(-Math.pow((distance - age * 180) / 65, 2)) *
							Math.exp(-age * 2);
						const displacement = Math.sin(distance / 22 - age * 12) * envelope * 13;
						offsetX += (dx / (distance || 1)) * displacement;
						offsetY += (dy / (distance || 1)) * displacement;
						energy += envelope;
					}
					const fade = Math.min(1, y / 80) * Math.max(0, 1 - Math.pow(y / height, 3));
					context.fillStyle = `rgba(190, 200, 194, ${Math.min(0.5, (0.055 + seed * 0.11 + energy * 0.16) * fade)})`;
					context.fillText(seed > 0.55 ? "1" : "0", x + offsetX, y + offsetY);
				}
			}
			if (ripples.length && visible && !motion.matches) frame = requestAnimationFrame(draw);
			else frame = 0;
		}

		function resize() {
			if (!canvas || !hero || !context) return;
			width = hero.clientWidth;
			height = hero.clientHeight;
			const scale = Math.min(window.devicePixelRatio || 1, 2);
			canvas.width = width * scale;
			canvas.height = height * scale;
			context.setTransform(scale, 0, 0, scale, 0, 0);
			if (!frame) draw(performance.now());
		}

		function handlePointerMove(event: PointerEvent) {
			if (!hero || motion.matches || !pointer.matches || !visible) return;
			const now = performance.now();
			if (now - lastRipple < 70) return;
			const bounds = hero.getBoundingClientRect();
			ripples.push({
				x: event.clientX - bounds.left,
				y: event.clientY - bounds.top,
				startedAt: now,
			});
			if (ripples.length > 18) ripples.shift();
			lastRipple = now;
			if (!frame) frame = requestAnimationFrame(draw);
		}

		function resetMotion() {
			cancelAnimationFrame(frame);
			frame = 0;
			ripples.length = 0;
			draw(performance.now());
		}

		const resizeObserver = new ResizeObserver(resize);
		const intersectionObserver = new IntersectionObserver(([entry]) => {
			visible = entry.isIntersecting;
			if (!visible) resetMotion();
		});
		resizeObserver.observe(hero);
		intersectionObserver.observe(hero);
		hero.addEventListener("pointermove", handlePointerMove);
		motion.addEventListener("change", resetMotion);
		resize();
		return () => {
			cancelAnimationFrame(frame);
			resizeObserver.disconnect();
			intersectionObserver.disconnect();
			hero.removeEventListener("pointermove", handlePointerMove);
			motion.removeEventListener("change", resetMotion);
		};
	}, []);

	return (
		<div className="island-hero-atmosphere" aria-hidden="true">
			<div className="island-hero-light" />
			<canvas ref={canvasRef} className="island-hero-digits" />
		</div>
	);
}
