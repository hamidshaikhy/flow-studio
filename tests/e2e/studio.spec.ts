import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
const posts = Array.from({ length: 30 }, (_, i) => ({
  id: i + 1,
  userId: Math.floor(i / 10) + 1,
  title: "Post " + (i + 1),
}));
async function ready(page: Page) {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "اجرا", exact: true }),
  ).toBeEnabled();
}
async function template(page: Page, index: number) {
  await page.getByRole("button", { name: "الگوها", exact: true }).click();
  await page
    .locator(".template-card")
    .nth(index)
    .getByRole("button", { name: "استفاده از الگو" })
    .click();
  await expect(page.locator(".canvas")).toBeVisible();
}
async function node(page: Page, label: string) {
  await page
    .locator(".react-flow__node")
    .filter({ has: page.locator("strong", { hasText: label }) })
    .click();
}
async function success(page: Page) {
  await expect(
    page.getByText("همهٔ مراحل فعال با موفقیت انجام شدند."),
  ).toBeVisible();
}
test("template, node configuration, live request and correct result", async ({
  page,
}) => {
  await ready(page);
  let calls = 0;
  await page.route("https://jsonplaceholder.typicode.com/**", (route) => {
    calls++;
    return route.fulfill({ json: posts });
  });
  await node(page, "دریافت پست‌ها");
  await page.getByRole("button", { name: "API زنده", exact: true }).click();
  await node(page, "پست‌های کاربر اول");
  await page.getByLabel("مقدار مقایسه (JSON)").fill("2");
  await page.getByRole("button", { name: "اجرا", exact: true }).click();
  await success(page);
  expect(calls).toBe(1);
  await page.getByRole("button", { name: "نتیجه", exact: true }).click();
  await expect(page.locator(".result-bar")).toContainText("۱۰ رکورد");
  await expect(page.locator(".console-content tbody tr").first()).toContainText(
    "20",
  );
});
test("keyboard-accessible creation and connection, plus undo/redo", async ({
  page,
}) => {
  await ready(page);
  await page.getByRole("button", { name: "گردش‌کارها", exact: true }).click();
  await page.getByRole("button", { name: "گردش‌کار تازه" }).click();
  await page.getByRole("button", { name: "افزودن خروجی", exact: true }).focus();
  await page.keyboard.press("Enter");
  await node(page, "دادهٔ اولیه");
  await page.getByLabel("بلوک مقصد").selectOption({ label: "خروجی" });
  await page.getByRole("button", { name: "اتصال بلوک", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("button", { name: "اجرا", exact: true }),
  ).toBeEnabled();
  await page.locator(".canvas-header").click();
  await page.keyboard.press("Control+z");
  await expect(
    page.getByRole("button", { name: "اجرا", exact: true }),
  ).toBeDisabled();
  await page.keyboard.press("Control+Shift+z");
  await expect(
    page.getByRole("button", { name: "اجرا", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "اجرا", exact: true }).click();
  await success(page);
});
test("clear canvas confirms, removes every block and connection, then saves", async ({
  page,
}) => {
  await ready(page);
  await expect(page.locator(".react-flow__node")).toHaveCount(5);
  await page.getByRole("button", { name: "پاک‌کردن کل صفحه" }).click();
  await page.getByRole("button", { name: "انصراف" }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(5);

  await page.getByRole("button", { name: "پاک‌کردن کل صفحه" }).click();
  await page.getByRole("button", { name: "پاک‌کردن همهٔ بلوک‌ها" }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(0);
  await expect(page.locator(".react-flow__edge")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "پاک‌کردن کل صفحه" }),
  ).toBeDisabled();

  await page.getByRole("button", { name: "بازگردانی (Ctrl+Z)" }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(5);
  await expect(page.locator(".react-flow__edge")).toHaveCount(4);
  await page
    .getByRole("button", { name: "انجام دوباره (Ctrl+Shift+Z)" })
    .click();
  await expect(page.locator(".react-flow__node")).toHaveCount(0);
  await expect(page.locator(".save-indicator")).toContainText("ذخیره شد");
  await page.reload();
  await expect(page.locator(".react-flow__node")).toHaveCount(0);
  await page.getByRole("button", { name: "افزودن ورودی" }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(1);
});
test("new complex templates open and run with local fixture data", async ({
  page,
}) => {
  await ready(page);
  for (const [index, count] of [
    [3, 7],
    [4, 10],
    [5, 11],
  ]) {
    await template(page, index);
    await expect(page.locator(".react-flow__node")).toHaveCount(count);
    await page.getByRole("button", { name: "اجرا", exact: true }).click();
    await success(page);
  }
});
test("both condition outcomes, skipped branch never requests API", async ({
  page,
}) => {
  await ready(page);
  await template(page, 1);
  let calls = 0;
  await page.route("https://jsonplaceholder.typicode.com/**", (r) => {
    calls++;
    return r.fulfill({ json: posts });
  });
  await node(page, "دریافت پست‌ها");
  await page.getByRole("button", { name: "API زنده", exact: true }).click();
  await page.getByRole("button", { name: "اجرا", exact: true }).click();
  await success(page);
  expect(calls).toBe(1);
  await expect(page.locator(".flow-card.kind-delay")).toHaveClass(
    /node-skipped/,
  );
  await node(page, "دادهٔ اولیه");
  await page.getByLabel("دادهٔ ورودی (JSON)").fill('{"active":false}');
  await page.getByRole("button", { name: "اجرا", exact: true }).click();
  await success(page);
  expect(calls).toBe(1);
  await expect(page.locator(".flow-card.kind-http")).toHaveClass(
    /node-skipped/,
  );
});
test("controlled failure exposes useful error and downstream stays pending", async ({
  page,
}) => {
  await ready(page);
  await node(page, "دریافت پست‌ها");
  await page.getByLabel("سناریوی خطای آزمایشی").selectOption("http");
  await page.getByRole("button", { name: "اجرا", exact: true }).click();
  await expect(page.locator(".flow-card.kind-http")).toHaveClass(/node-failed/);
  await page
    .locator(".inspector")
    .getByRole("button", { name: "خروجی", exact: true })
    .click();
  await expect(page.locator(".error-box")).toContainText("503");
  await expect(page.locator(".flow-card.kind-filter")).toHaveClass(
    /node-pending/,
  );
});
test("reload resumes durable snapshot without repeating committed requests", async ({
  page,
}) => {
  await ready(page);
  await template(page, 2);
  let calls = 0;
  await page.route("https://jsonplaceholder.typicode.com/**", (r) => {
    calls++;
    return r.fulfill({ json: posts });
  });
  await node(page, "دریافت پست‌ها");
  await page.getByRole("button", { name: "API زنده", exact: true }).click();
  await node(page, "فرصت بازیابی");
  await page.getByLabel("مدت تأخیر (ms)").fill("1800");
  await page.getByRole("button", { name: "اجرا", exact: true }).click();
  await expect(page.locator(".flow-card.kind-delay")).toHaveClass(
    /node-running/,
  );
  await page.reload();
  await expect(page.getByText("یک اجرای نیمه‌تمام پیدا شد")).toBeVisible();
  await page.screenshot({ path: "docs/screenshots/recovery-desktop.png" });
  await page.getByRole("button", { name: "ادامهٔ اجرای ذخیره‌شده" }).click();
  await success(page);
  expect(calls).toBe(1);
  await expect(page.locator(".flow-card.kind-http")).toHaveClass(
    /node-succeeded/,
  );
});
test("cancel aborts a slow run and late responses cannot overwrite it", async ({
  page,
}) => {
  await ready(page);
  let releaseResponse!: () => void;
  let requestStarted!: () => void;
  let responseSettled!: () => void;
  const responseHeld = new Promise<void>((resolve) => {
    releaseResponse = resolve;
  });
  const requestSeen = new Promise<void>((resolve) => {
    requestStarted = resolve;
  });
  const responseDone = new Promise<void>((resolve) => {
    responseSettled = resolve;
  });
  await page.route("https://jsonplaceholder.typicode.com/**", async (r) => {
    requestStarted();
    await responseHeld;
    await r.fulfill({ json: posts }).catch(() => {});
    responseSettled();
  });
  await node(page, "دریافت پست‌ها");
  await page.getByRole("button", { name: "API زنده", exact: true }).click();
  await page.getByRole("button", { name: "اجرا", exact: true }).click();
  await expect(page.locator(".flow-card.kind-http")).toHaveClass(
    /node-running/,
  );
  await requestSeen;
  await page.getByRole("button", { name: "لغو اجرا", exact: true }).click();
  await expect(page.locator(".console-header .status")).toHaveText("لغوشده");
  releaseResponse();
  await responseDone;
  await expect(page.locator(".console-header .status")).toHaveText("لغوشده");
  await expect(page.locator(".flow-card.kind-http")).toHaveClass(
    /node-cancelled/,
  );
});
test("export/import roundtrip and malformed import preserves existing documents", async ({
  page,
}) => {
  await ready(page);
  const promise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "دریافت فایل گردش‌کار", exact: true })
    .click();
  const dl = await promise;
  const buffer = await readFile((await dl.path())!);
  await page.getByRole("button", { name: "گردش‌کارها", exact: true }).click();
  await page.getByLabel("فایل گردش‌کار", { exact: true }).setInputFiles({
    name: "workflow.json",
    mimeType: "application/json",
    buffer,
  });
  await expect(page.locator(".workflow-name")).toContainText("(واردشده)");
  await page.getByRole("button", { name: "گردش‌کارها", exact: true }).click();
  await expect(page.locator(".workflow-list article")).toHaveCount(2);
  await page.getByLabel("فایل گردش‌کار", { exact: true }).setInputFiles({
    name: "broken.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"schemaVersion":99}'),
  });
  await expect(page.locator(".toast")).toContainText("معتبر نیست");
  await expect(page.locator(".workflow-list article")).toHaveCount(2);
});
test("theme is persistent and narrow layout has usable configuration", async ({
  page,
}) => {
  await ready(page);
  await page.getByRole("button", { name: "تغییر پوسته", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .locator(".mobile-switch")
    .getByRole("button", { name: "بلوک‌ها", exact: true })
    .click();
  await page.getByRole("button", { name: "افزودن تأخیر", exact: true }).click();
  await expect(page.getByLabel("مدت تأخیر (ms)")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "docs/screenshots/mobile-light.png" });
});
test("single-node step controls and command palette work", async ({ page }) => {
  await ready(page);
  await page.keyboard.press("Control+k");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "اجرای تک‌مرحله‌ای", exact: true })
    .click();
  await expect(page.locator(".console-header .status")).toHaveText("متوقف");
  await expect(page.locator(".flow-card.kind-input")).toHaveClass(
    /node-succeeded/,
  );
  await expect(page.locator(".flow-card.kind-http")).toHaveClass(
    /node-pending/,
  );
  await page
    .getByRole("button", { name: "اجرای مرحلهٔ بعد", exact: true })
    .click();
  await expect(page.locator(".flow-card.kind-http")).toHaveClass(
    /node-succeeded/,
  );
  await page.getByRole("button", { name: "ادامهٔ اجرا", exact: true }).click();
  await success(page);
});
test("another tab cannot claim a live execution", async ({ page, context }) => {
  await ready(page);
  await template(page, 2);
  await page.getByRole("button", { name: "اجرا", exact: true }).click();
  await expect(page.locator(".flow-card.kind-delay")).toHaveClass(
    /node-running/,
  );
  const other = await context.newPage();
  await ready(other);
  await other.getByRole("button", { name: "اجرا", exact: true }).click();
  await expect(other.locator(".toast")).toContainText("زبانهٔ دیگر");
  await page.getByRole("button", { name: "لغو اجرا", exact: true }).click();
});
test("uncertain POST recovery requires an explicit decision", async ({
  page,
}) => {
  await ready(page);
  let calls = 0;
  await page.route("https://jsonplaceholder.typicode.com/**", async (r) => {
    calls++;
    if (calls === 1) await new Promise((resolve) => setTimeout(resolve, 1500));
    await r.fulfill({ json: posts }).catch(() => {});
  });
  await node(page, "دریافت پست‌ها");
  await page.getByRole("button", { name: "API زنده", exact: true }).click();
  await page.getByLabel("روش", { exact: true }).selectOption("POST");
  await page.getByRole("button", { name: "اجرا", exact: true }).click();
  await expect(page.locator(".flow-card.kind-http")).toHaveClass(
    /node-running/,
  );
  await expect.poll(() => calls).toBe(1);
  await page.reload();
  await page.getByRole("button", { name: "ادامهٔ اجرای ذخیره‌شده" }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "ممکن است درخواست نوشتن قبلاً",
  );
  expect(calls).toBe(1);
  await page.getByRole("button", { name: "فعلاً ادامه نده" }).click();
  expect(calls).toBe(1);
  await page.getByRole("button", { name: "ادامهٔ اجرای ذخیره‌شده" }).click();
  await page
    .getByRole("button", { name: "ریسک تکرار را می‌پذیرم؛ ادامه بده" })
    .click();
  await success(page);
  expect(calls).toBe(2);
});
test("storage failure pauses before any HTTP operation, then can recover", async ({
  page,
}) => {
  await ready(page);
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    (window as Window & { restoreStorage?: () => void }).restoreStorage =
      () => {
        IDBObjectStore.prototype.put = original;
      };
    IDBObjectStore.prototype.put = function () {
      throw new DOMException("storage full", "QuotaExceededError");
    };
  });
  await page.getByRole("button", { name: "اجرا", exact: true }).click();
  await expect(page.locator(".console-header .status")).toHaveText("متوقف");
  await expect(page.locator(".storage-error")).toContainText("ذخیره‌سازی");
  await expect(page.locator(".flow-card.kind-http")).toHaveClass(
    /node-pending/,
  );
  await page.evaluate(() =>
    (window as Window & { restoreStorage?: () => void }).restoreStorage?.(),
  );
  await page.getByRole("button", { name: "ادامهٔ اجرا", exact: true }).click();
  await success(page);
});
test("built static assets work beneath a repository subpath", async ({
  page,
}) => {
  const types: Record<string, string> = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".css": "text/css",
    ".svg": "image/svg+xml",
    ".woff2": "font/woff2",
    ".woff": "font/woff",
  };
  await page.route("**/portfolio/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace(
      "/portfolio/",
      "",
    );
    if (path.includes("..")) return route.abort();
    try {
      const file = resolve("dist", path || "index.html");
      return route.fulfill({
        body: await readFile(file),
        contentType: types[extname(file)] ?? "application/octet-stream",
      });
    } catch {
      return route.fulfill({ status: 404 });
    }
  });
  await page.goto("/portfolio/#guide");
  await expect(
    page.getByRole("heading", { name: "راهنمای استودیو." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "ویرایشگر", exact: true }).click();
  await page.getByRole("button", { name: "اجرا", exact: true }).click();
  await success(page);
});
test("capture real portfolio views and check browser errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await ready(page);
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator(".react-flow__node")).toHaveCount(5);
  await expect(page.locator(".react-flow__minimap-node")).toHaveCount(5);
  await page.screenshot({ path: "docs/screenshots/editor-desktop.png" });
  await node(page, "دریافت پست‌ها");
  await page.screenshot({ path: "docs/screenshots/inspector-desktop.png" });
  await page.getByRole("button", { name: "اجرا", exact: true }).click();
  await success(page);
  await page.getByRole("button", { name: "نتیجه", exact: true }).click();
  await page.screenshot({ path: "docs/screenshots/results-desktop.png" });
  await page.getByRole("button", { name: "گردش‌کارها", exact: true }).click();
  await expect(page.locator(".template-card")).toHaveCount(6);
  await page.screenshot({ path: "docs/screenshots/library-desktop.png" });
  await page.getByRole("button", { name: "ویرایشگر", exact: true }).click();
  await node(page, "دریافت پست‌ها");
  await page.getByLabel("سناریوی خطای آزمایشی").selectOption("http");
  await page.getByRole("button", { name: "اجرا", exact: true }).click();
  await expect(page.locator(".flow-card.kind-http")).toHaveClass(/node-failed/);
  await page
    .locator(".inspector")
    .getByRole("button", { name: "خروجی", exact: true })
    .click();
  await page.screenshot({ path: "docs/screenshots/error-desktop.png" });
  expect(errors).toEqual([]);
});
