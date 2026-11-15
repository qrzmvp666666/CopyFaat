import { findSignalSourceBindings, normalizeSignalSourceName } from "@repo/database";

import { SignalSourceError } from "./signal-source-error";
import type { ParsedSignalWebhookRequest } from "./signal-webhook-schema";

export async function resolveSignalSource(source: ParsedSignalWebhookRequest["source"]) {
	const isDiscord =
		source.platform !== undefined && normalizeSignalSourceName(source.platform) === "discord";
	if (!source.serverName && !source.channelName && !source.categoryName && !isDiscord)
		return null;
	if (!source.platform || !source.serverName || !source.channelName) {
		throw new SignalSourceError(
			"SOURCE_INCOMPLETE",
			"Named sources require platform, serverName and channelName.",
		);
	}
	const bindings = await findSignalSourceBindings({
		platform: source.platform,
		serverName: source.serverName,
		channelName: source.channelName,
		categoryName: source.categoryName,
	});
	if (!bindings.length)
		throw new SignalSourceError(
			"SOURCE_UNBOUND",
			"Source is not bound to a KOL. Configure its server and channel names in administration.",
		);
	if (bindings.length > 1)
		throw new SignalSourceError(
			"SOURCE_AMBIGUOUS",
			"Multiple channels match. Supply categoryName to identify the source.",
		);
	const binding = bindings[0];
	if (!binding.isActive || !binding.trader.isActive)
		throw new SignalSourceError("SOURCE_DISABLED", "Source binding or its KOL is disabled.");
	return binding.trader;
}
