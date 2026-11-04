"use client";

import { config } from "@config";
import { LocaleLink, useLocalePathname } from "@i18n/routing";
import { cn, Logo } from "@repo/ui";
import { Button } from "@repo/ui/components/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@repo/ui/components/sheet";
import { LocaleSwitch } from "@shared/components/LocaleSwitch";
import { MenuIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import NextLink from "next/link";
import { Suspense, useEffect, useState } from "react";

export function NavBar() {
	const t = useTranslations();
	const locale = useLocale();
	const localePathname = useLocalePathname();

	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
	const [isTop, setIsTop] = useState(true);
	const [isMobileNavVisible, setIsMobileNavVisible] = useState(true);

	const handleMobileMenuClose = () => {
		setMobileMenuOpen(false);
	};

	useEffect(() => {
		let frameId = 0;

		const handleScroll = () => {
			if (frameId) {
				return;
			}

			frameId = window.requestAnimationFrame(() => {
				const currentScrollY = Math.max(
					window.scrollY,
					document.scrollingElement?.scrollTop ?? 0,
				);

				setIsTop(currentScrollY <= 10);
				setIsMobileNavVisible((visible) =>
					visible ? currentScrollY <= 80 : currentScrollY <= 40,
				);
				frameId = 0;
			});
		};

		window.addEventListener("scroll", handleScroll, { passive: true });
		document.addEventListener("scroll", handleScroll, { passive: true, capture: true });
		return () => {
			window.removeEventListener("scroll", handleScroll);
			document.removeEventListener("scroll", handleScroll, true);
			window.cancelAnimationFrame(frameId);
		};
	}, []);

	useEffect(() => {
		if (mobileMenuOpen) {
			setIsMobileNavVisible(true);
		}
	}, [mobileMenuOpen]);

	useEffect(() => {
		handleMobileMenuClose();
	}, [localePathname]);

	const menuItems: {
		label: string;
		href: string;
		external?: boolean;
	}[] = [
		{
			label: t("common.menu.pricing"),
			href: "/#pricing",
		},
		{
			label: t("common.menu.blog"),
			href: "/blog",
		},
		{
			label: t("common.menu.docs"),
			href: config.docsUrl ?? "/docs",
			external: true,
		},
		{
			label: t("common.menu.faq"),
			href: "/#faq",
		},
		{
			label: t("common.menu.contact"),
			href: "/contact",
		},
	];

	const isMenuItemActive = (href: string) => localePathname.startsWith(href);

	return (
		<nav
			aria-hidden={!isMobileNavVisible && !mobileMenuOpen}
			className={cn(
				"top-0 sticky z-50 w-full bg-background transition-[transform,box-shadow,visibility] duration-300 motion-reduce:transition-none",
				{
					"border-b": !isTop,
					"pointer-events-none invisible -translate-y-full":
						!isMobileNavVisible && !mobileMenuOpen,
				},
			)}
			data-test="navigation"
		>
			<div className="container">
				<div
					className={cn(
						"gap-6 flex items-center justify-stretch transition-[padding] duration-200",
						!isTop ? "py-4" : "py-6",
					)}
				>
					<div className="flex flex-1 justify-start">
						<LocaleLink
							href="/"
							className="block hover:no-underline active:no-underline"
						>
							<Logo />
						</LocaleLink>
					</div>

					<div className="lg:flex hidden flex-1 items-center justify-center">
						{menuItems.map((menuItem) => (
							<NavMenuItem
								key={menuItem.href}
								menuItem={menuItem}
								isActive={isMenuItemActive(menuItem.href)}
							/>
						))}
					</div>

					<div className="gap-3 flex flex-1 items-center justify-end">
						<Suspense>
							<LocaleSwitch />
						</Suspense>

						<Sheet
							open={mobileMenuOpen}
							onOpenChange={(open) => setMobileMenuOpen(open)}
						>
							<SheetTrigger asChild>
								<Button
									className="lg:hidden"
									size="icon"
									variant="secondary"
									aria-label={t("common.aria.menu")}
								>
									<MenuIcon className="size-4" />
								</Button>
							</SheetTrigger>
							<SheetContent className="w-[280px]" side="right">
								<SheetTitle />
								<div className="flex flex-col items-start justify-center">
									{menuItems.map((menuItem) => (
										<NavMenuItem
											key={menuItem.href}
											menuItem={menuItem}
											isActive={isMenuItemActive(menuItem.href)}
											onClick={handleMobileMenuClose}
											className="text-base"
										/>
									))}

									{config.saasUrl && (
										<NextLink
											href={`${config.saasUrl.replace(/\/$/, "")}/${locale}`}
											className="px-3 py-2 text-base block"
											onClick={handleMobileMenuClose}
											prefetch
										>
											{t("common.menu.login")}
										</NextLink>
									)}
								</div>
							</SheetContent>
						</Sheet>

						{config.saasUrl && (
							<Button className="lg:flex hidden" asChild variant="secondary">
								<NextLink
									href={`${config.saasUrl.replace(/\/$/, "")}/${locale}`}
									prefetch
								>
									{t("common.menu.login")}
								</NextLink>
							</Button>
						)}
					</div>
				</div>
			</div>
		</nav>
	);
}

interface NavMenuItemProps {
	menuItem: {
		label: string;
		href: string;
		external?: boolean;
	};
	isActive: boolean;
	onClick?: () => void;
	className?: string;
}

function NavMenuItem({ menuItem, isActive, onClick, className }: NavMenuItemProps) {
	const linkClassName = cn(
		"px-3 py-2 font-medium text-sm block shrink-0 text-foreground/80",
		className,
		isActive ? "font-bold text-foreground" : "",
	);

	if (menuItem.external) {
		return (
			<a href={menuItem.href} onClick={onClick} className={linkClassName}>
				{menuItem.label}
			</a>
		);
	}

	return (
		<LocaleLink href={menuItem.href} onClick={onClick} className={linkClassName} prefetch>
			{menuItem.label}
		</LocaleLink>
	);
}
