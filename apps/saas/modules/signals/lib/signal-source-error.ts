export class SignalSourceError extends Error {
	constructor(
		public readonly code:
			| "SOURCE_UNBOUND"
			| "SOURCE_AMBIGUOUS"
			| "SOURCE_DISABLED"
			| "SOURCE_INCOMPLETE"
			| "EVENT_SOURCE_CONFLICT",
		message: string,
	) {
		super(message);
		this.name = "SignalSourceError";
	}
}
