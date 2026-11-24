import { expect, test } from "@playwright/test";

test.describe("marketing home", () => {
	test("preview tabs support keyboard navigation", async ({ page }) => {
		await page.goto("/en");
		await expect(page.getByRole("heading", { level: 1 })).toContainText("Your trading world.");
		const overview = page.getByRole("tab", { name: "Overview", exact: true });
		await overview.focus();
		await overview.press("ArrowRight");
		await expect(page.getByRole("tab", { name: "Markets", exact: true })).toBeFocused();
		await expect(page.getByRole("tab", { name: "Markets", exact: true })).toHaveAttribute(
			"aria-selected",
			"true",
		);
	});
	test("FAQ can be expanded and collapsed", async ({ page }) => {
		await page.goto("/en");
		const question = page.locator("details").first();
		await question.locator("summary").click();
		await expect(question).toHaveAttribute("open", "");
		await expect(question.locator("p")).toBeVisible();
		await question.locator("summary").click();
		await expect(question).not.toHaveAttribute("open", "");
	});
	test("billing selection updates price and checkout destination", async ({ page }) => {
		await page.goto("/en");
		await page.getByRole("button", { name: "Weekly", exact: true }).click();
		await expect(page.locator(".island-price strong")).toHaveText("$8.99");
		await expect(page.getByRole("link", { name: "Get SignalFast Pro" })).toHaveAttribute(
			"href",
			/\/en\/choose-plan\?planId=pro&interval=week$/,
		);
		await page.getByRole("button", { name: "Yearly", exact: true }).click();
		await expect(page.locator(".island-price strong")).toHaveText("$99.99");
	});
	test("video dialog closes with Escape", async ({ page }) => {
		await page.goto("/en");
		await page.getByRole("button", { name: "Watch demo", exact: true }).click();
		await expect(page.getByRole("dialog")).toBeVisible();
		await page.keyboard.press("Escape");
		await expect(page.getByRole("dialog")).not.toBeVisible();
	});
	test("Chinese mobile page fits the viewport", async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await page.goto("/zh");
		await expect(page.getByRole("heading", { level: 1 })).toContainText("让信号更清晰");
		expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
		await expect(page.locator("nav")).toBeVisible();
		await expect(
			page.getByRole("link", { name: "打开 SignalFast", exact: true }).first(),
		).toHaveAttribute("href", /\/zh\/install$/);
	});
});
