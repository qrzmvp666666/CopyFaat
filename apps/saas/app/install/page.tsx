import { PwaInstallPrompt } from "@shared/components/PwaInstallPrompt";
import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Install SignalFast",
	robots: { index: false, follow: false },
};

export default function InstallPage() {
	return <PwaInstallPrompt />;
}
