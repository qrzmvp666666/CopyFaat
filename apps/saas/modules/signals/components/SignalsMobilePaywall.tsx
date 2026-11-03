"use client";

import { useSession } from "@auth/hooks/use-session";
import { trackTaliviaCheckoutStarted } from "@auth/lib/talivia";
import { cn } from "@repo/ui";
import { Button } from "@repo/ui/components/button";
import { toastError } from "@repo/ui/components/toast";
import {
	ArrowUpRightIcon,
	CandlestickChartIcon,
	CheckIcon,
	CircleDotIcon,
	UsersRoundIcon,
	XIcon,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

interface SignalsMobilePaywallProps {
	isAuthenticated: boolean;
	open: boolean;
	onClose: () => void;
}

const YOLFI_WEEKLY_PAYMENT_LINK =
	process.env.NEXT_PUBLIC_YOLFI_PRO_WEEKLY_PAYMENT_LINK ??
	"https://pay.yolfi.com/340ba658-394f-439c-9abc-36985d2383d3";
const YOLFI_YEARLY_PAYMENT_LINK =
	process.env.NEXT_PUBLIC_YOLFI_PRO_YEARLY_PAYMENT_LINK ??
	"https://pay.yolfi.com/75797130-8b5c-4814-8266-204472a4be16";
const STRIPE_WEEKLY_PAYMENT_LINK = process.env.NEXT_PUBLIC_STRIPE_PRO_WEEKLY_PAYMENT_LINK ?? "";
const STRIPE_YEARLY_PAYMENT_LINK = process.env.NEXT_PUBLIC_STRIPE_PRO_YEARLY_PAYMENT_LINK ?? "";

function getYolfiPaymentLinkUrl(paymentLink: string, email?: string) {
	const url = new URL(paymentLink);
	if (email) url.searchParams.set("email", email);
	return url.toString();
}

function getStripePaymentLinkUrl(paymentLink: string, email?: string) {
	const url = new URL(paymentLink);
	if (email) url.searchParams.set("prefilled_email", email);
	return url.toString();
}

export function SignalsMobilePaywall({
	isAuthenticated,
	onClose,
	open,
}: SignalsMobilePaywallProps) {
	const { user } = useSession();
	const [paymentMethod, setPaymentMethod] = useState<"card" | "stablecoin">("card");
	const [period, setPeriod] = useState<"year" | "week">("year");
	const [isStartingCheckout, setIsStartingCheckout] = useState(false);
	if (!open) return null;

	function startYolfiCheckout() {
		const paymentLink =
			period === "year" ? YOLFI_YEARLY_PAYMENT_LINK : YOLFI_WEEKLY_PAYMENT_LINK;
		trackTaliviaCheckoutStarted();
		window.location.href = getYolfiPaymentLinkUrl(
			paymentLink,
			isAuthenticated ? user?.email : undefined,
		);
	}

	async function startCheckout() {
		if (paymentMethod === "stablecoin") {
			startYolfiCheckout();
			return;
		}

		const paymentLink =
			period === "year" ? STRIPE_YEARLY_PAYMENT_LINK : STRIPE_WEEKLY_PAYMENT_LINK;
		if (!paymentLink) {
			toastError("支付链接未配置", "请联系支持团队完成银行卡支付配置");
			return;
		}

		setIsStartingCheckout(true);
		trackTaliviaCheckoutStarted();
		window.location.href = getStripePaymentLinkUrl(paymentLink, user?.email);
	}

	return (
		<div className="inset-0 text-white md:hidden fixed z-[60] bg-[#050506]">
			<style>{`
				@keyframes benefit-slide-left {
					to { transform: translateX(-50%); }
				}
				@keyframes benefit-slide-right {
					from { transform: translateX(-50%); }
					to { transform: translateX(0); }
				}
			`}</style>
			<div className="mx-auto flex h-[100dvh] w-full max-w-[430px] flex-col">
				<header className="px-5 h-14 flex shrink-0 items-center justify-between pt-[max(env(safe-area-inset-top),16px)]">
					<button
						aria-label="关闭付费墙"
						className="text-white/75 hover:text-white size-10 flex items-center justify-center"
						onClick={onClose}
						type="button"
					>
						<XIcon className="size-5" />
					</button>
					{!isAuthenticated ? (
						<Link
							className="text-sm font-medium text-white/70 hover:text-white"
							href="/login?redirectTo=%2Fsignals"
						>
							已有权益？登录
						</Link>
					) : (
						<span className="w-10" />
					)}
				</header>

				<div className="min-h-0 px-6 pb-6 flex-1 overflow-y-auto [scrollbar-width:none]">
					<section className="pt-8 text-center">
						<img
							alt="SignalFast"
							className="size-14 mx-auto rounded-2xl object-contain"
							src="/images/paywall/signalfast-logo.png"
						/>
						<h1 className="mt-3 font-bold leading-8 text-[26px]">SignalFast Pro</h1>
						<p className="mt-2 text-sm leading-6 text-white/65">
							实时 KOL 信号、聚合 K 线与完整交易细节
						</p>
					</section>

					<div aria-label="Pro 会员权益" className="mt-7 -mx-6 space-y-2 overflow-hidden">
						<div className="flex w-max animate-[benefit-slide-left_24s_linear_infinite] motion-reduce:animate-none">
							<div className="gap-2 px-3 flex shrink-0">
								<BenefitPill icon={ArrowUpRightIcon}>实时 KOL 信号</BenefitPill>
								<BenefitPill icon={CandlestickChartIcon}>聚合 K 线</BenefitPill>
								<BenefitPill icon={CircleDotIcon}>完整信号</BenefitPill>
							</div>
							<div aria-hidden="true" className="gap-2 px-3 flex shrink-0">
								<BenefitPill icon={ArrowUpRightIcon}>实时 KOL 信号</BenefitPill>
								<BenefitPill icon={CandlestickChartIcon}>聚合 K 线</BenefitPill>
								<BenefitPill icon={CircleDotIcon}>完整信号</BenefitPill>
							</div>
						</div>
						<div className="flex w-max animate-[benefit-slide-right_28s_linear_infinite] motion-reduce:animate-none">
							<div className="gap-2 px-3 flex shrink-0">
								<BenefitPill icon={CheckIcon}>无广告体验</BenefitPill>
								<BenefitPill icon={UsersRoundIcon}>专属社区</BenefitPill>
								<BenefitPill icon={ArrowUpRightIcon}>行情追踪</BenefitPill>
							</div>
							<div aria-hidden="true" className="gap-2 px-3 flex shrink-0">
								<BenefitPill icon={CheckIcon}>无广告体验</BenefitPill>
								<BenefitPill icon={UsersRoundIcon}>专属社区</BenefitPill>
								<BenefitPill icon={ArrowUpRightIcon}>行情追踪</BenefitPill>
							</div>
						</div>
					</div>

					<div className="mt-7 h-10 p-1 text-xs grid grid-cols-2 rounded-full bg-[#1b1a20]">
						<button
							aria-pressed={paymentMethod === "card"}
							className={cn(
								"rounded-full text-[#9a97a1]",
								paymentMethod === "card" && "text-white bg-[#414047]",
							)}
							onClick={() => setPaymentMethod("card")}
							type="button"
						>
							银行卡支付
						</button>
						<button
							aria-pressed={paymentMethod === "stablecoin"}
							className={cn(
								"rounded-full text-[#9a97a1]",
								paymentMethod === "stablecoin" && "text-white bg-[#414047]",
							)}
							onClick={() => setPaymentMethod("stablecoin")}
							type="button"
						>
							稳定币支付
						</button>
					</div>

					<div className="mt-5 gap-3 flex flex-col">
						<div className="relative">
							<button
								aria-pressed={period === "year"}
								className={cn(
									"gap-3 px-4 py-3 flex min-h-[82px] w-full items-center rounded-2xl border text-left transition-colors",
									period === "year"
										? "border-[#b5f2ff] bg-[#101014]"
										: "border-[#38363f] bg-[#09090c]",
								)}
								onClick={() => setPeriod("year")}
								type="button"
							>
								<span
									className={cn(
										"size-5 p-1 shrink-0 rounded-full border-2 border-[#b9ebff]",
										period === "year" && "border-[#d8baff]",
									)}
								>
									<span
										className={cn(
											"block size-full rounded-full",
											period === "year" && "bg-[#d8baff]",
										)}
									/>
								</span>
								<span className="min-w-0 flex-1">
									<span className="text-sm font-bold block">年度 Pro</span>
									<span className="mt-1 text-xs block text-[#aaa6b1]">
										US$99.99 / 年
									</span>
								</span>
								<span className="shrink-0 text-right">
									<span className="text-sm font-bold block">US$1.92</span>
									<span className="mt-1 block text-[10px] text-[#aaa6b1]">
										折合每周
									</span>
								</span>
							</button>
							<span className="right-3 top-0 px-3 py-1 font-bold absolute z-10 -translate-y-1/2 rounded-full bg-gradient-to-r from-[#9ceeff] to-[#e7b9ff] text-[10px] leading-none text-[#17131e]">
								最划算 · 省 79%
							</span>
						</div>
						<button
							aria-pressed={period === "week"}
							className={cn(
								"gap-3 px-4 py-3 flex min-h-[72px] items-center rounded-2xl border text-left transition-colors",
								period === "week"
									? "border-[#b5f2ff] bg-[#101014]"
									: "border-[#38363f] bg-[#09090c]",
							)}
							onClick={() => setPeriod("week")}
							type="button"
						>
							<span
								className={cn(
									"size-5 p-1 shrink-0 rounded-full border-2 border-[#77737e]",
									period === "week" && "border-[#d8baff]",
								)}
							>
								<span
									className={cn(
										"block size-full rounded-full",
										period === "week" && "bg-[#d8baff]",
									)}
								/>
							</span>
							<span className="min-w-0 flex-1">
								<span className="text-sm font-bold block">每周 Pro</span>
								<span className="mt-1 text-xs block text-[#aaa6b1]">按周付费</span>
							</span>
							<span className="text-sm font-bold shrink-0">US$8.99 / 周</span>
						</button>
					</div>
				</div>

				<footer className="px-6 pt-3 bg-[#0c0c0e] pb-[max(env(safe-area-inset-bottom),16px)]">
					<Button
						className="h-12 text-base font-bold w-full rounded-full bg-gradient-to-r from-[#a4efff] to-[#e8baff] text-[#17131e] hover:brightness-105"
						disabled={isStartingCheckout}
						onClick={startCheckout}
					>
						立即解锁 Pro
					</Button>
				</footer>
			</div>
		</div>
	);
}

function BenefitPill({
	children,
	icon: Icon,
}: {
	children: string;
	icon: typeof ArrowUpRightIcon;
}) {
	return (
		<div className="h-10 gap-2 px-4 text-xs font-medium text-white/90 flex shrink-0 items-center rounded-2xl bg-[#242329]">
			<Icon aria-hidden="true" className="size-4 text-white/75 shrink-0" />
			<span>{children}</span>
		</div>
	);
}
