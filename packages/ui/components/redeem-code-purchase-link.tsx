"use client";

import { CopyIcon, ShoppingBagIcon } from "lucide-react";

import { cn } from "../lib";
import { Button } from "./button";
import { toastError, toastSuccess } from "./toast";

interface RedeemCodePurchaseLinkProps {
	ariaLabel: string;
	className?: string;
	copyErrorDescription: string;
	copyErrorTitle: string;
	copiedDescription: string;
	copiedTitle: string;
	label: string;
	url: string;
}

async function copyTextToClipboard(text: string) {
	if (navigator.clipboard?.writeText) {
		await navigator.clipboard.writeText(text);
		return;
	}

	const textarea = document.createElement("textarea");
	textarea.value = text;
	textarea.setAttribute("readonly", "");
	textarea.style.position = "fixed";
	textarea.style.top = "-1000px";
	textarea.style.opacity = "0";
	document.body.appendChild(textarea);
	textarea.select();

	try {
		const copied = document.execCommand("copy");

		if (!copied) {
			throw new Error("Unable to copy redeem-code purchase link");
		}
	} finally {
		document.body.removeChild(textarea);
	}
}

export function RedeemCodePurchaseLink({
	ariaLabel,
	className,
	copyErrorDescription,
	copyErrorTitle,
	copiedDescription,
	copiedTitle,
	label,
	url,
}: RedeemCodePurchaseLinkProps) {
	const onCopyLink = async () => {
		try {
			await copyTextToClipboard(url);
			toastSuccess(copiedTitle, copiedDescription);
		} catch {
			toastError(copyErrorTitle, copyErrorDescription);
		}
	};

	return (
		<Button
			type="button"
			variant="secondary"
			className={cn(
				"h-9 gap-2 text-sm w-full justify-center border border-primary/15 bg-primary/[0.06] text-foreground/85 hover:bg-primary/[0.1]",
				className,
			)}
			onClick={() => void onCopyLink()}
			aria-label={ariaLabel}
			data-test="xianyu-redeem-copy"
		>
			<ShoppingBagIcon className="size-4 text-primary" aria-hidden="true" />
			<span className="truncate">{label}</span>
			<CopyIcon className="size-3.5 text-foreground/50" aria-hidden="true" />
		</Button>
	);
}
