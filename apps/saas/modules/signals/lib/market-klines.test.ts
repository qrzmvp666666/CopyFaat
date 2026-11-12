import { afterEach, describe, expect, it, vi } from "vitest";

import { getMarketKlines } from "./market-klines";

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("USD-M Futures candles", () => {
	it("requests contract candles and converts prices and timestamps", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValue(
				Response.json([[1794441600000, "90000", "91000", "89000", "90500"]]),
			);
		vi.stubGlobal("fetch", fetchMock);
		const response = await getMarketKlines(
			new Request(
				"https://app.signalfast.cn/api/signals/klines?symbol=BTCUSDT&interval=4h&limit=100",
			),
		);
		const url = fetchMock.mock.calls[0][0] as URL;
		expect(url.origin + url.pathname).toBe("https://fapi.binance.com/fapi/v1/klines");
		expect(Object.fromEntries(url.searchParams)).toEqual({
			symbol: "BTCUSDT",
			interval: "4h",
			limit: "100",
		});
		expect(response.status).toBe(200);
		expect((await response.json()).klines).toEqual([
			{ time: 1794441600, open: 90000, high: 91000, low: 89000, close: 90500 },
		]);
	});

	it("returns unavailable for an unknown futures contract without spot fallback", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValue(Response.json({ code: -1121 }, { status: 400 }));
		vi.stubGlobal("fetch", fetchMock);
		const response = await getMarketKlines(
			new Request("https://app.signalfast.cn/api/signals/klines?symbol=UNKNOWNUSDT"),
		);
		expect(response.status).toBe(404);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});
});
