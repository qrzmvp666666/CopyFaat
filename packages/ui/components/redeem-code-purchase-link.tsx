"use client";

import { QrCodeIcon, ShoppingBagIcon } from "lucide-react";

import { cn } from "../lib";
import { Button } from "./button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "./dialog";

interface RedeemCodePurchaseLinkProps {
	ariaLabel: string;
	className?: string;
	description: string;
	imageAlt: string;
	imageSrc?: string;
	label: string;
	title: string;
}

export function RedeemCodePurchaseLink({
	ariaLabel,
	className,
	description,
	imageAlt,
	imageSrc = "/images/redeem-code-purchase.png",
	label,
	title,
}: RedeemCodePurchaseLinkProps) {
	return (
		<Dialog>
			<DialogTrigger asChild>
				<Button
					type="button"
					variant="secondary"
					className={cn(
						"h-9 gap-2 text-sm w-full justify-center border border-primary/15 bg-primary/[0.06] text-foreground/85 hover:bg-primary/[0.1]",
						className,
					)}
					aria-label={ariaLabel}
					data-test="redeem-code-purchase-qrcode"
				>
					<ShoppingBagIcon className="size-4 text-primary" aria-hidden="true" />
					<span className="truncate">{label}</span>
					<QrCodeIcon className="size-3.5 text-foreground/50" aria-hidden="true" />
				</Button>
			</DialogTrigger>
			<DialogContent className="gap-4 p-4 sm:p-5 w-[min(calc(100vw_-_32px),420px)] max-w-[420px] overflow-hidden">
				<DialogHeader className="pr-8 text-left">
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>
				<div className="overflow-hidden rounded-md border bg-muted/20">
					<img
						src={imageSrc}
						alt={imageAlt}
						width={754}
						height={1190}
						className="block h-auto max-h-[min(72dvh,660px)] w-full object-contain"
					/>
				</div>
			</DialogContent>
		</Dialog>
	);
}
