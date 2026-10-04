import { useState, useRef } from "react";
import {
  Plus,
  Search,
  ArrowUpRight,
  Copy,
  Trash2,
  Pencil,
  Upload,
  GitBranch,
  Globe,
  Timer,
  ArrowLeft,
  ListFilter,
  Route,
  Network,
  type LucideIcon,
} from "lucide-react";
import {
  useApp,
  createWorkflow,
  removeWorkflow,
  isLocked,
  flushSave,
} from "../../app/store";
import { templates, fromTemplate } from "../../lib/templates";
import { importWorkflow } from "../../lib/validation";
import { uid, type Workflow } from "../../lib/model";
import { Modal, IconButton, Field } from "../../components/ui";
const templatePresentation: Record<
  string,
  { icon: LucideIcon; badge: string }
> = {
  public: { icon: Globe, badge: "API زنده" },
  conditional: { icon: GitBranch, badge: "منطق شرطی" },
  recovery: { icon: Timer, badge: "بدون اینترنت" },
  "multi-filter": { icon: ListFilter, badge: "پالایش چندمرحله‌ای" },
  "priority-routes": { icon: Route, badge: "دو مسیر" },
  "nested-decisions": { icon: Network, badge: "سه خروجی" },
};
export function Library({ templatePage = false }: { templatePage?: boolean }) {
  const workflows = useApp((s) => s.workflows),
    [query, setQuery] = useState(""),
    [deleting, setDeleting] = useState<Workflow>(),
    [renaming, setRenaming] = useState<Workflow>(),
    [name, setName] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const locked = isLocked();
  return (
    <main className="page library-page">
      <div className="page-eyebrow">
        {templatePage ? "از یک ایدهٔ آماده شروع کن" : "فضای کار شخصی"}
      </div>
      <div className="page-heading">
        <div>
          <h1>
            {templatePage ? "الگوهای گردش‌کار" : "گردش‌کارهای من"}
            <span className="heading-dot">.</span>
          </h1>
          <p>
            {templatePage
              ? "چند مسیر آماده برای یادگرفتن، آزمایش‌کردن و ساختن."
              : "ایده‌هایت را به جریان داده تبدیل کن. همه‌چیز همین‌جا ذخیره می‌شود."}
          </p>
        </div>
        <button
          className="button primary"
          disabled={locked}
          onClick={() => void createWorkflow()}
        >
          <Plus size={19} /> گردش‌کار تازه
        </button>
      </div>
      <div className="template-grid">
        {templates.map((w, i) => {
          const presentation = templatePresentation[w.id];
          const Icon = presentation.icon;
          return (
            <article className={"template-card template-" + i} key={w.id}>
              <div className="template-card-top">
                <span className="template-symbol">
                  <Icon size={25} />
                </span>
                <span className="template-badge">{presentation.badge}</span>
              </div>
              <span className="template-index">
                {(i + 1).toLocaleString("fa")} / الگوی آماده
              </span>
              <h2>{w.name}</h2>
              <p>{w.description}</p>
              <div className="template-chain">
                {w.nodes.slice(0, 5).map((n, k) => (
                  <span key={n.id}>
                    {k > 0 && <ArrowLeft size={12} />}
                    <span>
                      {
                        (
                          {
                            input: "JSON",
                            http: "API",
                            filter: "فیلتر",
                            sort: "ترتیب",
                            condition: "شرط",
                            delay: "مکث",
                            output: "خروجی",
                          } as const
                        )[n.config.type]
                      }
                    </span>
                  </span>
                ))}
                {w.nodes.length > 5 && (
                  <span>
                    +{(w.nodes.length - 5).toLocaleString("fa")} بلوک دیگر
                  </span>
                )}
              </div>
              <footer>
                <small>
                  {w.nodes.length.toLocaleString("fa")} بلوک · قابل ویرایش
                </small>
                <button
                  disabled={locked}
                  onClick={() => void createWorkflow(w)}
                >
                  استفاده از الگو <ArrowUpRight size={17} />
                </button>
              </footer>
            </article>
          );
        })}
      </div>
      {!templatePage && (
        <>
          <div className="list-heading">
            <h2>
              ذخیره‌شده‌ها{" "}
              <span className="count">
                {workflows.length.toLocaleString("fa")}
              </span>
            </h2>
            <div>
              <label className="search-input">
                <Search size={17} />
                <input
                  aria-label="جست‌وجوی گردش‌کار"
                  placeholder="جست‌وجو…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
              <button
                className="button secondary"
                disabled={locked}
                onClick={() => input.current?.click()}
              >
                <Upload size={16} /> واردکردن JSON
              </button>
            </div>
          </div>
          <input
            ref={input}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            aria-label="فایل گردش‌کار"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                if (f.size > 2_000_000)
                  throw new Error("فایل بیشتر از ۲ مگابایت است.");
                const w = importWorkflow(await f.text());
                w.id = uid();
                w.name += " (واردشده)";
                useApp.getState().open(w);
                await flushSave();
                useApp.getState().toast("فایل با موفقیت وارد شد.");
              } catch (err) {
                useApp
                  .getState()
                  .toast(
                    err instanceof Error ? err.message : "فایل معتبر نیست.",
                  );
              }
              e.target.value = "";
            }}
          />
          <div className="workflow-list">
            {workflows
              .filter((w) => w.name.includes(query))
              .map((w) => (
                <article key={w.id}>
                  <span className="workflow-list-icon">
                    <GitBranch size={21} />
                  </span>
                  <div className="workflow-list-info">
                    <h3>{w.name}</h3>
                    <p>
                      {w.nodes.length.toLocaleString("fa")} بلوک <span>·</span>{" "}
                      ویرایش {new Date(w.updatedAt).toLocaleDateString("fa-IR")}
                    </p>
                  </div>
                  <span className="storage-badge">ذخیرهٔ محلی</span>
                  <IconButton
                    icon={Pencil}
                    label={"تغییر نام " + w.name}
                    disabled={locked}
                    onClick={() => {
                      setRenaming(w);
                      setName(w.name);
                    }}
                  />
                  <IconButton
                    icon={Copy}
                    label={"کپی " + w.name}
                    disabled={locked}
                    onClick={async () => {
                      const copy = fromTemplate(w);
                      copy.name += " (کپی)";
                      useApp.getState().open(copy);
                      await flushSave();
                    }}
                  />
                  <IconButton
                    icon={Trash2}
                    label={"حذف " + w.name}
                    disabled={locked}
                    onClick={() => setDeleting(w)}
                  />
                  <button
                    className="button secondary"
                    disabled={locked}
                    onClick={() => useApp.getState().open(w)}
                  >
                    بازکردن <ArrowUpRight size={16} />
                  </button>
                </article>
              ))}
            {!workflows.filter((w) => w.name.includes(query)).length && (
              <div className="empty-page">
                <GitBranch size={30} />
                <h3>گردش‌کاری پیدا نشد</h3>
                <p>یکی بساز یا از الگوهای بالا شروع کن.</p>
              </div>
            )}
          </div>
        </>
      )}
      {deleting && (
        <Modal title="حذف گردش‌کار" onClose={() => setDeleting(undefined)}>
          <p>
            «{deleting.name}» حذف شود؟ تاریخچهٔ اجراها برای بررسی باقی می‌ماند.
          </p>
          <div className="modal-actions">
            <button
              className="button danger-button"
              onClick={() => {
                void removeWorkflow(deleting.id);
                setDeleting(undefined);
              }}
            >
              حذف گردش‌کار
            </button>
            <button
              className="button secondary"
              onClick={() => setDeleting(undefined)}
            >
              انصراف
            </button>
          </div>
        </Modal>
      )}
      {renaming && (
        <Modal
          title="تغییر نام گردش‌کار"
          onClose={() => setRenaming(undefined)}
        >
          <Field label="نام گردش‌کار">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              maxLength={100}
            />
          </Field>
          <div className="modal-actions">
            <button
              className="button primary"
              disabled={!name.trim()}
              onClick={async () => {
                const updated = {
                  ...renaming,
                  name: name.trim(),
                  updatedAt: Date.now(),
                };
                useApp.getState().open(updated);
                await flushSave();
                setRenaming(undefined);
              }}
            >
              ذخیرهٔ نام
            </button>
          </div>
        </Modal>
      )}
    </main>
  );
}
