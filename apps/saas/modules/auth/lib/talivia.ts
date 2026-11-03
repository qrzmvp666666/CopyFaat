const PENDING_SIGNUP_KEY = "talivia:pending-signup";
const PENDING_SIGNUP_MAX_AGE = 15 * 60 * 1000;
const PENDING_CHECKOUT_KEY = "talivia:pending-checkout";
const pendingTaliviaEvents: string[] = [];
let isTaliviaReadyListenerRegistered = false;

declare global {
	interface Window {
		talivia?: {
			track: (eventName: string) => void;
		};
	}
}

export function trackTaliviaSignup() {
	trackTaliviaEvent("signup");
}

export function trackTaliviaEvent(eventName: string) {
	if (typeof window === "undefined") {
		return;
	}

	if (!window.talivia) {
		pendingTaliviaEvents.push(eventName);
		if (!isTaliviaReadyListenerRegistered) {
			window.addEventListener("talivia:ready", flushPendingTaliviaEvents);
			isTaliviaReadyListenerRegistered = true;
		}
		return;
	}

	try {
		window.talivia.track(eventName);
	} catch {
		// Analytics failures must not interrupt signup or checkout flows.
	}
}

function flushPendingTaliviaEvents() {
	if (!window.talivia || pendingTaliviaEvents.length === 0) {
		return;
	}

	for (const eventName of pendingTaliviaEvents.splice(0)) {
		try {
			window.talivia.track(eventName);
		} catch {
			// Analytics failures must not interrupt signup or checkout flows.
		}
	}
}

export function markTaliviaCheckoutPending() {
	try {
		window.localStorage.setItem(PENDING_CHECKOUT_KEY, "true");
	} catch {
		// Checkout should continue when browser storage is unavailable.
	}
}

export function trackTaliviaCheckoutStarted() {
	markTaliviaCheckoutPending();
	trackTaliviaEvent("Start Checkout");
}

export function trackTaliviaPaymentCompleted() {
	try {
		if (window.localStorage.getItem(PENDING_CHECKOUT_KEY) !== "true") {
			return;
		}

		window.localStorage.removeItem(PENDING_CHECKOUT_KEY);
	} catch {
		return;
	}

	trackTaliviaEvent("Payment Success");
}

export function markTaliviaSignupPending() {
	window.localStorage.setItem(PENDING_SIGNUP_KEY, String(Date.now()));
}

export function clearTaliviaSignupPending() {
	window.localStorage.removeItem(PENDING_SIGNUP_KEY);
}

export function trackPendingTaliviaSignup(userCreatedAt: Date | string) {
	const signupStartedAt = Number(window.localStorage.getItem(PENDING_SIGNUP_KEY));

	if (!Number.isFinite(signupStartedAt) || signupStartedAt <= 0) {
		return;
	}

	clearTaliviaSignupPending();

	const signupAge = Date.now() - signupStartedAt;
	const userCreationTime = new Date(userCreatedAt).getTime();

	if (
		signupAge <= PENDING_SIGNUP_MAX_AGE &&
		userCreationTime >= signupStartedAt &&
		Number.isFinite(userCreationTime)
	) {
		trackTaliviaSignup();
	}
}
