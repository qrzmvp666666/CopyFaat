import { Button } from "@react-email/components";
import React, { type CSSProperties, type PropsWithChildren } from "react";

export default function PrimaryButton({
	href,
	children,
}: PropsWithChildren<{
	href: string;
}>) {
	return (
		<Button href={href} style={buttonStyle}>
			{children}
		</Button>
	);
}

const buttonStyle: CSSProperties = {
	display: "inline-block",
	minWidth: "132px",
	borderRadius: "999px",
	backgroundColor: "#111827",
	color: "#ffffff",
	fontSize: "15px",
	fontWeight: 700,
	lineHeight: "20px",
	padding: "13px 20px",
	textAlign: "center",
	textDecoration: "none",
};
