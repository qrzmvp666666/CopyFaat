import { Heading, Link, Section, Text } from "@react-email/components";
import React from "react";
import { createTranslator } from "use-intl/core";

import PrimaryButton from "../components/PrimaryButton";
import Wrapper from "../components/Wrapper";
import { defaultLocale, defaultTranslations } from "../lib/translations";
import type { BaseMailProps } from "../types";

export function Notification({
	title,
	message,
	link,
	locale,
	translations,
}: {
	title: string;
	message?: string;
	link?: string;
} & BaseMailProps) {
	const t = createTranslator({
		locale,
		messages: {
			...translations.notification,
			common: translations.common,
		},
	});

	return (
		<Wrapper locale={locale} preview={title}>
			<Text className="m-0 text-sm font-semibold text-muted-foreground">{t("kicker")}</Text>
			<Heading className="mb-4 mt-2 text-2xl font-bold leading-8 text-foreground">
				{title}
			</Heading>
			{message ? (
				<Section className="my-5 px-4 py-3 rounded-lg border border-border bg-secondary">
					<Text className="m-0 text-base leading-6 text-foreground">{message}</Text>
				</Section>
			) : null}
			{link ? (
				<>
					<Text className="mb-3 mt-5 text-sm leading-6 text-muted-foreground">
						{t("openInApp")}
					</Text>
					<PrimaryButton href={link}>{t("view")} &rarr;</PrimaryButton>
					<Text className="mt-6 text-sm leading-6 text-muted-foreground">
						{t("common.openLinkInBrowser")}
						<br />
						<Link href={link} className="text-blue-600 break-all">
							{link}
						</Link>
					</Text>
				</>
			) : null}
		</Wrapper>
	);
}

Notification.PreviewProps = {
	locale: defaultLocale,
	translations: defaultTranslations,
	title: "欢迎使用 SignalFast",
	message: "账户已准备就绪，你可以开始接收交易信号和重要提醒。",
	link: "https://example.com",
};

export default Notification;
