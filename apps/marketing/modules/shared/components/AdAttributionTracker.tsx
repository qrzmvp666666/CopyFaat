"use client";
import { captureAdAttribution } from "@repo/utils/lib/checkout-attribution";
import { useEffect } from "react";
export function AdAttributionTracker() {
	useEffect(() => {
		captureAdAttribution();
	}, []);
	return null;
}
