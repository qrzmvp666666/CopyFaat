"use client";

import { cn } from "@repo/ui";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@repo/ui/components/accordion";
import { ContactChannels } from "@shared/components/ContactChannels";
import { useLocale } from "next-intl";

const FAQ_COPY = {
	zh: {
		title: "常见问题解答",
		description: "有任何问题，选择你习惯的方式找到我们。",
		items: [
			{
				question: "SignalFast 的数据来源是哪里？",
				answer: "SignalFast 会聚合公开市场行情、链上数据以及 KOL 公开发布的交易观点，并通过统一的指标体系进行整理、回测和展示。",
			},
			{
				question: "SignalFast 和 Telegram、Discord 喊单群有什么区别？",
				answer: "Telegram 和 Discord 更像消息入口，适合快速接收讨论；SignalFast 更像分析工作台，会把分散信号放回同一张 K 线和历史表现里，方便比较、筛选和复盘。",
			},
			{
				question: "KOL 聚合 K 线主要解决什么问题？",
				answer: "它可以帮助你看到信号发出时价格处在什么位置，例如突破前、追高后、回踩支撑还是震荡区间。相比只看聊天截图，K 线位置更容易判断信号是否滞后或值得继续观察。",
			},
			{
				question: "普通小白用户适合使用你们的平台吗？",
				answer: "适合。平台提供可视化榜单、信号追踪和回测结果，新手可以先从胜率、收益、回撤等关键指标判断 KOL 表现。",
			},
			{
				question: "平台会保证收益或者代替我做交易决策吗？",
				answer: "不会。SignalFast 不承诺任何收益，也不替代用户的风险判断。平台提供的是信号整理、历史表现和行情位置分析，帮助你减少盲目跟单和只看盈利截图的风险。",
			},
			{
				question: "如果多个 KOL 在同一位置发出信号，应该怎么看？",
				answer: "多来源共振值得关注，但不代表一定正确。建议同时看这些来源是否独立、信号是否发生在行情大幅波动之后、历史上类似信号表现如何，以及是否有明确止损或失效条件。",
			},
			{
				question: "信号推送会不会有延迟？",
				answer: "平台会尽量提升信号采集、整理和推送速度，但任何跨平台聚合都可能受到来源发布时间、网络状态和第三方平台限制影响。短线用户建议结合实时行情和风险控制一起判断。",
			},
			{
				question: "免费版与专业版套餐有什么区别？",
				answer: "免费版适合体验基础功能；专业版会提供更完整的实时行情、KOL 聚合 K线跟踪、实时信号推送和专属客服支持。",
			},
			{
				question: "平台有提供终身买断套餐吗？",
				answer: "有。终身版适合长期使用的用户，一次购买即可长期获得对应权益，无需每月续费。",
			},
		],
	},
	en: {
		title: "Frequently Asked Questions",
		description: "Have a question? Choose the channel you prefer.",
		items: [
			{
				question: "Where does SignalFast's data come from?",
				answer: "SignalFast aggregates public market data, on-chain data, and trading views publicly posted by KOLs, then organizes and backtests them through a unified metric system.",
			},
			{
				question: "How is SignalFast different from Telegram or Discord signal groups?",
				answer: "Telegram and Discord are message channels for fast discussion. SignalFast is an analysis workspace that places scattered signals back onto K-line charts and historical performance views for easier comparison and review.",
			},
			{
				question: "What does the aggregated K-line view help with?",
				answer: "It shows where a signal appeared in the market structure, such as before a breakout, after a chase, near support, or inside a range. This makes signals easier to evaluate than chat screenshots alone.",
			},
			{
				question: "Is your platform suitable for beginners?",
				answer: "Yes. The platform provides visual rankings, signal tracking, and backtest results, so beginners can start with key metrics such as win rate, returns, and drawdown.",
			},
			{
				question: "Does SignalFast guarantee profit or make trading decisions for me?",
				answer: "No. SignalFast does not guarantee returns or replace your risk judgment. It organizes signals, historical performance, and chart context so you can make more informed decisions.",
			},
			{
				question: "How should I read multiple KOLs giving signals in the same area?",
				answer: "Multi-source alignment is worth attention, but it is not certainty. Check whether sources are independent, whether the signal is late after a strong move, and how similar signals performed historically.",
			},
			{
				question: "Can signal pushes be delayed?",
				answer: "SignalFast works to keep collection, organization, and pushes fast, but third-party platforms, source timing, and network conditions can still introduce delay. Short-term traders should always combine signals with real-time market context.",
			},
			{
				question: "What is the difference between the Free and Pro plans?",
				answer: "The Free plan is for trying the basic experience. Pro includes more complete real-time market data, aggregated KOL K-line tracking, real-time signal pushes, and dedicated support.",
			},
			{
				question: "Does the platform offer a lifetime plan?",
				answer: "Yes. The Lifetime plan is designed for long-term users. Pay once and keep the corresponding benefits without monthly renewal.",
			},
		],
	},
} as const;

export function FaqSection({ className }: { className?: string }) {
	const locale = useLocale();
	const copy = FAQ_COPY[locale as keyof typeof FAQ_COPY] ?? FAQ_COPY.en;

	return (
		<section className={cn("scroll-mt-20 py-8 lg:py-12", className)} id="faq">
			<div className="container">
				<div className="max-w-4xl mx-auto overflow-hidden rounded-2xl border bg-card">
					<div className="lg:grid-cols-[0.8fr_1.4fr] grid grid-cols-1">
						{/* Left panel */}
						<div className="px-8 py-8 lg:border-r lg:border-b-0 lg:px-10 lg:py-10 border-b">
							<h2 className="font-bold text-2xl leading-tight md:text-3xl text-foreground">
								{copy.title}
							</h2>
							<p className="mt-3 text-sm leading-6 text-muted-foreground">
								{copy.description}
							</p>
							<ContactChannels className="mt-6 gap-3 grid" compact />
						</div>

						{/* Right accordion */}
						<div className="px-6 py-4 lg:px-10 lg:py-6">
							<Accordion type="single" collapsible className="w-full text-left">
								{copy.items.map((item, i) => (
									<AccordionItem
										key={`faq-item-${i}`}
										value={`item-${i}`}
										className="border-border"
									>
										<AccordionTrigger className="py-4 text-sm font-semibold md:text-base text-left hover:no-underline">
											{item.question}
										</AccordionTrigger>
										<AccordionContent className="text-sm leading-7 text-muted-foreground">
											{item.answer}
										</AccordionContent>
									</AccordionItem>
								))}
							</Accordion>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
