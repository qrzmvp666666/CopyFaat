import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ find: vi.fn() }));
vi.mock("@repo/database", () => ({
	findSignalSourceBindings: mocks.find,
	normalizeSignalSourceName: (value: string) => value.normalize("NFKC").trim().toLowerCase(),
}));
import { resolveSignalSource } from "./signal-source-resolver";
const source = {
	name: "三马哥合约",
	platform: "discord",
	serverName: "币圈策略搬运工",
	channelName: "三马哥合约",
};
const trader = {
	id: "existing-kol",
	externalId: "signalfast-guide:san-ma-ge",
	name: "三马哥",
	isActive: true,
};
beforeEach(() => vi.resetAllMocks());
describe("named source resolution", () => {
	it("returns the existing KOL without relying on source.id or source.name", async () => {
		mocks.find.mockResolvedValue([{ isActive: true, trader }]);
		expect(
			await resolveSignalSource({
				...source,
				id: "untrusted-id",
				name: "channel display name",
			}),
		).toEqual(trader);
	});
	it("keeps legacy non-Discord payloads compatible", async () => {
		expect(await resolveSignalSource({ name: "Legacy" })).toBeNull();
		expect(mocks.find).not.toHaveBeenCalled();
	});
	it.each([
		{ name: "KOL", platform: "discord" },
		{ name: "KOL", serverName: "server" },
	])("rejects incomplete named sources", async (input) => {
		await expect(resolveSignalSource(input)).rejects.toMatchObject({
			code: "SOURCE_INCOMPLETE",
		});
		expect(mocks.find).not.toHaveBeenCalled();
	});
	it("does not fall back to creating a trader for unbound sources", async () => {
		mocks.find.mockResolvedValue([]);
		await expect(resolveSignalSource(source)).rejects.toMatchObject({ code: "SOURCE_UNBOUND" });
	});
	it("requires a category when channel names are ambiguous, including disabled matches", async () => {
		mocks.find.mockResolvedValue([
			{ isActive: true, trader },
			{ isActive: false, trader },
		]);
		await expect(resolveSignalSource(source)).rejects.toMatchObject({
			code: "SOURCE_AMBIGUOUS",
		});
	});
	it.each([
		{ isActive: false, trader },
		{ isActive: true, trader: { ...trader, isActive: false } },
	])("rejects disabled bindings and KOLs", async (binding) => {
		mocks.find.mockResolvedValue([binding]);
		await expect(resolveSignalSource(source)).rejects.toMatchObject({
			code: "SOURCE_DISABLED",
		});
	});
	it("passes category evidence to the exact lookup", async () => {
		mocks.find.mockResolvedValue([{ isActive: true, trader }]);
		await resolveSignalSource({ ...source, categoryName: "国内博主" });
		expect(mocks.find).toHaveBeenCalledWith(
			expect.objectContaining({ categoryName: "国内博主" }),
		);
	});
});
