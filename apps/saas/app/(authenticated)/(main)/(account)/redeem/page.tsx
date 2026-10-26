import { redirect } from "next/navigation";

export default async function RedeemCodePage() {
	redirect("/settings/billing");
}
