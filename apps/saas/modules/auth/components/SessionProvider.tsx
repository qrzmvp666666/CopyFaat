"use client";
import { sessionQueryKey, useSessionQuery } from "@auth/lib/api";
import { authClient } from "@repo/auth/client";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, type ReactNode } from "react";

import { useSession } from "../hooks/use-session";
import { SessionContext } from "../lib/session-context";
import { trackPendingTaliviaSignup } from "../lib/talivia";

export function SessionProvider({ children }: { children: ReactNode }) {
	const queryClient = useQueryClient();

	const { data: session, isFetched } = useSessionQuery();

	return (
		<SessionContext.Provider
			value={{
				loaded: isFetched,
				session: session?.session ?? null,
				user: session?.user ?? null,
				reloadSession: async () => {
					const { data: newSession, error } = await authClient.getSession({
						query: {
							disableCookieCache: true,
						},
					});

					if (error) {
						throw new Error(error.message || "Failed to fetch session");
					}

					queryClient.setQueryData(sessionQueryKey, () => newSession);
				},
			}}
		>
			<TaliviaSignupTracker />
			{children}
		</SessionContext.Provider>
	);
}

function TaliviaSignupTracker() {
	const { user, loaded } = useSession();

	useEffect(() => {
		if (loaded && user) {
			trackPendingTaliviaSignup(user.createdAt);
		}
	}, [loaded, user]);

	useEffect(() => {
		if (loaded && user?.emailVerified) {
			void fetch("/api/payments/claim", { method: "POST" })
				.then((response) => (response.ok ? response.json() : null))
				.then((result: { claimed?: number } | null) => {
					if (result && result.claimed && result.claimed > 0) {
						window.location.reload();
					}
				})
				.catch(() => undefined);
		}
	}, [loaded, user?.email, user?.emailVerified]);

	return null;
}
