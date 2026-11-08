import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
	vi.unstubAllEnvs();
	vi.resetModules();
});

describe("OAuth provider visibility", () => {
	it.each([
		["false", "false", []],
		["true", "false", ["google"]],
		["false", "true", ["github"]],
		["true", "true", ["google", "github"]],
	])("shows only configured providers (%s, %s)", async (google, github, expected) => {
		vi.stubEnv("NEXT_PUBLIC_AUTH_GOOGLE_ENABLED", google);
		vi.stubEnv("NEXT_PUBLIC_AUTH_GITHUB_ENABLED", github);
		const { visibleOAuthProviderIds } = await import("./oauth-providers");
		expect(visibleOAuthProviderIds).toEqual(expected);
	});
});
