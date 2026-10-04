import { FlowError, jsonSchema, type Config, type Json } from "./model";
import { getPath } from "./data";
export type HttpConfig = Extract<Config, { type: "http" }>;
export type HttpAdapter = (
  c: HttpConfig,
  input: Json,
  signal: AbortSignal,
) => Promise<Json>;
export const posts: Json = Array.from({ length: 100 }, (_, i) => ({
  userId: Math.floor(i / 10) + 1,
  id: i + 1,
  title:
    [
      "معماری ساده، نتیجهٔ قابل اعتماد",
      "از داده تا تصمیم",
      "یک روز در استودیوی گردش‌کار",
      "جزئیات کوچک، تجربهٔ بهتر",
      "خروجی شفاف برای توسعه‌دهنده",
    ][i % 5] +
    " " +
    (i + 1),
  body: "این رکورد دادهٔ آزمایشی محلی است؛ پاسخ یک API زنده نیست.",
}));
export function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted)
      return reject(new FlowError("CANCELLED", "اجرا لغو شد."));
    const abort = () => {
      clearTimeout(timer);
      reject(new FlowError("CANCELLED", "اجرا لغو شد."));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, ms);
    signal.addEventListener("abort", abort, { once: true });
  });
}
export function mappedRequest(c: HttpConfig, input: Json) {
  const url = new URL(c.url);
  const query = { ...c.query };
  let body = c.body;
  for (const m of c.mappings) {
    const v = getPath(input, m.from);
    if (v === undefined)
      throw new FlowError("MAPPING", `فیلد «${m.from}» در ورودی وجود ندارد.`);
    if (m.target === "query")
      query[m.to] = typeof v === "object" ? JSON.stringify(v) : String(v);
    else {
      if (["__proto__", "constructor", "prototype"].includes(m.to))
        throw new FlowError("PATH", "نام فیلد مقصد ناامن است.");
      body = {
        ...(body && typeof body === "object" && !Array.isArray(body)
          ? body
          : {}),
        [m.to]: v,
      };
    }
  }
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  return { url: url.href, body };
}
export const httpAdapter: HttpAdapter = async (c, input, signal) => {
  const req = mappedRequest(c, input);
  if (c.transport === "fixture") {
    await sleep(c.fault === "timeout" ? Math.min(c.timeout, 500) : 220, signal);
    if (c.fault === "timeout")
      throw new FlowError(
        "TIMEOUT",
        "مهلت درخواست آزمایشی تمام شد.",
        "سناریوی خطا را خاموش کن یا مهلت را افزایش بده.",
      );
    if (c.fault === "http")
      throw new FlowError(
        "HTTP_503",
        "سرویس آزمایشی پاسخ 503 داد.",
        "سناریوی خطا را به حالت عادی برگردان.",
      );
    if (c.fault === "json")
      throw new FlowError(
        "JSON",
        "پاسخ آزمایشی JSON معتبر نیست.",
        "سناریوی خطا را خاموش کن.",
      );
    const params = new URL(req.url).searchParams;
    const fixturePosts = (posts as Json[]).filter((row) =>
      ["userId", "id"].every(
        (key) =>
          !params.has(key) || String(getPath(row, key)) === params.get(key),
      ),
    );
    const output: Json =
      c.method === "GET"
        ? fixturePosts
        : {
            ...(req.body &&
            typeof req.body === "object" &&
            !Array.isArray(req.body)
              ? req.body
              : {}),
            id: 101,
          };
    const selected = getPath(output, c.responsePath);
    if (selected === undefined)
      throw new FlowError("PATH", "مسیر انتخاب پاسخ پیدا نشد.");
    return structuredClone(selected);
  }
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort();
  signal.addEventListener("abort", abort, { once: true });
  if (signal.aborted) controller.abort();
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, c.timeout);
  try {
    const response = await fetch(req.url, {
      method: c.method,
      headers: {
        ...(req.body !== null && c.method !== "GET"
          ? { "Content-Type": "application/json" }
          : {}),
        ...c.headers,
      },
      body:
        c.method === "GET" || req.body === null
          ? undefined
          : JSON.stringify(req.body),
      signal: controller.signal,
    });
    if (!response.ok)
      throw new FlowError(
        "HTTP_" + response.status,
        `سرور پاسخ ${response.status} داد.`,
        "آدرس، روش و پارامترهای درخواست را بررسی کن.",
      );
    if (response.status === 204) return null;
    const contentType = response.headers.get("content-type");
    if (contentType && !/application\/(?:[\w.-]+\+)?json/i.test(contentType))
      throw new FlowError(
        "CONTENT_TYPE",
        "سرویس پاسخ را با قالب JSON نفرستاده است.",
        "این بلوک برای APIهای JSON طراحی شده؛ آدرس و نوع پاسخ را بررسی کن.",
      );
    const text = await response.text();
    if (text.length > 2_000_000)
      throw new FlowError(
        "SIZE",
        "پاسخ بیشتر از ۲ مگابایت است.",
        "از پارامترهای محدودسازی API استفاده کن.",
      );
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new FlowError(
        "JSON",
        "پاسخ سرور JSON معتبر نیست.",
        "آدرس و قالب پاسخ سرویس را بررسی کن.",
      );
    }
    const valid = jsonSchema.safeParse(parsed);
    if (!valid.success) throw new FlowError("JSON", "محتوای پاسخ معتبر نیست.");
    const selected = getPath(valid.data, c.responsePath);
    if (selected === undefined)
      throw new FlowError("PATH", "مسیر پاسخ پیدا نشد.");
    return selected;
  } catch (e) {
    if (timedOut)
      throw new FlowError(
        "TIMEOUT",
        "مهلت دریافت پاسخ تمام شد.",
        "مهلت یا اتصال اینترنت را بررسی کن.",
      );
    if (signal.aborted)
      throw new FlowError(
        "CANCELLED",
        "درخواست لغو شد.",
        "درخواست پردازش‌شده در سرور قابل بازگرداندن نیست.",
      );
    if (e instanceof FlowError) throw e;
    throw new FlowError(
      "NETWORK",
      "مرورگر نتوانست پاسخ را دریافت کند.",
      "اتصال اینترنت و مجوز CORS سرویس را بررسی کن؛ علت دقیق همیشه از مرورگر مشخص نیست.",
    );
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", abort);
  }
};
