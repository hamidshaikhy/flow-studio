import { strict as assert } from "node:assert";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const screenshots = new URL("../docs/screenshots/", import.meta.url);
const baseURL = process.env.CAPTURE_BASE_URL ?? "http://127.0.0.1:4173";
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
    : {}),
});
const errors = [];

async function open(viewport = { width: 1600, height: 1100 }) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(baseURL);
  await page.locator(".react-flow__node").first().waitFor();
  await page.evaluate(() => document.fonts.ready);
  return { context, page };
}

async function capture(page, name) {
  await page.screenshot({ path: fileURLToPath(new URL(name, screenshots)) });
  console.log(`Captured ${name}`);
}

async function navigate(page, name) {
  await page.getByRole("button", { name, exact: true }).click();
  await page.locator("main.page").waitFor();
}

async function chooseTemplate(page, index) {
  await navigate(page, "الگوها");
  await page
    .locator(".template-card")
    .nth(index)
    .getByRole("button", { name: "استفاده از الگو" })
    .click();
  await page.locator(".react-flow__node").first().waitFor();
}

try {
  await mkdir(screenshots, { recursive: true });

  const primary = await open();
  const page = primary.page;
  await capture(page, "editor-desktop.png");
  await page
    .locator(".react-flow__node")
    .filter({ has: page.locator("strong", { hasText: "دریافت پست‌ها" }) })
    .click();
  await capture(page, "inspector-desktop.png");
  await page.getByRole("button", { name: "پاک‌کردن کل صفحه" }).click();
  await page.getByRole("dialog").waitFor();
  await capture(page, "clear-confirm-desktop.png");
  await page.getByRole("button", { name: "انصراف" }).click();

  await page.getByRole("button", { name: "اجرا", exact: true }).click();
  await page.getByText("همهٔ مراحل فعال با موفقیت انجام شدند.").waitFor();
  await page.getByRole("button", { name: "نتیجه", exact: true }).click();
  await capture(page, "results-desktop.png");

  await navigate(page, "تاریخچه");
  await capture(page, "history-desktop.png");
  await page
    .locator(".history-list article")
    .first()
    .getByRole("button", { name: "بررسی" })
    .click();
  await page.locator(".run-details details").last().locator("summary").click();
  await capture(page, "history-detail-desktop.png");
  await page.getByRole("button", { name: "بستن پنجره" }).click();

  await navigate(page, "راهنما");
  await page.setViewportSize({ width: 1600, height: 1600 });
  await capture(page, "guide-desktop.png");
  await page.setViewportSize({ width: 1600, height: 1250 });
  await navigate(page, "گردش‌کارها");
  await capture(page, "library-desktop.png");
  await navigate(page, "الگوها");
  assert.equal(await page.locator(".template-card").count(), 6);
  await capture(page, "templates-desktop.png");

  await page.setViewportSize({ width: 1920, height: 1080 });
  await page
    .locator(".template-card")
    .nth(4)
    .getByRole("button", { name: "استفاده از الگو" })
    .click();
  await page.locator(".react-flow__node").first().waitFor();
  await capture(page, "branches-desktop.png");

  await navigate(page, "الگوها");
  await page.getByRole("button", { name: "گردش‌کار تازه" }).click();
  await page.getByRole("button", { name: /اعتبارسنجی/ }).click();
  await capture(page, "validation-desktop.png");
  await primary.context.close();

  const failing = await open();
  await failing.page
    .locator(".react-flow__node")
    .filter({
      has: failing.page.locator("strong", { hasText: "دریافت پست‌ها" }),
    })
    .click();
  await failing.page.getByLabel("سناریوی خطای آزمایشی").selectOption("http");
  await failing.page.getByRole("button", { name: "اجرا", exact: true }).click();
  await failing.page.locator(".flow-card.kind-http.node-failed").waitFor();
  await capture(failing.page, "error-desktop.png");
  await failing.context.close();

  const recovering = await open();
  await chooseTemplate(recovering.page, 2);
  await recovering.page
    .getByRole("button", { name: "اجرا", exact: true })
    .click();
  await recovering.page.locator(".flow-card.kind-delay.node-running").waitFor();
  await recovering.page.reload();
  await recovering.page.getByText("یک اجرای نیمه‌تمام پیدا شد").waitFor();
  await capture(recovering.page, "recovery-desktop.png");
  await recovering.context.close();

  const mobile = await open({ width: 390, height: 844 });
  await capture(mobile.page, "mobile-dark.png");
  await mobile.page.getByRole("button", { name: "تغییر پوسته" }).click();
  await mobile.page
    .locator(".mobile-switch")
    .getByRole("button", { name: "بلوک‌ها" })
    .click();
  await capture(mobile.page, "mobile-light.png");
  await mobile.context.close();

  assert.deepEqual(errors, [], "Browser reported a runtime error");
} finally {
  await browser.close();
}
