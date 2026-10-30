import { getSession } from "@auth/lib/server";
import { claimPendingPurchases } from "@repo/payments";
import { NextResponse } from "next/server";

export async function POST() {
	const session = await getSession();
	if (!session) {
		return NextResponse.json({ error: "Authentication required" }, { status: 401 });
	}

	if (!session.user.emailVerified) {
		return NextResponse.json({ error: "Verify your account email first" }, { status: 403 });
	}

	const claimed = await claimPendingPurchases(session.user.id, session.user.email);
	if (claimed > 0) {
		return NextResponse.json({ claimed, refresh: true });
	}
	return NextResponse.json({ claimed });
}
