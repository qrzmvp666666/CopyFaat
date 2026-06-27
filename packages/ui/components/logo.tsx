import { cn } from "../lib";

export function Logo({ withLabel = true, className }: { className?: string; withLabel?: boolean }) {
	return (
		<span
			className={cn(
				"font-semibold flex items-center leading-none text-foreground",
				className,
			)}
		>
			<img
				src="/images/brand/signalfast-logo-mark.png"
				alt={withLabel ? "" : "SignalFast"}
				aria-hidden={withLabel}
				className="size-10 object-contain"
			/>
			{withLabel && <span className="ml-3 text-lg md:block hidden">SignalFast</span>}
		</span>
	);
}
