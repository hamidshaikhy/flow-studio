import { describe, it, expect, vi, afterEach } from "vitest";
import { httpAdapter, mappedRequest, sleep, type HttpConfig } from "./http";
import { defaultConfig } from "./model";
const c = {
  ...defaultConfig("http"),
  transport: "live",
  timeout: 1000,
} as HttpConfig;
afterEach(() => vi.unstubAllGlobals());
describe("HTTP adapter", () => {
  it("maps input fields without losing zero or false", () => {
    const r = mappedRequest(
      {
        ...c,
        mappings: [
          { from: "id", to: "userId", target: "query" },
          { from: "active", to: "active", target: "body" },
        ],
      },
      { id: 0, active: false },
    );
    expect(r.url).toContain("userId=0");
    expect(r.body).toEqual({ active: false });
  });
  it("rejects missing mappings and dangerous destinations", () => {
    expect(() =>
      mappedRequest(
        { ...c, mappings: [{ from: "missing", to: "id", target: "query" }] },
        {},
      ),
    ).toThrow("وجود ندارد");
    expect(() =>
      mappedRequest(
        { ...c, mappings: [{ from: "id", to: "constructor", target: "body" }] },
        { id: 1 },
      ),
    ).toThrow("ناامن");
  });
  it("reads successful JSON and selection paths", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ items: [1, 2] }), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
      ),
    );
    expect(
      await httpAdapter(
        { ...c, responsePath: "items" },
        null,
        new AbortController().signal,
      ),
    ).toEqual([1, 2]);
  });
  it("handles 204 without JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 204 })),
    );
    expect(await httpAdapter(c, null, new AbortController().signal)).toBe(null);
  });
  it("reports non-2xx and malformed responses distinctly", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("error", { status: 503 })),
    );
    await expect(
      httpAdapter(c, null, new AbortController().signal),
    ).rejects.toMatchObject({ code: "HTTP_503" });
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response("<html>", {
            headers: { "content-type": "application/json" },
          }),
      ),
    );
    await expect(
      httpAdapter(c, null, new AbortController().signal),
    ).rejects.toMatchObject({ code: "JSON" });
  });
  it("reports non-JSON content types", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response("<html>", { headers: { "content-type": "text/html" } }),
      ),
    );
    await expect(
      httpAdapter(c, null, new AbortController().signal),
    ).rejects.toMatchObject({ code: "CONTENT_TYPE" });
  });
  it("stops reading a response once it exceeds the byte limit", async () => {
    let cancelled = false;
    const response = new Response(
      new ReadableStream<Uint8Array>({
        pull(controller) {
          controller.enqueue(new Uint8Array(1_000_001));
        },
        cancel() {
          cancelled = true;
        },
      }),
      { headers: { "content-type": "application/json" } },
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => response),
    );
    await expect(
      httpAdapter(c, null, new AbortController().signal),
    ).rejects.toMatchObject({ code: "SIZE" });
    expect(cancelled).toBe(true);
  });
  it("rejects oversized content before opening the response stream", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response("[]", {
            headers: {
              "content-length": "2000001",
              "content-type": "application/json",
            },
          }),
      ),
    );
    await expect(
      httpAdapter(c, null, new AbortController().signal),
    ).rejects.toMatchObject({ code: "SIZE" });
  });
  it("reports unknown network causes without asserting CORS", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    await expect(
      httpAdapter(c, null, new AbortController().signal),
    ).rejects.toMatchObject({ code: "NETWORK" });
  });
  it("times out and cleans up the in-flight request", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url, init) =>
          new Promise((_resolve, reject) =>
            init.signal.addEventListener("abort", () =>
              reject(new Error("abort")),
            ),
          ),
      ),
    );
    await expect(
      httpAdapter({ ...c, timeout: 5 }, null, new AbortController().signal),
    ).rejects.toMatchObject({ code: "TIMEOUT" });
  });
  it("distinguishes explicit cancellation", async () => {
    const a = new AbortController();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url, init) =>
          new Promise((_resolve, reject) =>
            init.signal.addEventListener("abort", () =>
              reject(new Error("abort")),
            ),
          ),
      ),
    );
    const p = httpAdapter(c, null, a.signal);
    a.abort();
    await expect(p).rejects.toMatchObject({ code: "CANCELLED" });
  });
  it("fixture mode never calls fetch and has controlled faults", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const fixture = { ...c, transport: "fixture" as const };
    const result = await httpAdapter(
      fixture,
      null,
      new AbortController().signal,
    );
    expect(Array.isArray(result) && result.length).toBe(100);
    expect(fetch).not.toHaveBeenCalled();
    await expect(
      httpAdapter(
        { ...fixture, fault: "http" },
        null,
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: "HTTP_503" });
    await expect(
      httpAdapter(
        { ...fixture, fault: "json" },
        null,
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: "JSON" });
  });
  it("cancels delay including an already-aborted signal", async () => {
    const a = new AbortController();
    const p = sleep(1000, a.signal);
    a.abort();
    await expect(p).rejects.toMatchObject({ code: "CANCELLED" });
    await expect(sleep(1, a.signal)).rejects.toMatchObject({
      code: "CANCELLED",
    });
  });
});
