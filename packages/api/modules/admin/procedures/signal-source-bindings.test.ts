import { call } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ session: vi.fn(), list: vi.fn(), save: vi.fn() }));
vi.mock("@repo/auth", () => ({ auth: { api: { getSession: mocks.session } } }));
vi.mock("@repo/database", () => ({
	listSignalSourceBindings: mocks.list,
	saveSignalSourceBinding: mocks.save,
}));
import { listSourceBindings, saveSourceBinding } from "./signal-source-bindings";
const context = { headers: new Headers() };
const input = {
	platform: "discord",
	serverName: "server",
	channelName: "channel",
	categoryName: "",
	traderId: "existing",
	isActive: true,
};
beforeEach(() => {
	vi.resetAllMocks();
	mocks.session.mockResolvedValue({
		user: { id: "admin", role: "admin" },
		session: { id: "session" },
	});
});
describe("source binding administration", () => {
	it.each([null, { user: { id: "regular", role: "user" }, session: { id: "session" } }])(
		"blocks non-admin reads and writes",
		async (session) => {
			mocks.session.mockResolvedValue(session);
			const code = session ? "FORBIDDEN" : "UNAUTHORIZED";
			await expect(call(listSourceBindings, undefined, { context })).rejects.toMatchObject({
				code,
			});
			await expect(call(saveSourceBinding, input, { context })).rejects.toMatchObject({
				code,
			});
			expect(mocks.list).not.toHaveBeenCalled();
			expect(mocks.save).not.toHaveBeenCalled();
		},
	);
	it("lets administrators save an explicit existing KOL binding", async () => {
		mocks.save.mockResolvedValue({ id: "binding" });
		expect(await call(saveSourceBinding, input, { context })).toEqual({ id: "binding" });
		expect(mocks.save).toHaveBeenCalledWith(input);
	});
	it("reports duplicate source keys as a conflict", async () => {
		mocks.save.mockRejectedValue({ code: "P2002" });
		await expect(call(saveSourceBinding, input, { context })).rejects.toMatchObject({
			code: "CONFLICT",
		});
	});
	it("reports missing KOL or binding IDs without exposing database details", async () => {
		mocks.save.mockRejectedValue({ code: "P2003", message: "private connection" });
		await expect(call(saveSourceBinding, input, { context })).rejects.toMatchObject({
			code: "NOT_FOUND",
			message: "Binding or KOL no longer exists.",
		});
	});
});
