"use client";

import { useSession } from "@auth/hooks/use-session";
import { SignalsMobilePaywall } from "@signals/components/SignalsMobilePaywall";

interface PricingTableProps {
	className?: string;
	onCheckoutStarted?: () => void;
	userId?: string;
	organizationId?: string;
	activePlanId?: string;
	showActivePlanInPricing?: boolean;
	planIds?: readonly string[];
	initialPeriod?: "year" | "week";
}

export function PricingTable({ className, onCheckoutStarted, initialPeriod }: PricingTableProps) {
	const { user } = useSession();
	return (
		<div className={className}>
			<SignalsMobilePaywall
				open
				embedded
				isAuthenticated={Boolean(user)}
				onClose={() => {}}
				initialPeriod={initialPeriod}
				onCheckoutStarted={onCheckoutStarted}
			/>
		</div>
	);
}
