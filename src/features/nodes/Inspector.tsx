import { useState, useEffect, useRef, type ReactNode } from "react";
import {
  Settings2,
  ArrowDownToLine,
  ArrowUpRight,
  Trash2,
  Cable,
  Info,
} from "lucide-react";
import { useApp, isLocked } from "../../app/store";
import {
  labels,
  configSchema,
  type Json,
  type Config,
  uid,
} from "../../lib/model";
import { Field, Status } from "../../components/ui";
import { jsonText, download, toCsv, getPath } from "../../lib/data";
import { connectionIssue } from "../../lib/validation";
import { nodeIcons } from "../editor/FlowCard";
export function JsonField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: Json;
  onChange: (value: Json) => void;
  hint?: string;
}) {
  const [text, setText] = useState(JSON.stringify(value, null, 2));
  const [error, setError] = useState("");
  const emitted = useRef(value);
  useEffect(() => {
    if (JSON.stringify(value) !== JSON.stringify(emitted.current)) {
      setText(JSON.stringify(value, null, 2));
      setError("");
      emitted.current = value;
    }
  }, [value]);
  return (
    <Field label={label} hint={hint}>
      <textarea
        aria-label={label}
        className="code-input"
        dir="ltr"
        spellCheck={false}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          try {
            const parsed: Json = JSON.parse(e.target.value);
            onChange(parsed);
            emitted.current = parsed;
            setError("");
          } catch (error) {
            setError(
              error instanceof SyntaxError
                ? "JSON معتبر نیست؛ آخرین مقدار معتبر حفظ شده است."
                : error instanceof Error
                  ? error.message
                  : "مقدار معتبر نیست.",
            );
          }
        }}
      />
      {error && (
        <small className="error-text" role="alert">
          {error}
        </small>
      )}
    </Field>
  );
}
function RecordField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
}) {
  return (
    <JsonField
      label={label}
      value={value}
      onChange={(v) => {
        if (
          v !== null &&
          typeof v === "object" &&
          !Array.isArray(v) &&
          Object.values(v).every((s) => typeof s === "string")
        )
          onChange(v as Record<string, string>);
        else throw new Error("یک شیء JSON با مقدارهای متنی وارد کن.");
      }}
      hint={'مثال: {"userId": "1"}'}
    />
  );
}
function cellText(value: Json | undefined) {
  return value === undefined
    ? "—"
    : typeof value === "string"
      ? value
      : jsonText(value, 180);
}
export function DataViewer({
  data,
  columns = [],
  view = "json",
}: {
  data: Json | undefined;
  columns?: string[];
  view?: "json" | "table";
}) {
  const [page, setPage] = useState(0);
  if (data === undefined)
    return (
      <div className="data-empty">
        <Info size={20} />
        <p>پس از اجرا، دادهٔ این بلوک اینجا نمایش داده می‌شود.</p>
      </div>
    );
  const rows = Array.isArray(data) ? data : [data];
  const keys = columns.length
    ? columns
    : [
        ...new Set(
          rows
            .slice(0, 100)
            .flatMap((v) =>
              v && typeof v === "object" && !Array.isArray(v)
                ? Object.keys(v)
                : ["value"],
            ),
        ),
      ].slice(0, 30);
  if (view === "json")
    return (
      <pre className="json-view" dir="ltr">
        {jsonText(data)}
      </pre>
    );
  return (
    <div className="table-view">
      <div className="table-scroll">
        <table dir="ltr">
          <thead>
            <tr>
              {keys.map((k) => (
                <th key={k}>{k}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(page * 20, page * 20 + 20).map((row, i) => (
              <tr key={i}>
                {keys.map((k) => (
                  <td key={k} title={jsonText(getPath(row, k))}>
                    {cellText(
                      k === "value" && (row === null || typeof row !== "object")
                        ? row
                        : getPath(row, k),
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="pagination">
        <span>
          {rows.length.toLocaleString("fa")} رکورد · صفحهٔ{" "}
          {(page + 1).toLocaleString("fa")}
        </span>
        <div>
          <button disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            قبلی
          </button>
          <button
            disabled={(page + 1) * 20 >= rows.length}
            onClick={() => setPage((p) => p + 1)}
          >
            بعدی
          </button>
        </div>
      </div>
    </div>
  );
}
export function Inspector() {
  const workflow = useApp((s) => s.workflow),
    selected = useApp((s) => s.selected),
    run = useApp((s) => s.run),
    edit = useApp((s) => s.edit);
  const [tab, setTab] = useState("config");
  const [target, setTarget] = useState(""),
    [port, setPort] = useState<"out" | "true" | "false">("out");
  const node = workflow?.nodes.find((n) => n.id === selected);
  const locked = isLocked();
  if (!node || !workflow)
    return (
      <aside className="inspector">
        <div className="panel-heading">
          <Settings2 size={18} />
          <strong>تنظیمات بلوک</strong>
        </div>
        <div className="inspector-empty">
          <span className="empty-orbit">
            <Settings2 size={28} />
          </span>
          <h3>جزئیات همین‌جا هستند</h3>
          <p>
            یک بلوک را روی بوم انتخاب کن تا تنظیمات، ورودی و خروجی آن را ببینی.
          </p>
          <div className="tips">
            <span>
              <span className="tip-dot" />
              برای شروع، «دریافت پست‌ها» را انتخاب کن
            </span>
            <span>
              <span className="tip-dot" />
              اتصال‌ها مسیر حرکت داده را نشان می‌دهند
            </span>
          </div>
        </div>
        <div className="inspector-note">
          <Info size={17} />
          <p>
            اجرای کامل در مرورگر
            <br />
            <span>بدون سرور، حساب کاربری و کلید API</span>
          </p>
        </div>
      </aside>
    );
  const c = node.config,
    record = run?.nodes[node.id],
    Icon = nodeIcons[c.type];
  const change = (patch: object) =>
    edit((w) => {
      const n = w.nodes.find((n) => n.id === node.id)!;
      n.config = { ...n.config, ...patch } as Config;
    }, true);
  const parsed = configSchema.safeParse(c);
  const controls: ReactNode = (() => {
    switch (c.type) {
      case "input":
        return (
          <>
            <div className="input-presets">
              <span>نمونهٔ آماده</span>
              {[
                { label: "شیء", value: { userId: 1, active: true } },
                {
                  label: "آرایه",
                  value: [
                    { id: 1, value: 20 },
                    { id: 2, value: 10 },
                  ],
                },
                { label: "مقدار ساده", value: false },
              ].map((sample) => (
                <button
                  type="button"
                  key={sample.label}
                  onClick={() => change({ value: sample.value })}
                >
                  {sample.label}
                </button>
              ))}
            </div>
            <JsonField
              key={node.id}
              label="دادهٔ ورودی (JSON)"
              value={c.value}
              onChange={(value) => change({ value })}
              hint="همهٔ مقدارهای JSON، حتی false، صفر و null معتبرند."
            />
          </>
        );
      case "http":
        return (
          <>
            <Field label="نوع اتصال">
              <div className="segmented">
                <button
                  type="button"
                  className={c.transport === "fixture" ? "active" : ""}
                  onClick={() => change({ transport: "fixture" })}
                >
                  دادهٔ آزمایشی
                </button>
                <button
                  type="button"
                  className={c.transport === "live" ? "active" : ""}
                  onClick={() => change({ transport: "live" })}
                >
                  API زنده
                </button>
              </div>
            </Field>
            <p className="transport-note">
              {c.transport === "fixture"
                ? "داده از فایل‌های داخل برنامه می‌آید؛ اینترنت لازم نیست."
                : "درخواست واقعی مرورگر؛ سرویس مقصد باید CORS را مجاز کرده باشد."}
            </p>
            <div className="form-row">
              <Field label="روش">
                <select
                  value={c.method}
                  onChange={(e) => change({ method: e.target.value })}
                >
                  {["GET", "POST", "PUT", "PATCH", "DELETE"].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </Field>
              <Field label="مهلت (ms)">
                <input
                  aria-label="مهلت (ms)"
                  type="number"
                  min={100}
                  max={60000}
                  value={c.timeout}
                  onChange={(e) => change({ timeout: Number(e.target.value) })}
                />
              </Field>
            </div>
            <Field label="آدرس API">
              <input
                dir="ltr"
                value={c.url}
                onChange={(e) => change({ url: e.target.value })}
              />
            </Field>
            <Field label="مسیر پاسخ" hint="خالی = کل پاسخ؛ مثال: data.items">
              <input
                dir="ltr"
                value={c.responsePath}
                onChange={(e) => change({ responsePath: e.target.value })}
              />
            </Field>
            <RecordField
              key={node.id + "query"}
              label="پارامترهای URL (JSON)"
              value={c.query}
              onChange={(query) => change({ query })}
            />
            <details>
              <summary>تنظیمات بیشتر</summary>
              <RecordField
                key={node.id + "headers"}
                label="هدرهای عمومی (JSON)"
                value={c.headers}
                onChange={(headers) => change({ headers })}
              />
              <JsonField
                key={node.id + "body"}
                label="بدنهٔ درخواست (JSON)"
                value={c.body}
                onChange={(body) => change({ body })}
              />
              <JsonField
                key={node.id + "mappings"}
                label="نگاشت از ورودی (JSON)"
                value={c.mappings}
                onChange={(mappings) => {
                  const v = configSchema.safeParse({ ...c, mappings });
                  if (v.success) change({ mappings });
                  else
                    throw new Error(
                      "نگاشت معتبر نیست: " + v.error.issues[0].message,
                    );
                }}
                hint={
                  'مثال: [{"from":"userId","to":"userId","target":"query"}]'
                }
              />
            </details>
            {c.transport === "fixture" && (
              <Field label="سناریوی خطای آزمایشی">
                <select
                  value={c.fault}
                  onChange={(e) => change({ fault: e.target.value })}
                >
                  <option value="none">عادی</option>
                  <option value="http">خطای سرویس (503)</option>
                  <option value="timeout">اتمام مهلت</option>
                  <option value="json">JSON نامعتبر</option>
                </select>
              </Field>
            )}
            {c.method !== "GET" && (
              <p className="warning-text">
                کلید محرمانه وارد نکن. پاسخ نوشتن در JSONPlaceholder نمایشی است
                و دائمی ذخیره نمی‌شود.
              </p>
            )}
          </>
        );
      case "filter":
      case "condition":
        return (
          <>
            <Field
              label="مسیر فیلد"
              hint="مسیر نقطه‌ای مثل user.id؛ خالی برای خود مقدار"
            >
              <input
                dir="ltr"
                value={c.path}
                onChange={(e) => change({ path: e.target.value })}
              />
            </Field>
            <Field label="عملگر">
              <select
                value={c.operator}
                onChange={(e) => change({ operator: e.target.value })}
              >
                <option value="eq">برابر با</option>
                <option value="neq">نابرابر با</option>
                <option value="gt">بزرگ‌تر از</option>
                <option value="lt">کوچک‌تر از</option>
                <option value="contains">شامل</option>
                <option value="exists">وجود دارد</option>
              </select>
            </Field>
            {c.operator !== "exists" && (
              <JsonField
                key={node.id + "rule"}
                label="مقدار مقایسه (JSON)"
                value={c.value}
                onChange={(value) => change({ value })}
                hint={'عدد: 1 · متن: "hello" · بولی: true'}
              />
            )}
            <p className="transport-note">
              {c.type === "filter"
                ? "فیلتر فقط آرایه می‌گیرد. فیلد ناموجود با هیچ عملگر مقایسه‌ای انتخاب نمی‌شود."
                : "فقط مسیر انتخاب‌شده اجرا می‌شود. بلوک‌های مسیر دیگر رد می‌شوند."}
            </p>
          </>
        );
      case "sort":
        return (
          <>
            <Field label="مسیر فیلد">
              <input
                dir="ltr"
                value={c.path}
                onChange={(e) => change({ path: e.target.value })}
              />
            </Field>
            <Field label="جهت">
              <select
                value={c.direction}
                onChange={(e) => change({ direction: e.target.value })}
              >
                <option value="desc">نزولی</option>
                <option value="asc">صعودی</option>
              </select>
            </Field>
            <Field label="نوع مقایسه">
              <select
                value={c.mode}
                onChange={(e) => change({ mode: e.target.value })}
              >
                <option value="number">عددی</option>
                <option value="string">متنی</option>
              </select>
            </Field>
            <p className="transport-note">
              فیلدهای ناموجود یا با نوع نامعتبر همیشه انتهای لیست قرار می‌گیرند.
              ترتیب مقدارهای برابر حفظ می‌شود.
            </p>
          </>
        );
      case "delay":
        return (
          <>
            <Field label="مدت تأخیر (ms)" hint="بین صفر تا ۶۰٬۰۰۰ میلی‌ثانیه">
              <input
                type="number"
                value={c.ms}
                min={0}
                max={60000}
                onChange={(e) => change({ ms: Number(e.target.value) })}
              />
            </Field>
            <p className="transport-note">
              در زمان تأخیر می‌توانی اجرا را لغو کنی. بستن صفحه پردازش را متوقف
              می‌کند؛ بعداً می‌توانی ادامه بدهی.
            </p>
          </>
        );
      case "output":
        return (
          <>
            <Field label="نمایش پیش‌فرض">
              <select
                value={c.view}
                onChange={(e) => change({ view: e.target.value })}
              >
                <option value="table">جدول</option>
                <option value="json">JSON</option>
              </select>
            </Field>
            <Field
              label="ستون‌های جدول"
              hint="نام فیلدها را با ویرگول جدا کن؛ خالی = خودکار"
            >
              <input
                dir="ltr"
                value={c.columns.join(",")}
                onChange={(e) =>
                  change({
                    columns: e.target.value
                      ? e.target.value.split(",").map((s) => s.trim())
                      : [],
                  })
                }
              />
            </Field>
            <p className="transport-note">
              هر صفحه ۲۰ رکورد نمایش می‌دهد. فایل دریافت‌شده شامل همهٔ رکوردها
              است.
            </p>
          </>
        );
    }
  })();
  return (
    <aside className="inspector" key={node.id}>
      <div className="panel-heading">
        <Settings2 size={18} />
        <strong>تنظیمات بلوک</strong>
        <span className="small-muted">{labels[c.type]}</span>
      </div>
      <div className="inspector-title">
        <span className={"node-icon kind-" + c.type}>
          <Icon size={22} />
        </span>
        <div>
          <h3>{node.label}</h3>
          <span className="small-muted">
            {record ? <Status value={record.status} /> : "آمادهٔ تنظیم"}
          </span>
        </div>
      </div>
      <div className="tabs">
        <button
          className={tab === "config" ? "active" : ""}
          onClick={() => setTab("config")}
        >
          تنظیمات
        </button>
        <button
          className={tab === "input" ? "active" : ""}
          onClick={() => setTab("input")}
        >
          ورودی
        </button>
        <button
          className={tab === "output" ? "active" : ""}
          onClick={() => setTab("output")}
        >
          خروجی
        </button>
      </div>
      <div className="inspector-scroll">
        {tab === "config" ? (
          <>
            <fieldset disabled={locked}>
              <Field label="نام بلوک">
                <input
                  value={node.label}
                  onChange={(e) =>
                    edit((w) => {
                      w.nodes.find((n) => n.id === node.id)!.label =
                        e.target.value;
                    }, true)
                  }
                />
              </Field>
              {controls}
            </fieldset>
            {locked && (
              <p className="warning-text">
                تنظیمات هنگام اجرا یا توقف قفل‌اند؛ ابتدا اجرا را لغو کن.
              </p>
            )}
            {!parsed.success && (
              <div className="field-errors" role="alert">
                {parsed.error.issues.map((i, k) => (
                  <p key={k}>
                    {i.path.join(".")} · {i.message}
                  </p>
                ))}
              </div>
            )}
            <div className="connection-form">
              <h4>
                <Cable size={16} /> اتصال بدون کشیدن
              </h4>
              <fieldset disabled={locked || c.type === "output"}>
                {c.type === "condition" && (
                  <Field label="پورت مسیر">
                    <select
                      value={port === "out" ? "true" : port}
                      onChange={(e) =>
                        setPort(e.target.value as "true" | "false")
                      }
                    >
                      <option value="true">درست</option>
                      <option value="false">نادرست</option>
                    </select>
                  </Field>
                )}
                <Field label="بلوک مقصد">
                  <select
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                  >
                    <option value="">انتخاب بلوک…</option>
                    {workflow.nodes
                      .filter(
                        (n) => n.id !== node.id && n.config.type !== "input",
                      )
                      .map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.label}
                        </option>
                      ))}
                  </select>
                </Field>
                <button
                  className="button secondary full"
                  disabled={!target}
                  onClick={() => {
                    const edge = {
                      id: uid(),
                      source: node.id,
                      target,
                      port:
                        c.type === "condition"
                          ? port === "out"
                            ? "true"
                            : port
                          : ("out" as const),
                    };
                    const error = connectionIssue(workflow, edge);
                    if (error) useApp.getState().toast(error);
                    else edit((w) => w.edges.push(edge));
                  }}
                >
                  <ArrowUpRight size={16} /> اتصال بلوک
                </button>
              </fieldset>
              {workflow.edges
                .filter((e) => e.source === node.id)
                .map((e) => (
                  <div className="connection-row" key={e.id}>
                    <span>
                      {e.port === "out"
                        ? "خروجی"
                        : e.port === "true"
                          ? "درست"
                          : "نادرست"}{" "}
                      ← {workflow.nodes.find((n) => n.id === e.target)?.label}
                    </span>
                    <button
                      aria-label="حذف اتصال"
                      disabled={locked}
                      onClick={() =>
                        edit((w) => {
                          w.edges = w.edges.filter((v) => v.id !== e.id);
                        })
                      }
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
            </div>
            <button
              className="text-button danger full"
              disabled={locked}
              onClick={() => {
                edit((w) => {
                  w.nodes = w.nodes.filter((n) => n.id !== node.id);
                  w.edges = w.edges.filter(
                    (e) => e.source !== node.id && e.target !== node.id,
                  );
                });
                useApp.getState().select(undefined);
              }}
            >
              <Trash2 size={16} /> حذف بلوک
            </button>
          </>
        ) : (
          <>
            {record?.error && (
              <div className="error-box">
                <strong>{record.error.message}</strong>
                <p>{record.error.action}</p>
              </div>
            )}
            <DataViewer
              key={run?.id + tab}
              data={tab === "input" ? record?.input : record?.output}
              view={tab === "output" && c.type === "output" ? c.view : "json"}
              columns={c.type === "output" ? c.columns : []}
            />
            {tab === "output" && record?.output !== undefined && (
              <div className="export-actions">
                <button
                  className="button secondary"
                  onClick={() =>
                    download(
                      node.label + ".json",
                      JSON.stringify(record.output, null, 2),
                    )
                  }
                >
                  <ArrowDownToLine size={16} /> JSON
                </button>
                <button
                  className="button secondary"
                  onClick={() =>
                    download(
                      node.label + ".csv",
                      toCsv(
                        record.output!,
                        c.type === "output" ? c.columns : [],
                      ),
                      "text/csv;charset=utf-8",
                    )
                  }
                >
                  <ArrowDownToLine size={16} /> CSV
                </button>
              </div>
            )}
            {record?.startedAt && record?.endedAt && (
              <p className="small-muted">
                زمان این مرحله:{" "}
                {(record.endedAt - record.startedAt).toLocaleString("fa")} ms
              </p>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
