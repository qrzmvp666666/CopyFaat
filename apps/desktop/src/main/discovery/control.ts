/** Pause at an asynchronous boundary, before the next native desktop operation. */
export function createDiscoveryControl(onPaused: () => void, onResume: () => void) {
	let requested = false;
	let release: (() => void) | undefined;
	return {
		pause() {
			requested = true;
		},
		resume() {
			if (!requested) return;
			onResume();
			requested = false;
			release?.();
			release = undefined;
		},
		async checkpoint() {
			if (!requested) return;
			await new Promise<void>((resolve) => {
				release = resolve;
				onPaused();
			});
		},
	};
}
