import { afterEach, expect, it, vi } from "vitest";

const engine = vi.hoisted(() => ({
	prepare: vi.fn(() => ({ x: 100, y: 50, width: 1200, height: 800 })),
	resolveRegion: vi.fn(() => ({ x: 180, y: 100, width: 240, height: 700 })),
	close: vi.fn(),
}));
const scan = vi.hoisted(() => vi.fn(async () => ({ channels: [] })));
vi.mock("../src/main/discovery/native", () => ({ createNativeDesktop: () => engine }));
vi.mock("../src/main/discovery/scan", () => ({ scanDiscordChannels: scan }));
const parentPortDescriptor = Object.getOwnPropertyDescriptor(process, "parentPort");

afterEach(() => {
	vi.useRealTimers();
	vi.clearAllMocks();
	if (parentPortDescriptor) Object.defineProperty(process, "parentPort", parentPortDescriptor);
	else Reflect.deleteProperty(process, "parentPort");
});

it("scans the automatically resolved sidebar without selection coordinates", async () => {
	vi.useFakeTimers();
	let receive: (message: { data: { type: string } }) => Promise<void> = async () => {};
	const postMessage = vi.fn();
	Object.defineProperty(process, "parentPort", {
		configurable: true,
		value: {
			postMessage,
			on: (_event: string, listener: typeof receive) => {
				receive = listener;
			},
		},
	});
	await import("../src/main/discovery/worker");
	await receive({ data: { type: "prepare" } });
	const pending = receive({ data: { type: "scan" } });
	await vi.advanceTimersByTimeAsync(3000);
	await pending;
	expect(engine.resolveRegion).toHaveBeenCalledWith();
	expect(scan).toHaveBeenCalledWith(
		engine,
		{ x: 180, y: 100, width: 240, height: 700 },
		expect.any(Function),
		{ checkpoint: expect.any(Function), onSnapshot: expect.any(Function) },
	);
	expect(postMessage).toHaveBeenCalledWith({ type: "result", result: { channels: [] } });
	expect(engine.close).toHaveBeenCalledOnce();
});
