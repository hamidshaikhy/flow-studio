import {
  clone,
  FlowError,
  faultOf,
  uid,
  type Json,
  type Run,
  type Workflow,
  type FlowNode,
} from "./model";
import { validate, order } from "./validation";
import { filterData, sortData, matches } from "./data";
import { httpAdapter, sleep, type HttpAdapter } from "./http";

export interface EngineDeps {
  save: (run: Run) => Promise<void>;
  http: HttpAdapter;
  wait: (ms: number, signal: AbortSignal) => Promise<void>;
  now: () => number;
  change: (run: Run) => void;
}
export function interrupted(run: Run): Run {
  const next = clone(run);
  if (next.status === "running") next.status = "interrupted";
  for (const [id, r] of Object.entries(next.nodes))
    if (r.status === "running") {
      r.status = "interrupted";
      const c = next.workflow.nodes.find((n) => n.id === id)?.config;
      r.uncertain = c?.type === "http" && c.method !== "GET";
    }
  return next;
}
export class Engine {
  current?: Run;
  private controller?: AbortController;
  private busy = false;
  private pauseRequested = false;
  private cancelled = false;
  private deps: EngineDeps;
  constructor(deps: Partial<EngineDeps> & Pick<EngineDeps, "save" | "change">) {
    this.deps = { http: httpAdapter, wait: sleep, now: Date.now, ...deps };
  }
  private async commit(next: Run): Promise<boolean> {
    next.updatedAt = this.deps.now();
    next.events = next.events.slice(-500);
    try {
      await this.deps.save(clone(next));
      this.current = next;
      this.deps.change(clone(next));
      return true;
    } catch (e) {
      if (!this.current) this.current = next;
      const failed = interrupted(this.current);
      failed.status = "paused";
      failed.error = faultOf(e);
      this.current = failed;
      this.deps.change(clone(failed));
      return false;
    }
  }
  async start(w: Workflow, step = false): Promise<void> {
    if (
      this.busy ||
      (this.current && ["running", "paused"].includes(this.current.status))
    )
      throw new FlowError(
        "BUSY",
        "یک اجرا در حال انجام است.",
        "ابتدا آن اجرا را ادامه بده یا لغو کن.",
      );
    const issues = validate(w);
    if (issues.length)
      throw new FlowError("VALIDATION", issues[0].message, issues[0].action);
    this.pauseRequested = false;
    this.cancelled = false;
    const now = this.deps.now();
    const run: Run = {
      schemaVersion: 1,
      id: uid(),
      workflow: clone(w),
      status: "running",
      nodes: Object.fromEntries(
        w.nodes.map((n) => [n.id, { status: "pending" }]),
      ),
      events: [
        {
          time: now,
          message: step ? "اجرای تک‌مرحله‌ای آغاز شد." : "اجرا آغاز شد.",
          level: "info",
        },
      ],
      startedAt: now,
      updatedAt: now,
    };
    this.busy = true;
    try {
      if (await this.commit(run)) await this.pump(step);
    } finally {
      this.busy = false;
    }
  }
  async resume(run: Run, step = false, allowUnsafe = false): Promise<void> {
    if (this.busy)
      throw new FlowError("BUSY", "موتور هنوز به مرز توقف نرسیده است.");
    if (!["paused", "interrupted"].includes(run.status))
      throw new FlowError("STATE", "این اجرا قابل ادامه نیست.");
    const restored = interrupted(run);
    if (Object.values(restored.nodes).some((r) => r.uncertain) && !allowUnsafe)
      throw new FlowError(
        "UNCERTAIN",
        "نتیجهٔ درخواست قبلی مشخص نیست.",
        "تکرار درخواست ممکن است عملیات سرور را دوباره انجام دهد؛ تصمیم صریح لازم است.",
      );
    for (const r of Object.values(restored.nodes))
      if (r.status === "running" || r.status === "interrupted") {
        r.status = "pending";
        delete r.error;
        delete r.uncertain;
      }
    restored.status = "running";
    delete restored.error;
    restored.events.push({
      time: this.deps.now(),
      message: "ادامه از آخرین نقطهٔ ثبت‌شده؛ بلوک‌های موفق تکرار نمی‌شوند.",
      level: "info",
    });
    this.pauseRequested = false;
    this.cancelled = false;
    this.busy = true;
    try {
      if (await this.commit(restored)) await this.pump(step);
    } finally {
      this.busy = false;
    }
  }
  pause() {
    if (this.current?.status === "running") {
      this.pauseRequested = true;
    }
  }
  async cancel() {
    if (
      !this.current ||
      !["running", "paused", "interrupted"].includes(this.current.status)
    )
      return;
    this.cancelled = true;
    this.controller?.abort();
    if (!this.busy) await this.endCancel();
  }
  private async endCancel() {
    if (!this.current) return;
    const next = clone(this.current);
    next.status = "cancelled";
    next.endedAt = this.deps.now();
    for (const r of Object.values(next.nodes))
      if (["running", "pending", "interrupted"].includes(r.status))
        r.status = "cancelled";
    next.events.push({
      time: this.deps.now(),
      message: "اجرا لغو شد. درخواست پردازش‌شده در سرور بازگردانده نمی‌شود.",
      level: "info",
    });
    await this.commit(next);
  }
  private async operate(
    node: FlowNode,
    input: Json,
    signal: AbortSignal,
  ): Promise<{ output: Json; branch?: "true" | "false" }> {
    const c = node.config;
    switch (c.type) {
      case "input":
        return { output: clone(c.value) };
      case "http":
        return { output: await this.deps.http(c, input, signal) };
      case "filter":
        return { output: filterData(input, c) };
      case "sort":
        return { output: sortData(input, c) };
      case "condition":
        return { output: input, branch: matches(input, c) ? "true" : "false" };
      case "delay":
        await this.deps.wait(c.ms, signal);
        return { output: input };
      case "output":
        return { output: input };
    }
  }
  private async pump(step: boolean) {
    if (!this.current) return;
    const sorted = order(this.current.workflow);
    let count = 0;
    for (const id of sorted) {
      if (this.cancelled) {
        await this.endCancel();
        return;
      }
      if (this.pauseRequested || (step && count >= 1)) {
        const next = clone(this.current!);
        next.status = "paused";
        next.events.push({
          time: this.deps.now(),
          message: "اجرا در مرز بلوک متوقف شد.",
          level: "info",
        });
        await this.commit(next);
        return;
      }
      const run = this.current!,
        node = run.workflow.nodes.find((n) => n.id === id)!;
      if (run.nodes[id].status !== "pending") continue;
      const edge = run.workflow.edges.find((e) => e.target === id),
        parent = edge ? run.nodes[edge.source] : undefined;
      if (
        parent &&
        (parent.status === "skipped" ||
          (parent.branch && parent.branch !== edge!.port))
      ) {
        const next = clone(run);
        next.nodes[id] = { status: "skipped", endedAt: this.deps.now() };
        next.events.push({
          time: this.deps.now(),
          nodeId: id,
          message: "مسیر غیرفعال؛ بلوک اجرا نشد.",
          level: "info",
        });
        if (!(await this.commit(next))) return;
        continue;
      }
      if (parent && parent.status !== "succeeded")
        throw new FlowError("DEPENDENCY", "وابستگی این بلوک آماده نیست.");
      const input = parent?.output === undefined ? null : clone(parent.output);
      const next = clone(run);
      next.nodes[id] = { status: "running", input, startedAt: this.deps.now() };
      next.events.push({
        time: this.deps.now(),
        nodeId: id,
        message: `${node.label} — آغاز`,
        level: "info",
      });
      if (!(await this.commit(next))) return;
      this.controller = new AbortController();
      try {
        const result = await this.operate(node, input, this.controller.signal);
        if (this.cancelled) {
          await this.endCancel();
          return;
        }
        const done = clone(this.current!);
        if (JSON.stringify(result.output).length > 2_000_000)
          throw new FlowError(
            "SIZE",
            "خروجی بلوک بیشتر از ۲ مگابایت است.",
            "اندازهٔ داده را در مبدأ محدود کن.",
          );
        done.nodes[id] = {
          ...done.nodes[id],
          ...result,
          status: "succeeded",
          endedAt: this.deps.now(),
        };
        done.events.push({
          time: this.deps.now(),
          nodeId: id,
          message: `${node.label} — موفق${result.branch ? "؛ مسیر " + (result.branch === "true" ? "درست" : "نادرست") : ""}`,
          level: "success",
        });
        if (JSON.stringify(done).length > 12_000_000)
          throw new FlowError(
            "SIZE",
            "حجم تاریخچهٔ اجرا از ۱۲ مگابایت بیشتر شد.",
            "گردش‌کار کوچک‌تری بساز.",
          );
        if (!(await this.commit(done))) return;
        count++;
      } catch (e) {
        if (this.cancelled) {
          await this.endCancel();
          return;
        }
        const failed = clone(this.current!);
        failed.nodes[id] = {
          ...failed.nodes[id],
          status: "failed",
          endedAt: this.deps.now(),
          error: faultOf(e),
        };
        failed.status = "failed";
        failed.endedAt = this.deps.now();
        failed.error = faultOf(e);
        failed.events.push({
          time: this.deps.now(),
          nodeId: id,
          message: faultOf(e).message,
          level: "error",
        });
        await this.commit(failed);
        return;
      } finally {
        this.controller = undefined;
      }
    }
    if (this.cancelled) {
      await this.endCancel();
      return;
    }
    const done = clone(this.current!);
    done.status = "succeeded";
    done.endedAt = this.deps.now();
    done.events.push({
      time: this.deps.now(),
      message: "همهٔ مراحل فعال با موفقیت انجام شدند.",
      level: "success",
    });
    await this.commit(done);
  }
}
