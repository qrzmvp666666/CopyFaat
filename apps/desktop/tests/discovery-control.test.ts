import { expect, it, vi } from "vitest";

import { createDiscoveryControl } from "../src/main/discovery/control";

it("pauses before the next operation, acknowledges once, and continues without clearing results", async () => {
	const paused = vi.fn();
	const prepare = vi.fn();
	const control = createDiscoveryControl(paused, prepare);
	await control.checkpoint();
	expect(paused).not.toHaveBeenCalled();
	control.pause();
	control.pause();
	let advanced = false;
	const checkpoint = control.checkpoint().then(() => {
		advanced = true;
	});
	await Promise.resolve();
	expect(advanced).toBe(false);
	expect(paused).toHaveBeenCalledOnce();
	control.resume();
	await checkpoint;
	expect(advanced).toBe(true);
	expect(prepare).toHaveBeenCalledOnce();
	await control.checkpoint();
	expect(paused).toHaveBeenCalledOnce();
	control.pause();
	const next = control.checkpoint();
	expect(paused).toHaveBeenCalledTimes(2);
	control.resume();
	await next;
});
