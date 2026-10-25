import {
	ActivityIcon,
	ArrowDownRightIcon,
	ArrowUpRightIcon,
	Layers3Icon,
	MessagesSquareIcon,
	RadioIcon,
	UsersRoundIcon,
} from "lucide-react";
import { useLocale } from "next-intl";

const PILLARS = {
	zh: {
		eyebrow: "SIGNALFAST · 核心优势",
		title: "多、快、好、省",
		intro: "把合约行情、KOL 信号与社群提醒，放进同一套交易工作流。",
		items: [
			{
				id: "many",
				mark: "多",
				title: "品种多，观点也多",
				text: "覆盖多类热门合约，汇集不同 KOL 的交易观点，机会不止一个来源。",
			},
			{
				id: "fast",
				mark: "快",
				title: "信号直达常用社群",
				text: "信号可快速推送至 Telegram 和 Discord，重要行情不必反复切换频道查找。",
			},
			{
				id: "good",
				mark: "好",
				title: "多路信号汇到一张图",
				text: "把多个 KOL 的信号标记到同一根 K 线图上，结合行情脉络查看进出场观点。",
			},
			{
				id: "save",
				mark: "省",
				title: "一份年费，集中使用",
				text: "年费 US$49.99，整合行情、信号和社群提醒。不少 TG / Discord 社群一个月的费用，就能覆盖这里一整年的服务；具体价格因社群而异。",
			},
		],
	},
	en: {
		eyebrow: "SIGNALFAST · WHY SIGNALFAST",
		title: "More. Faster. Better. For less.",
		intro: "Bring contract markets, KOL signals, and community alerts into one trading workflow.",
		items: [
			{
				id: "many",
				mark: "01",
				title: "More markets, more perspectives",
				text: "Explore a broad range of popular contracts and trading perspectives from multiple KOLs.",
			},
			{
				id: "fast",
				mark: "02",
				title: "Signals where your community is",
				text: "Send timely alerts to Telegram and Discord without constantly switching channels.",
			},
			{
				id: "good",
				mark: "03",
				title: "Multiple signals, one chart",
				text: "See multiple KOL signals on the same candlestick chart alongside market context.",
			},
			{
				id: "save",
				mark: "04",
				title: "One plan, less subscription overlap",
				text: "The US$49.99 annual plan brings market data, signals, and community alerts together in one place.",
			},
		],
	},
} as const;

const PILLAR_ICONS = [Layers3Icon, RadioIcon, ActivityIcon, ArrowDownRightIcon];

export function ValuePillarsSection() {
	const locale = useLocale();
	const copy = locale === "zh" ? PILLARS.zh : PILLARS.en;

	return (
		<section id="value" className="scroll-mt-20 px-4 py-8 sm:px-6 md:py-12">
			<div className="max-w-6xl mx-auto">
				<div className="mb-6 flex flex-col items-center text-center">
					<p className="text-xs font-semibold tracking-[0.16em] text-foreground/50">
						{copy.eyebrow}
					</p>
					<h2 className="mt-3 text-3xl font-semibold md:text-4xl text-foreground">
						{copy.title}
					</h2>
					<p className="mt-2 max-w-2xl text-sm sm:text-base text-foreground/60">
						{copy.intro}
					</p>
				</div>

				<nav
					aria-label={locale === "zh" ? "核心优势导航" : "Value highlights"}
					className="mb-4 gap-5 px-2 sm:gap-10 flex justify-center overflow-x-auto border-b border-foreground/15"
				>
					{copy.items.map((item) => (
						<a
							key={item.id}
							href={`#value-${item.id}`}
							className="px-1 pb-3 text-sm font-medium sm:text-base shrink-0 border-b-2 border-transparent text-foreground/65 transition-colors hover:border-foreground hover:text-foreground"
						>
							{item.mark}
						</a>
					))}
				</nav>

				<div className="sm:grid-cols-2 grid overflow-hidden border border-foreground/15 bg-background/40">
					{copy.items.map((item, index) => {
						const Icon = PILLAR_ICONS[index];
						return (
							<article
								id={`value-${item.id}`}
								key={item.id}
								className="scroll-mt-24 min-h-56 p-5 sm:min-h-64 sm:p-7 [&:nth-child(odd)]:sm:border-r [&:nth-last-child(-n+2)]:sm:border-b-0 flex flex-col justify-between border-b border-foreground/15 last:border-b-0"
							>
								<div className="gap-4 flex items-start justify-between">
									<div className="size-9 flex items-center justify-center rounded-md border border-foreground/15 bg-foreground text-background">
										<Icon className="size-4" aria-hidden="true" />
									</div>
									<span className="text-xs font-medium tracking-wide text-foreground/45">
										{item.mark}
									</span>
								</div>
								<div className="mt-7">
									<h3 className="text-lg font-semibold sm:text-xl text-foreground">
										{item.title}
									</h3>
									<p className="mt-2 max-w-lg text-sm leading-6 sm:text-base text-foreground/60">
										{item.text}
									</p>
								</div>
								<PillarVisual id={item.id} locale={locale} />
							</article>
						);
					})}
				</div>
			</div>
		</section>
	);
}

function PillarVisual({ id, locale }: { id: string; locale: string }) {
	if (id === "many") {
		return (
			<div className="mt-5 gap-2 flex flex-wrap" aria-hidden="true">
				{["BTC", "ETH", "SOL", "XRP", locale === "zh" ? "更多合约" : "More contracts"].map(
					(symbol) => (
						<span
							key={symbol}
							className="px-2.5 py-1 text-xs border border-foreground/15 text-foreground/70"
						>
							{symbol}
						</span>
					),
				)}
				<UsersRoundIcon className="size-5 ml-auto text-foreground/50" />
			</div>
		);
	}

	if (id === "fast") {
		return (
			<div className="mt-5 gap-2 flex items-center" aria-hidden="true">
				<RadioIcon className="size-4 text-foreground/45" />
				<div className="h-px flex-1 bg-foreground/20" />
				<span className="px-3 py-1 text-xs border border-foreground/15 text-foreground/70">
					Telegram
				</span>
				<span className="px-3 py-1 text-xs border border-foreground/15 text-foreground/70">
					Discord
				</span>
			</div>
		);
	}

	if (id === "good") {
		return (
			<div
				className="mt-5 h-12 gap-1 px-3 relative flex items-end border-b border-l border-foreground/15"
				aria-hidden="true"
			>
				{[20, 34, 26, 42, 31, 56, 45, 68, 52, 78, 63, 88, 72, 96, 84, 100].map(
					(height, index) => (
						<span key={index} className="relative flex h-full items-end">
							<span
								className={`mb-1 w-1.5 ${index % 3 === 0 ? "bg-foreground/80" : "bg-foreground/35"}`}
								style={{ height: `${height}%` }}
							/>
							{[4, 9, 13].includes(index) && (
								<span className="-top-1 size-1.5 absolute left-1/2 -translate-x-1/2 rounded-full bg-foreground" />
							)}
						</span>
					),
				)}
				<MessagesSquareIcon className="right-1 top-1 size-4 absolute text-foreground/50" />
			</div>
		);
	}

	return (
		<div className="mt-5 pt-3 flex items-center justify-between border-t border-foreground/15">
			<div className="gap-2 text-xs flex items-center text-foreground/55">
				<ArrowDownRightIcon className="size-4" aria-hidden="true" />
				{locale === "zh" ? "年费" : "Annual"}
				<span className="text-foreground/25">/</span>
				{locale === "zh" ? "多处月费" : "Separate fees"}
			</div>
			<div className="gap-1 text-sm font-semibold flex items-center text-foreground">
				<ArrowUpRightIcon className="size-4" aria-hidden="true" />
				US$49.99
				<span className="text-xs font-normal text-foreground/50">
					{locale === "zh" ? "/ 年" : "/ year"}
				</span>
			</div>
		</div>
	);
}
