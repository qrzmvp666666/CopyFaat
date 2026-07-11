import * as Sentry from "@sentry/nextjs";

Sentry.init({
	dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
	initialScope: {
		tags: { app: "docs" },
	},
	tracesSampleRate: 0.02,
});

// This hook is available through Sentry's browser export.
// oxlint-disable-next-line import/namespace
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
