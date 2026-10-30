"use client";

import { useSession } from "@auth/hooks/use-session";
import { cn } from "@repo/ui";
import { Button } from "@repo/ui/components/button";
import { toastError } from "@repo/ui/components/toast";
import {
	ArrowUpRightIcon,
	CandlestickChartIcon,
	CheckIcon,
	CircleDotIcon,
	LockKeyholeIcon,
	UsersRoundIcon,
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

function getTaliviaVisitorId() {
	const match = document.cookie.match(/(?:^|;\s*)talivia_visitor_id=([^;]+)/);
	return match ? decodeURIComponent(match[1]) : null;
}

function getYolfiPaymentLinkUrl(paymentLink: string, visitorId: string | null, email?: string) {
	const url = new URL(paymentLink);
	if (visitorId) url.searchParams.set("clientReferenceId", visitorId);
	if (email) url.searchParams.set("email", email);
	return url.toString();
}

function getStripePaymentLinkUrl(paymentLink: string, visitorId: string | null, email?: string) {
	const url = new URL(paymentLink);
	if (visitorId) url.searchParams.set("client_reference_id", visitorId);
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
		const visitorId = getTaliviaVisitorId();
		const paymentLink =
			period === "year" ? YOLFI_YEARLY_PAYMENT_LINK : YOLFI_WEEKLY_PAYMENT_LINK;
		window.location.href = getYolfiPaymentLinkUrl(
			paymentLink,
			visitorId,
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
		window.location.href = getStripePaymentLinkUrl(
			paymentLink,
			getTaliviaVisitorId(),
			user?.email,
		);
	}

	return (
		<div className="inset-0 bg-black/75 text-white backdrop-blur-sm md:hidden fixed z-[60] flex justify-center">
			<div className="relative h-[100dvh] w-full max-w-[390px] overflow-hidden rounded-[32px] bg-[#101113]">
				<div
					aria-hidden="true"
					className="inset-x-0 top-0 px-6 font-semibold absolute z-20 flex h-[42px] items-start justify-between pt-[12px] text-[15px]"
				>
					<span>9:41</span>
					<span className="mt-[5px] flex items-center gap-[3px]">
						<i className="bg-white size-[4px] rounded-full" />
						<i className="bg-white size-[4px] rounded-full" />
						<i className="bg-white size-[4px] rounded-full" />
						<i className="bg-white ml-[3px] h-[5px] w-[13px] rounded-sm" />
					</span>
				</div>

				<div className="inset-x-0 bottom-0 absolute top-[42px] overflow-y-auto rounded-t-[28px] bg-[#050506] [scrollbar-width:none]">
					<div className="relative h-[802px] min-h-[802px] w-full overflow-hidden">
						<div className="h-1 w-11 absolute top-[9px] left-1/2 -translate-x-1/2 rounded-full bg-[#535258]" />

						<div className="inset-x-0 top-5 absolute h-[390px] overflow-hidden">
							<div className="inset-0 absolute bg-[url('/images/paywall/hero-floating-trading-universe.png')] bg-cover bg-center" />
							<div className="inset-0 bg-black/65 absolute backdrop-blur-[2px]" />
							<div className="inset-x-0 bottom-0 h-32 absolute bg-gradient-to-b from-transparent to-[#050506]" />
						</div>

						<button
							aria-label="关闭付费墙"
							className="left-5 text-xl text-white absolute top-[26px] z-10 grid size-[30px] place-items-center rounded-full bg-[#303035] leading-none"
							onClick={onClose}
							type="button"
						>
							×
						</button>
						{!isAuthenticated ? (
							<Link
								className="right-5 font-medium text-white/90 absolute top-[26px] z-10 flex h-[30px] items-center rounded-full bg-[#2a2932] px-[10px] text-[10px]"
								href="/login?redirectTo=%2Fsignals"
							>
								已有权益？登录
							</Link>
						) : null}

						<div className="inset-x-0 absolute top-[83px] flex flex-col items-center text-center">
							<div className="bg-black grid size-[54px] place-items-center overflow-hidden rounded-[15px]">
								{/* Figma's logo asset has a transparent background. */}
								<img
									alt=""
									className="size-full object-contain"
									src="/images/paywall/signalfast-logo.png"
								/>
							</div>
							<h1 className="font-bold leading-8 mt-[9px] text-[27px]">SignalFast</h1>
							<span className="font-bold leading-5 mt-[3px] rounded-full bg-[#dbd0ff] px-[12px] py-[2px] text-[12px] text-[#201b30]">
								Pro
							</span>
							<p className="font-semibold leading-5 mt-[6px] text-[16px]">
								让每一次交易决策，都有清晰信号
							</p>
						</div>

						<section className="inset-x-0 absolute top-[278px] text-center">
							<h2 className="font-bold leading-6 text-[18px]">Pro 会员权益</h2>
							<p className="mt-[5px] text-[13px] leading-[18px] text-[#c6c2cc]">
								实时 KOL 信号 · 聚合 K 线追踪 · 完整交易细节
							</p>
						</section>

						<div className="inset-x-0 font-semibold absolute top-[350px] h-[78px] overflow-hidden text-[10px]">
							<BenefitPill className="top-0 left-[-18px] w-[150px]">
								<ArrowUpRightIcon />
								实时 KOL 信号
							</BenefitPill>
							<BenefitPill className="top-0 left-[145px] w-[154px]">
								<CandlestickChartIcon />
								聚合 K 线
							</BenefitPill>
							<BenefitPill className="top-0 left-[312px] w-[132px]">
								<CircleDotIcon />
								完整信号
							</BenefitPill>
							<BenefitPill className="top-[42px] left-[-4px] w-[156px]">
								<CheckIcon />
								无广告体验
							</BenefitPill>
							<BenefitPill className="top-[42px] left-[166px] w-[154px]">
								<UsersRoundIcon />
								专属社区
							</BenefitPill>
							<BenefitPill className="top-[42px] left-[334px] w-[132px]">
								<ArrowUpRightIcon />
								行情追踪
							</BenefitPill>
						</div>

						<div className="left-6 right-6 absolute top-[440px] grid h-[34px] grid-cols-2 rounded-full bg-[#1b1a20] p-[3px] text-[11px]">
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

						<button
							aria-pressed={period === "year"}
							className={cn(
								"left-6 right-6 absolute top-[496px] flex h-[76px] items-center justify-between rounded-[26px] border-[1.5px] px-[17px] text-left",
								period === "year"
									? "border-[#b5f2ff] bg-[#101014]"
									: "border-[#38363f] bg-[#09090c]",
							)}
							onClick={() => setPeriod("year")}
							type="button"
						>
							<span className="mr-[14px] size-[22px] shrink-0 rounded-full border-[3px] border-[#b9ebff] p-[3px]">
								<span
									className={cn(
										"block size-full rounded-full",
										period === "year" && "bg-[#d8baff]",
									)}
								/>
							</span>
							<span className="min-w-0 flex-1">
								<span className="font-bold block text-[14px]">年度 Pro</span>
								<span className="mt-[4px] block text-[12px] text-[#aaa6b1]">
									US$99.99 / 年
								</span>
							</span>
							<span className="text-right">
								<span className="font-bold block text-[14px]">US$1.92</span>
								<span className="mt-[4px] block text-[10px] text-[#aaa6b1]">
									折合每周
								</span>
							</span>
						</button>
						<span className="font-bold absolute top-[484px] right-[43px] z-10 flex h-[23px] w-[99px] items-center justify-center rounded-full bg-gradient-to-r from-[#9ceeff] to-[#e7b9ff] text-[9px] leading-[15px] text-[#17131e]">
							最划算 · 省 79%
						</span>

						<button
							aria-pressed={period === "week"}
							className={cn(
								"left-6 right-6 absolute top-[586px] flex h-[64px] items-center justify-between rounded-[26px] border px-[17px] text-left",
								period === "week"
									? "border-[#b5f2ff] bg-[#101014]"
									: "border-[#38363f] bg-[#09090c]",
							)}
							onClick={() => setPeriod("week")}
							type="button"
						>
							<span className="mr-[14px] size-[22px] shrink-0 rounded-full border-[1.5px] border-[#77737e] p-[4px]">
								<span
									className={cn(
										"block size-full rounded-full",
										period === "week" && "bg-[#d8baff]",
									)}
								/>
							</span>
							<span className="min-w-0 flex-1">
								<span className="font-bold block text-[14px]">每周 Pro</span>
								<span className="mt-[3px] block text-[12px] text-[#aaa6b1]">
									按周付费
								</span>
							</span>
							<span className="font-bold text-[14px]">US$8.99 / 周</span>
						</button>

						<Button
							className="left-6 right-6 font-bold absolute top-[674px] h-[54px] w-[calc(100%-48px)] rounded-full bg-gradient-to-r from-[#a4efff] to-[#e8baff] text-[16px] text-[#17131e] hover:brightness-105"
							disabled={isStartingCheckout}
							onClick={startCheckout}
						>
							立即解锁 Pro
						</Button>

						<div className="inset-x-0 absolute top-[740px] flex justify-center text-[10px] text-[#aaa6b1]">
							<LockKeyholeIcon className="mr-1 size-[11px]" />
							安全支付 · 可随时管理订阅
						</div>
						<p className="inset-x-0 absolute top-[762px] text-center text-[10px] leading-[14px] text-[#77737f]">
							服务条款 · 隐私政策
						</p>
						<div className="h-1 bg-white absolute bottom-[8px] left-1/2 w-[132px] -translate-x-1/2 rounded-full" />
					</div>
				</div>
			</div>
		</div>
	);
}

function BenefitPill({ children, className }: { children: React.ReactNode; className: string }) {
	return (
		<div
			className={cn(
				"text-white absolute flex h-[34px] items-center gap-[8px] rounded-[12px] bg-[#242329] px-[12px] [&_svg]:size-[12px] [&_svg]:shrink-0",
				className,
			)}
		>
			{children}
		</div>
	);
}
