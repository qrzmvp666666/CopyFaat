"use client";

import { cn } from "@repo/ui";
import {
Accordion,
AccordionContent,
AccordionItem,
AccordionTrigger,
} from "@repo/ui/components/accordion";
import { useLocale } from "next-intl";

const FAQ_COPY = {
zh: {
title: "常见问题解答",
description: "有任何问题，请通过 QQ 联系我们：",
contactQqLabel: "有任何问题，请通过 QQ 联系我们：",
contactQq: "QQ号：1934416232",
items: [
{
question: "KOLArena 的数据来源是哪里？",
answer: "KOLArena 会聚合公开市场行情、链上数据以及 KOL 公开发布的交易观点，并通过统一的指标体系进行整理、回测和展示。",
},
{
question: "普通小白用户适合使用你们的平台吗？",
answer: "适合。平台提供可视化榜单、信号追踪和回测结果，新手可以先从胜率、收益、回撤等关键指标判断 KOL 表现。",
},
{
question: "平台提供哪些回测指标？",
answer: "平台会展示胜率、累计收益、最大回撤、信号频率、盈亏比等核心指标，帮助用户更直观地评估策略质量。",
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
description: "Have a question? Contact us via QQ:",
contactQqLabel: "Have a question? Contact us via QQ:",
contactQq: "QQ: 1934416232",
items: [
{
question: "Where does KOLArena's data come from?",
answer: "KOLArena aggregates public market data, on-chain data, and trading views publicly posted by KOLs, then organizes and backtests them through a unified metric system.",
},
{
question: "Is your platform suitable for beginners?",
answer: "Yes. The platform provides visual rankings, signal tracking, and backtest results, so beginners can start with key metrics such as win rate, returns, and drawdown.",
},
{
question: "What backtest metrics does the platform provide?",
answer: "The platform shows core metrics such as win rate, cumulative return, maximum drawdown, signal frequency, and profit-loss ratio to help users evaluate strategy quality.",
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
<div className="mx-auto max-w-4xl overflow-hidden rounded-2xl border bg-card">
<div className="grid grid-cols-1 lg:grid-cols-[0.8fr_1.4fr]">
{/* Left panel */}
<div className="border-b px-8 py-8 lg:border-r lg:border-b-0 lg:px-10 lg:py-10">
<h2 className="font-bold text-2xl leading-tight text-foreground md:text-3xl">
{copy.title}
</h2>
<p className="mt-3 text-sm leading-6 text-muted-foreground">
{copy.description}
</p>
<div className="mt-6 text-sm leading-6 text-muted-foreground">
<div>
<p className="mt-3 font-medium text-foreground">{copy.contactQq}</p>
</div>
</div>
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
<AccordionTrigger className="py-4 text-sm font-semibold text-left hover:no-underline md:text-base">
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
