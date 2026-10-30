import { SessionProvider } from "@auth/components/SessionProvider";
import { ActiveOrganizationProvider } from "@organizations/components/ActiveOrganizationProvider";
import { AppWrapper } from "@shared/components/AppWrapper";
import type { PropsWithChildren } from "react";

export default function SignalsLayout({ children }: PropsWithChildren) {
	return (
		<SessionProvider>
			<ActiveOrganizationProvider>
				<AppWrapper>{children}</AppWrapper>
			</ActiveOrganizationProvider>
		</SessionProvider>
	);
}
