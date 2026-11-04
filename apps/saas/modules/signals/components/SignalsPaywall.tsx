import { config } from "@config";
import { Button } from "@repo/ui/components/button";
import { ArrowRightIcon, ChartCandlestickIcon, LockKeyholeIcon, RadioIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

const PREVIEW_CANDLES = [
	{
		bodyHeight: "14%",
		bodyTop: "52%",
		color: "bg-emerald-400",
		left: "8%",
		wickHeight: "34%",
		wickTop: "43%",
	},
	{
		bodyHeight: "11%",
		bodyTop: "42%",
		color: "bg-rose-400",
		left: "15%",
		wickHeight: "28%",
		wickTop: "34%",
	},
	{
		bodyHeight: "19%",
		bodyTop: "47%",
		color: "bg-emerald-400",
		left: "22%",
		wickHeight: "38%",
		wickTop: "36%",
	},
	{
		bodyHeight: "10%",
		bodyTop: "31%",
		color: "bg-emerald-400",
		left: "29%",
		wickHeight: "25%",
		wickTop: "26%",
	},
	{
		bodyHeight: "14%",
		bodyTop: "38%",
		color: "bg-rose-400",
		left: "36%",
		wickHeight: "31%",
		wickTop: "29%",
	},
	{
		bodyHeight: "18%",
		bodyTop: "43%",
		color: "bg-rose-400",
		left: "43%",
		wickHeight: "37%",
		wickTop: "34%",
	},
	{
		bodyHeight: "12%",
		bodyTop: "57%",
		color: "bg-emerald-400",
		left: "50%",
		wickHeight: "29%",
		wickTop: "51%",
	},
	{
		bodyHeight: "17%",
		bodyTop: "49%",
		color: "bg-emerald-400",
		left: "57%",
		wickHeight: "36%",
		wickTop: "40%",
	},
	{
		bodyHeight: "10%",
		bodyTop: "35%",
		color: "bg-emerald-400",
		left: "64%",
		wickHeight: "26%",
		wickTop: "29%",
	},
	{
		bodyHeight: "15%",
		bodyTop: "41%",
		color: "bg-rose-400",
		left: "71%",
		wickHeight: "33%",
		wickTop: "34%",
	},
	{
		bodyHeight: "13%",
		bodyTop: "50%",
		color: "bg-emerald-400",
		left: "78%",
		wickHeight: "30%",
		wickTop: "43%",
	},
	{
		bodyHeight: "16%",
		bodyTop: "45%",
		color: "bg-emerald-400",
		left: "85%",
		wickHeight: "35%",
		wickTop: "35%",
	},
	{
		bodyHeight: "10%",
		bodyTop: "30%",
		color: "bg-rose-400",
		left: "92%",
		wickHeight: "27%",
		wickTop: "24%",
	},
] as const;

export async function SignalsPaywall() {
	const t = await getTranslations("signals");
	const locale = await getLocale();
	const marketingUrl = config.marketingUrl?.replace(/\/$/, "") ?? "";
	const pricingUrl = `${marketingUrl}/${locale}#pricing`;

	return (
		<section
			data-pwa-theme-surface="signals"
			className="text-white relative h-full min-h-full overflow-hidden bg-[#141414]"
		>
			<div aria-hidden="true" className="inset-0 pointer-events-none absolute select-none">
				<div className="flex h-full min-h-[680px] flex-col bg-[#141414]">
					<header className="min-h-14 gap-3 border-white/10 px-4 flex shrink-0 items-center border-b">
						<div className="gap-2 pr-2 text-sm font-semibold flex shrink-0 items-center">
							<RadioIcon className="size-4 text-emerald-400" />
							<span>{t("ticker.live")}</span>
						</div>
						{["BTC", "ETH", "SOL", "ENA", "INJ"].map((symbol, index) => (
							<div
								key={symbol}
								className="gap-2 border-white/10 bg-white/[0.035] px-3 py-1.5 text-xs sm:flex hidden items-center rounded-md border"
							>
								<span className="size-4 bg-white/15 rounded-full" />
								<span className="font-semibold">{symbol}</span>
								<span className="font-mono text-white/55">
									${index ? "0.00" : "0.00"}
								</span>
								<span className={index % 2 ? "text-rose-400" : "text-emerald-400"}>
									{index % 2 ? "-1.24%" : "+2.16%"}
								</span>
							</div>
						))}
					</header>

					<div className="min-h-0 xl:grid-cols-[minmax(0,1fr)_328px] grid flex-1 grid-cols-1">
						<main className="min-h-0 border-white/10 xl:border-r xl:border-b-0 border-b">
							<div className="gap-2 border-white/10 p-4 flex flex-wrap border-b">
								{[
									t("sourcePicker.allTraders"),
									"币圈所长",
									"独领风骚",
									"日内交易",
									"时间领主",
								].map((source, index) => (
									<span
										key={source}
										className="gap-1.5 border-white/10 bg-white/[0.035] px-2.5 py-1 text-xs text-white/75 flex items-center rounded-md border"
									>
										{index > 0 ? (
											<span className="size-2 bg-emerald-400 rounded-full" />
										) : null}
										{source}
									</span>
								))}
							</div>

							<div className="h-12 border-white/10 px-4 flex items-center justify-between border-b">
								<div className="gap-3 text-xs text-white/55 flex items-center">
									<span className="bg-white/10 px-2.5 py-1.5 text-white rounded-md">
										{t("direction.all")}
									</span>
									<span>{t("direction.long")}</span>
									<span>{t("direction.short")}</span>
								</div>
								<div className="border-white/10 p-0.5 text-xs flex rounded-md border">
									<span className="px-2 py-1 text-white/55">15m</span>
									<span className="bg-white px-2 py-1 font-semibold text-black rounded-sm">
										1h
									</span>
									<span className="px-2 py-1 text-white/55">4h</span>
								</div>
							</div>

							<div className="gap-2 border-white/10 px-4 py-3 flex items-center border-b">
								<ChartCandlestickIcon className="size-4 text-white/55" />
								<span className="font-mono text-sm font-semibold">BTCUSDT</span>
							</div>

							<div className="p-4 relative min-h-[390px] overflow-hidden">
								<div className="border-white/[0.07] grid h-full grid-cols-6 grid-rows-4 border-t border-l">
									{Array.from({ length: 24 }).map((_, index) => (
										<span
											key={index}
											className="border-white/[0.07] border-r border-b"
										/>
									))}
								</div>
								<div className="inset-4 absolute">
									{PREVIEW_CANDLES.map((candle, index) => (
										<div
											key={index}
											className="w-3 absolute h-full"
											style={{ left: candle.left }}
										>
											<span
												className="bg-white/45 absolute left-1/2 w-px -translate-x-1/2"
												style={{
													height: candle.wickHeight,
													top: candle.wickTop,
												}}
											/>
											<span
												className={`w-2 absolute left-1/2 -translate-x-1/2 ${candle.color}`}
												style={{
													height: candle.bodyHeight,
													top: candle.bodyTop,
												}}
											/>
										</div>
									))}
									<div className="size-7 border-emerald-300 bg-emerald-400/30 absolute top-[42%] left-[56%] rounded-full border-2" />
									<div className="size-7 border-rose-300 bg-rose-400/30 absolute top-[50%] left-[74%] rounded-full border-2" />
								</div>
							</div>
						</main>

						<aside className="min-h-0 xl:flex hidden flex-col">
							<div className="border-white/10 text-xs grid grid-cols-2 border-b text-center">
								<span className="border-white px-3 py-4 font-semibold border-b-2">
									{t("status.active")}
								</span>
								<span className="px-3 py-4 text-white/45">
									{t("status.history")}
								</span>
							</div>
							<div className="space-y-3 p-3">
								{["BTCUSDT", "ETHUSDT", "ENAUSDT"].map((symbol, index) => (
									<div
										key={symbol}
										className="border-white/10 bg-white/[0.035] p-3 rounded-md border"
									>
										<div className="flex items-center justify-between">
											<div className="gap-2 flex items-center">
												<span className="size-6 bg-white/15 rounded-full" />
												<span className="font-mono text-xs font-semibold">
													{symbol}
												</span>
											</div>
											<span
												className={
													index === 1
														? "text-rose-400"
														: "text-emerald-400"
												}
											>
												{index === 1
													? t("direction.short")
													: t("direction.long")}
											</span>
										</div>
										<div className="mt-3 gap-y-2 text-white/45 grid grid-cols-2 text-[11px]">
											<span>{t("signalsPanel.entry")}</span>
											<span className="font-mono text-white/70 text-right">
												0.0000
											</span>
											<span>{t("signalsPanel.stopLoss")}</span>
											<span className="font-mono text-white/70 text-right">
												0.0000
											</span>
										</div>
									</div>
								))}
							</div>
						</aside>
					</div>
				</div>
			</div>

			<div className="inset-0 bg-black/35 pointer-events-none absolute backdrop-blur-[5px]" />
			<div className="inset-0 p-4 sm:p-6 pointer-events-none absolute grid place-items-center">
				<div className="max-w-md border-white/15 px-6 py-7 sm:px-8 backdrop-blur-xl pointer-events-auto w-full rounded-xl border bg-[#171615]/80 text-center shadow-[0_24px_72px_rgba(0,0,0,0.5)]">
					<div className="mb-4 size-11 border-white/15 bg-white/[0.06] mx-auto grid place-items-center rounded-full border">
						<LockKeyholeIcon className="size-5 text-white/80" aria-hidden="true" />
					</div>
					<h1 className="text-xl font-semibold text-white sm:text-2xl">
						{t("paywall.preview.title")}
					</h1>
					<p className="mt-2 text-sm leading-6 text-white/65">
						{t("paywall.preview.description")}
					</p>
					<Button asChild className="mt-6 sm:w-auto w-full" size="lg" variant="primary">
						<a href={pricingUrl}>
							{t("paywall.preview.action")}
							<ArrowRightIcon className="ml-2 size-4" aria-hidden="true" />
						</a>
					</Button>
				</div>
			</div>
		</section>
	);
}
