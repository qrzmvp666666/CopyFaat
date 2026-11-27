/** Pause at an asynchronous boundary, before the next native desktop operation. */
export function createDiscoveryControl(onPaused: () => void, onResume: () => void) {
	let requested = false;
	let cancelled = false;
	let release: (() => void) | undefined;
	return {
		pause() {
			requested = true;
		},
		resume() {
			if (!requested) return;
			onResume();
			requested = false;
			cancelled = false;
			release?.();
			release = undefined;
		},
		cancel() {
			cancelled = true;
			requested = false;
			release?.();
			release = undefined;
		},
		async checkpoint() {
			if (cancelled) throw new Error("频道识别已退出。");
			if (!requested) return;
			await new Promise<void>((resolve) => {
				release = resolve;
				onPaused();
			});
			if (cancelled) throw new Error("频道识别已退出。");
		},
	};
}
