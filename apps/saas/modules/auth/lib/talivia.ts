const PENDING_SIGNUP_KEY = "talivia:pending-signup";
const PENDING_SIGNUP_MAX_AGE = 15 * 60 * 1000;

declare global {
	interface Window {
		talivia?: {
			track: (eventName: string) => void;
		};
	}
}

export function trackTaliviaSignup() {
	window.talivia?.track("signup");
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
