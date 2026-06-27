import { ArrowRightIcon, MailIcon, SendIcon } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import Image from "next/image";

interface ContactMethod {
	account: string;
	href: string;
	icon: "telegram" | "x" | "qq" | "mail";
	label: string;
}

const CONTACT_METHODS: ContactMethod[] = [
	{
		account: "@Michael_Qin",
		href: "https://t.me/Michael_Qin",
		icon: "telegram",
		label: "电报",
	},
	{
		account: "@Michael_RunZe",
		href: "https://x.com/Michael_RunZe",
		icon: "x",
		label: "X",
	},
	{
		account: "1934416232",
		href: "tencent://message/?uin=1934416232&Site=SignalFast&Menu=yes",
		icon: "qq",
		label: "QQ",
	},
	{
		account: "1554202318@qq.com",
		href: "mailto:1554202318@qq.com",
		icon: "mail",
		label: "邮件",
	},
];

export async function generateMetadata(props: { params: Promise<{ locale: string }> }) {
	const { locale } = await props.params;
	const t = await getTranslations({ locale, namespace: "contact" });
	return {
		title: t("title"),
	};
}

export default async function ContactPage(props: { params: Promise<{ locale: string }> }) {
	const { locale } = await props.params;
	setRequestLocale(locale);

	const t = await getTranslations({ locale, namespace: "contact" });
	return (
		<div className="max-w-6xl py-16 md:py-24 container">
			<div className="mb-16 max-w-3xl mx-auto text-center">
				<h1 className="mb-4 font-bold text-5xl leading-tight md:text-6xl">{t("title")}</h1>
				<p className="text-xl text-balance text-muted-foreground">
					选择你习惯的方式找到我们。
				</p>
			</div>

			<div className="gap-6 md:grid-cols-2 grid">
				{CONTACT_METHODS.map((method) => (
					<a
						key={method.label}
						href={method.href}
						className="group min-h-36 gap-6 p-6 shadow-sm flex items-center rounded-3xl border bg-card/70 text-left transition-colors hover:border-primary/40 hover:bg-card"
						target={method.href.startsWith("http") ? "_blank" : undefined}
						rel={method.href.startsWith("http") ? "noopener noreferrer" : undefined}
					>
						<ContactIcon icon={method.icon} />
						<div className="min-w-0 flex-1">
							<h2 className="font-bold text-2xl text-foreground">{method.label}</h2>
							<p className="mt-3 text-xl truncate text-muted-foreground">
								{method.account}
							</p>
						</div>
						<ArrowRightIcon className="size-7 group-hover:translate-x-1 shrink-0 text-muted-foreground transition-transform group-hover:text-foreground" />
					</a>
				))}
			</div>
		</div>
	);
}

function ContactIcon({ icon }: { icon: ContactMethod["icon"] }) {
	if (icon === "telegram") {
		return (
			<span className="size-24 text-white shadow-lg flex shrink-0 items-center justify-center rounded-3xl bg-[#2AABEE] shadow-[#2AABEE]/20">
				<SendIcon className="size-12 fill-current stroke-[1.5]" />
			</span>
		);
	}

	if (icon === "x") {
		return (
			<span className="size-24 bg-black text-white shadow-lg shadow-black/20 flex shrink-0 items-center justify-center rounded-3xl">
				<span className="font-semibold text-6xl leading-none">𝕏</span>
			</span>
		);
	}

	if (icon === "qq") {
		return (
			<span className="size-24 bg-white shadow-lg shadow-black/10 flex shrink-0 items-center justify-center overflow-hidden rounded-3xl">
				<Image
					src="/images/contact/qq.png"
					alt="QQ"
					width={98}
					height={130}
					className="h-full w-auto object-cover"
				/>
			</span>
		);
	}

	return (
		<span className="size-24 from-blue-400 to-blue-700 text-white shadow-lg shadow-blue-500/20 flex shrink-0 items-center justify-center rounded-3xl bg-linear-to-br">
			<MailIcon className="size-12" />
		</span>
	);
}
