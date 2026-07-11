import { SignalsPaywall } from "@signals/components/SignalsPaywall";
import { SignalsWorkspace } from "@signals/components/SignalsWorkspace";
import { getCurrentSignalsAccess, SIGNALS_ACCESS } from "@signals/lib/access";

export default async function SignalsPage() {
	const access = await getCurrentSignalsAccess();

	if (access !== SIGNALS_ACCESS.allowed) {
		return <SignalsPaywall />;
	}

	return <SignalsWorkspace />;
}
