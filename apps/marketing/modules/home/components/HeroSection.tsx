import { DownloadMenu } from "@home/components/DownloadMenu";
import { ProductDemoSection } from "@home/components/ProductDemoSection";
import { useTranslations } from "next-intl";
import Image from "next/image";

export function HeroSection() {
	const t = useTranslations("home.island");
	return (
		<>
			<section className="island-hero">
				<div className="island-scatter" aria-hidden="true" />
				<h1>
					<span>{t("line1")}</span>
					<span className="island-green">{t("line2")}</span>
				</h1>
				<p>
					{t("intro")}
					<br />
					{t("intro2")}
				</p>
				<div className="island-hero-actions">
					<DownloadMenu />
					<a className="island-button island-button-secondary" href="#pricing">
						{t("plans")}
					</a>
				</div>
			</section>
			<ProductDemoSection />
			<div className="island-community">
				<p>{t("trusted")}</p>
				<div>
					<span>
						<Image
							className="island-platform-logo"
							src="/images/contact/telegram-monochrome.svg"
							alt=""
							width={21}
							height={21}
						/>
						Telegram
					</span>
					<span>
						<Image
							className="island-platform-logo"
							src="/images/contact/discord-monochrome.svg"
							alt=""
							width={21}
							height={21}
						/>
						Discord
					</span>
				</div>
			</div>
		</>
	);
}
