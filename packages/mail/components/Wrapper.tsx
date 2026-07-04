import {
	Body,
	Column,
	Container,
	Font,
	Head,
	Hr,
	Html,
	Img,
	Preview,
	Row,
	Section,
	Tailwind,
	Text,
} from "@react-email/components";
import React, { type CSSProperties, type PropsWithChildren } from "react";

const BRAND_NAME = "SignalFast";

interface WrapperProps extends PropsWithChildren {
	locale?: string;
	preview?: string;
}

function getBrandLogoUrl() {
	const baseUrl =
		process.env.NEXT_PUBLIC_SAAS_URL?.replace(/\/$/, "") ?? "http://signalfast.localhost:4100";

	return `${baseUrl}/images/brand/signalfast-logo-mark.png`;
}

export default function Wrapper({ children, locale = "zh", preview = BRAND_NAME }: WrapperProps) {
	const isChinese = locale === "zh";

	return (
		<Tailwind
			config={{
				theme: {
					extend: {
						colors: {
							border: "#e7e5e4",
							input: "#e7e5e4",
							ring: "#a8a29e",
							background: "#fafaf9",
							foreground: "#0c0a09",
							primary: {
								DEFAULT: "#1c1917",
								foreground: "#ffffff",
							},
							secondary: {
								DEFAULT: "#f5f5f4",
								foreground: "#1c1917",
							},
							destructive: {
								DEFAULT: "#b91c1c",
								foreground: "#ffffff",
							},
							success: {
								DEFAULT: "#047857",
								foreground: "#ffffff",
							},
							muted: {
								DEFAULT: "#f5f5f4",
								foreground: "#78716c",
							},
							accent: {
								DEFAULT: "#f5f5f4",
								foreground: "#1c1917",
							},
							popover: {
								DEFAULT: "#ffffff",
								foreground: "#0c0a09",
							},
							card: {
								DEFAULT: "#ffffff",
								foreground: "#0c0a09",
							},
						},
						borderRadius: {
							DEFAULT: "0.75rem",
							sm: "0.45rem",
							md: "0.6rem",
							lg: "0.75rem",
							xl: "1.05rem",
							"2xl": "1.35rem",
							"3xl": "1.65rem",
							"4xl": "1.95rem",
						},
					},
				},
			}}
		>
			<Html lang={locale}>
				<Head>
					<Font
						fontFamily="Inter"
						fallbackFontFamily="Arial"
						fontWeight={400}
						fontStyle="normal"
					/>
				</Head>
				<Preview>{preview}</Preview>
				<Body style={bodyStyle}>
					<Section style={pageStyle}>
						<Container style={containerStyle}>
							<Section style={headerStyle}>
								<Row>
									<Column style={logoColumnStyle}>
										<Img
											src={getBrandLogoUrl()}
											alt={BRAND_NAME}
											width="34"
											height="34"
											style={logoStyle}
										/>
									</Column>
									<Column>
										<Text style={brandStyle}>{BRAND_NAME}</Text>
										<Text style={brandSublineStyle}>
											{isChinese
												? "账户与交易信号通知"
												: "Account and signal notifications"}
										</Text>
									</Column>
								</Row>
							</Section>
							<Section style={contentStyle}>{children}</Section>
							<Hr style={dividerStyle} />
							<Text style={footerStyle}>
								{isChinese
									? "这是一封 SignalFast 自动通知邮件，请勿直接回复。"
									: "This is an automated SignalFast email. Please do not reply directly."}
							</Text>
						</Container>
					</Section>
				</Body>
			</Html>
		</Tailwind>
	);
}

const bodyStyle: CSSProperties = {
	margin: 0,
	backgroundColor: "#eef0f3",
	color: "#111827",
	fontFamily: "Inter, Arial, sans-serif",
};

const pageStyle: CSSProperties = {
	backgroundColor: "#eef0f3",
	padding: "20px 12px",
};

const containerStyle: CSSProperties = {
	width: "100%",
	maxWidth: "560px",
	margin: "0 auto",
	overflow: "hidden",
	borderRadius: "18px",
	backgroundColor: "#ffffff",
	boxShadow: "0 14px 38px rgba(15, 23, 42, 0.08)",
};

const headerStyle: CSSProperties = {
	padding: "22px 24px",
	backgroundColor: "#0b0f19",
};

const logoColumnStyle: CSSProperties = {
	width: "46px",
};

const logoStyle: CSSProperties = {
	display: "block",
	borderRadius: "10px",
	backgroundColor: "#111827",
};

const brandStyle: CSSProperties = {
	margin: 0,
	color: "#ffffff",
	fontSize: "18px",
	fontWeight: 700,
	lineHeight: "24px",
};

const brandSublineStyle: CSSProperties = {
	margin: "2px 0 0",
	color: "#a7f3d0",
	fontSize: "12px",
	lineHeight: "18px",
};

const contentStyle: CSSProperties = {
	padding: "28px 24px 24px",
};

const dividerStyle: CSSProperties = {
	margin: "0 24px",
	borderColor: "#e5e7eb",
};

const footerStyle: CSSProperties = {
	margin: 0,
	padding: "16px 24px 24px",
	color: "#6b7280",
	fontSize: "12px",
	lineHeight: "18px",
};
