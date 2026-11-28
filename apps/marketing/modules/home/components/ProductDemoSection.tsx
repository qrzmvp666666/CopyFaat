import { CircleCheckIcon, LayoutDashboardIcon, RadioIcon, Settings2Icon } from "lucide-react";
import { useTranslations } from "next-intl";

export function ProductDemoSection() {
	const t = useTranslations("home.island.demo");

	return (
		<section className="island-demo" aria-label={t("label")}>
			<div className="island-demo-desktop">
				<div className="island-demo-wallpaper" aria-hidden="true" />
				<div className="island-demo-menubar">
					<span className="island-demo-brand">COPYFAST</span>
					<span>{t("menu")}</span>
					<span className="island-demo-clock">{t("status")}</span>
				</div>
				<div className="island-demo-status">
					<span className="island-demo-status-dot" />
					{t("monitoring")}
				</div>
				<div className="island-demo-window island-demo-window-back">
					<div className="island-demo-window-bar">
						<i />
						<i />
						<i />
						<span>Discord · {t("source")}</span>
					</div>
					<div className="island-demo-window-content">
						<div className="island-demo-channel">{t("channels")}</div>
						<div>
							<span className="island-demo-channel-dot" />
							{t("channelOne")}
						</div>
						<div>
							<span className="island-demo-channel-dot" />
							{t("channelTwo")}
						</div>
					</div>
				</div>
				<div className="island-demo-window island-demo-window-front">
					<div className="island-demo-window-bar">
						<i />
						<i />
						<i />
						<span>CopyFast · {t("syncActivity")}</span>
					</div>
					<div className="island-demo-app">
						<aside className="island-demo-sidebar">
							<b>CF</b>
							<LayoutDashboardIcon size={15} aria-hidden="true" />
							<RadioIcon size={15} aria-hidden="true" />
							<Settings2Icon size={15} aria-hidden="true" />
						</aside>
						<div className="island-demo-main">
							<div className="island-demo-heading">
								<div>
									<small>{t("workspace")}</small>
									<strong>{t("overview")}</strong>
								</div>
								<span className="island-demo-live">
									<i />
									{t("live")}
								</span>
							</div>
							<div className="island-demo-stats">
								<div>
									<small>{t("monitoredChannels")}</small>
									<strong>{t("unlimited")}</strong>
								</div>
								<div>
									<small>{t("syncedToday")}</small>
									<strong>{t("automatic")}</strong>
								</div>
								<div>
									<small>{t("destinations")}</small>
									<strong>{t("yourCommunities")}</strong>
								</div>
							</div>
							<div className="island-demo-feed-title">{t("recentActivity")}</div>
							<div className="island-demo-message">
								<span className="island-demo-avatar">DC</span>
								<div>
									<strong>{t("discordSource")}</strong>
									<p>{t("messageOne")}</p>
									<small>
										{t("justNow")} · {t("forwarded")}
									</small>
								</div>
								<CircleCheckIcon
									className="island-demo-check"
									size={15}
									aria-hidden="true"
								/>
							</div>
							<div className="island-demo-message">
								<span className="island-demo-avatar">DC</span>
								<div>
									<strong>{t("communitySource")}</strong>
									<p>{t("messageTwo")}</p>
									<small>
										{t("minutesAgo")} · {t("forwarded")}
									</small>
								</div>
								<CircleCheckIcon
									className="island-demo-check"
									size={15}
									aria-hidden="true"
								/>
							</div>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
