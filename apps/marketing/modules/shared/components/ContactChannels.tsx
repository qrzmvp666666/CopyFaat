import { ArrowRightIcon } from "lucide-react";
import Image from "next/image";

export interface ContactMethod {
	account: string;
	href: string;
	icon: "telegram" | "discord";
	label: string;
}

export const CONTACT_METHODS: ContactMethod[] = [
	{
		account: "CopyFast",
		href: "https://t.me/Michael_Qin",
		icon: "telegram",
		label: "电报",
	},
	{
		account: "CopyFast",
		href: "https://discord.gg/signalfast",
		icon: "discord",
		label: "Discord",
	},
];

interface ContactChannelsProps {
	className?: string;
	compact?: boolean;
}

export function ContactChannels({ className, compact = false }: ContactChannelsProps) {
	return (
		<div className={className ?? "island-contact-grid gap-4 md:grid-cols-2 grid"}>
			{CONTACT_METHODS.map((method) => (
				<a
					key={method.label}
					href={method.href}
					className={
						compact
							? "group min-h-16 gap-3 p-3 flex items-center rounded-xl border bg-background/40 text-left transition-colors hover:border-primary/40 hover:bg-secondary/30"
							: "island-contact-card group"
					}
					target={method.href.startsWith("http") ? "_blank" : undefined}
					rel={method.href.startsWith("http") ? "noopener noreferrer" : undefined}
				>
					<ContactIcon icon={method.icon} compact={compact} />
					<div className="min-w-0 flex-1">
						<h3
							className={
								compact
									? "font-semibold text-sm text-foreground"
									: "font-semibold text-base text-foreground"
							}
						>
							{method.label}
						</h3>
						<p
							className={
								compact
									? "mt-0.5 text-xs truncate text-muted-foreground"
									: "mt-1 text-sm truncate text-muted-foreground"
							}
						>
							{method.account}
						</p>
					</div>
					<ArrowRightIcon className="size-4 group-hover:translate-x-1 shrink-0 text-muted-foreground transition-transform group-hover:text-foreground" />
				</a>
			))}
		</div>
	);
}

function ContactIcon({ compact, icon }: { compact: boolean; icon: ContactMethod["icon"] }) {
	const tileClassName = compact ? "size-10 rounded-lg" : "size-14 sm:size-16 rounded-xl";

	if (icon === "telegram") {
		return (
			<span
				className={`${tileClassName} bg-white shadow-lg shadow-black/10 flex shrink-0 items-center justify-center`}
			>
				<Image
					src="/images/contact/telegram-icon.png"
					alt="Telegram"
					width={225}
					height={225}
					className={
						compact ? "size-7 object-contain" : "size-10 sm:size-11 object-contain"
					}
				/>
			</span>
		);
	}

	return (
		<span
			className={`${tileClassName} bg-white shadow-lg shadow-black/10 flex shrink-0 items-center justify-center`}
		>
			<Image
				src="/images/contact/discord-icon.png"
				alt="Discord"
				width={225}
				height={225}
				className={compact ? "size-9 object-contain" : "size-12 sm:size-14 object-contain"}
			/>
		</span>
	);
}
