import {
	BellIcon,
	ChartCandlestickIcon,
	CircleDollarSignIcon,
	LayersIcon,
	MessagesSquareIcon,
	PanelTopIcon,
	RadioIcon,
	ScanEyeIcon,
	UsersIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";

const FEATURE_ICONS = [
	LayersIcon,
	CircleDollarSignIcon,
	ChartCandlestickIcon,
	MessagesSquareIcon,
	RadioIcon,
	UsersIcon,
	BellIcon,
	ScanEyeIcon,
	PanelTopIcon,
];
export function ValuePillarsSection() {
	const t = useTranslations("home.island");
	const features = t.raw("features") as [string, string][];
	return (
		<section id="features" className="island-features island-width">
			<h2 className="sr-only">{t("featuresTitle")}</h2>
			<div className="island-feature-grid">
				{features.map(([title, description], index) => {
					const Icon = FEATURE_ICONS[index];
					return (
						<article className="island-feature-card" key={title}>
							<Icon size={23} strokeWidth={1.5} aria-hidden="true" />
							<h3>{title}</h3>
							<p>{description}</p>
						</article>
					);
				})}
			</div>
		</section>
	);
}
