import { cn } from "@repo/ui";
import Image from "next/image";

interface BrandLogoProps {
	withLabel?: boolean;
	className?: string;
}

export function BrandLogo({ withLabel = true, className }: BrandLogoProps) {
	return (
		<span className={cn("gap-2.5 inline-flex items-center text-foreground", className)}>
			<Image
				src="/images/brand/copyfast-logo.svg"
				alt={withLabel ? "" : "CopyFast"}
				width={30}
				height={30}
			/>
			{withLabel && <span className="font-mono text-xs tracking-widest">COPYFAST</span>}
		</span>
	);
}
