import "server-only";
import { getSession } from "@auth/lib/server";
import { getPurchasesByUserId, getUnexpiredEntitlementGrantsByUserId } from "@repo/database";
import { hasPaidSignalsAccess } from "@repo/payments/lib/helper";
import { redirect } from "next/navigation";

export const SIGNALS_ACCESS = {
	allowed: "allowed",
	unauthenticated: "unauthenticated",
	forbidden: "forbidden",
} as const;

export type SignalsAccess = (typeof SIGNALS_ACCESS)[keyof typeof SIGNALS_ACCESS];

export async function getCurrentSignalsAccess(): Promise<SignalsAccess> {
	const session = await getSession();

	if (!session) {
		return SIGNALS_ACCESS.unauthenticated;
	}

	const [purchases, entitlementGrants] = await Promise.all([
		getPurchasesByUserId(session.user.id),
		getUnexpiredEntitlementGrantsByUserId(session.user.id),
	]);

	return hasPaidSignalsAccess(purchases, entitlementGrants)
		? SIGNALS_ACCESS.allowed
		: SIGNALS_ACCESS.forbidden;
}

export async function requireCurrentSignalsAccess() {
	const access = await getCurrentSignalsAccess();

	if (access === SIGNALS_ACCESS.allowed) {
		return;
	}

	redirect("/choose-plan");
}
