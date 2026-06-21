import type { StoredSignal } from "./signal-types";

type SignalListener = (signal: StoredSignal) => void;

const listeners = new Set<SignalListener>();

export function subscribeToSignalEvents(listener: SignalListener) {
	listeners.add(listener);

	return () => {
		listeners.delete(listener);
	};
}

export function publishSignalEvent(signal: StoredSignal) {
	for (const listener of listeners) {
		listener(signal);
	}
}
