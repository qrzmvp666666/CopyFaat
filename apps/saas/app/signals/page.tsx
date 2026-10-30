import { SignalsWorkspace } from "@signals/components/SignalsWorkspace";
import { getCurrentSignalsAccess, SIGNALS_ACCESS } from "@signals/lib/access";

export const dynamic = "force-dynamic";

export default async function SignalsPage() {
	let hasProAccess = false;
	let isAuthenticated = false;

	try {
		const access = await getCurrentSignalsAccess();
		isAuthenticated = access !== SIGNALS_ACCESS.unauthenticated;
		hasProAccess = access === SIGNALS_ACCESS.allowed;
	} catch {
		// If identity or entitlement cannot be verified, keep the paywall flow active.
	}

	return <SignalsWorkspace isAuthenticated={isAuthenticated} hasProAccess={hasProAccess} />;
}
