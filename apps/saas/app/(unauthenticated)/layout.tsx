import { SessionProvider } from "@auth/components/SessionProvider";
import { AuthWrapper } from "@shared/components/AuthWrapper";
import { MixpanelProvider } from "@shared/components/MixpanelProvider";
import type { PropsWithChildren } from "react";

export default async function AuthLayout({ children }: PropsWithChildren) {
	return (
		<SessionProvider>
			<MixpanelProvider>
				<AuthWrapper>{children}</AuthWrapper>
			</MixpanelProvider>
		</SessionProvider>
	);
}
