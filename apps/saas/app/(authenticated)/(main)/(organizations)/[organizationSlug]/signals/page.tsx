import { SignalsWorkspace } from "@signals/components/SignalsWorkspace";
import { getCurrentSignalsAccess, SIGNALS_ACCESS } from "@signals/lib/access";

export default async function OrganizationSignalsPage() {
	const access = await getCurrentSignalsAccess();

	return <SignalsWorkspace isAuthenticated hasProAccess={access === SIGNALS_ACCESS.allowed} />;
}
