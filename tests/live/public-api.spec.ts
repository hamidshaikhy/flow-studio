import { test, expect } from "@playwright/test";
test("public API through real browser fetch, without interception", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "اجرا", exact: true }).waitFor();
  await page
    .locator(".react-flow__node")
    .filter({ has: page.locator("strong", { hasText: "دریافت پست‌ها" }) })
    .click();
  await page.getByRole("button", { name: "API زنده", exact: true }).click();
  await page.getByRole("button", { name: "اجرا", exact: true }).click();
  await expect(page.locator(".console-header .status")).toHaveText("موفق", {
    timeout: 15000,
  });
  await page.getByRole("button", { name: "نتیجه", exact: true }).click();
  await expect(page.locator(".result-bar")).toContainText("۱۰ رکورد");
});
