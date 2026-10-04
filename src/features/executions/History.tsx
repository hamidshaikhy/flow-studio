import { useState } from "react";
import {
  History as HistoryIcon,
  Trash2,
  ArrowUpRight,
  RotateCcw,
  Download,
} from "lucide-react";
import { useApp, isLocked, execute } from "../../app/store";
import { repository } from "../../lib/storage";
import { clone, type Run } from "../../lib/model";
import { download } from "../../lib/data";
import { Modal, Status } from "../../components/ui";
import { DataViewer } from "../nodes/Inspector";
export function History() {
  const runs = useApp((s) => s.runs);
  const [inspect, setInspect] = useState<Run>(),
    [confirm, setConfirm] = useState(false),
    [error, setError] = useState("");
  const locked = isLocked();
  return (
    <main className="page history-page">
      <div className="page-eyebrow">ردّ هر تصمیم، ثبت هر مرحله</div>
      <div className="page-heading">
        <div>
          <h1>
            تاریخچهٔ اجراها<span className="heading-dot">.</span>
          </h1>
          <p>نسخهٔ همان گردش‌کار، خروجی‌های ثبت‌شده و جزئیات خطا در یک جا.</p>
        </div>
        <button
          className="button secondary danger"
          disabled={!runs.length || locked}
          onClick={() => setConfirm(true)}
        >
          <Trash2 size={17} /> پاک‌کردن تاریخچه
        </button>
      </div>
      <div className="history-stats">
        <div>
          <span>کل اجراها</span>
          <strong>{runs.length.toLocaleString("fa")}</strong>
        </div>
        <div>
          <span>موفق</span>
          <strong className="mint-text">
            {runs
              .filter((r) => r.status === "succeeded")
              .length.toLocaleString("fa")}
          </strong>
        </div>
        <div>
          <span>قابل ادامه</span>
          <strong>
            {runs
              .filter((r) => ["paused", "interrupted"].includes(r.status))
              .length.toLocaleString("fa")}
          </strong>
        </div>
        <div>
          <span>با خطا</span>
          <strong className="error-text">
            {runs
              .filter((r) => r.status === "failed")
              .length.toLocaleString("fa")}
          </strong>
        </div>
      </div>
      <div className="history-list">
        {runs.map((run) => (
          <article key={run.id}>
            <span className="workflow-list-icon">
              <HistoryIcon size={21} />
            </span>
            <div className="history-info">
              <h3>{run.workflow.name}</h3>
              <p>
                {new Date(run.startedAt).toLocaleString("fa-IR")} ·{" "}
                {Object.values(run.nodes)
                  .filter((n) => n.status === "succeeded")
                  .length.toLocaleString("fa")}{" "}
                از {run.workflow.nodes.length.toLocaleString("fa")} مرحله
              </p>
              {run.error && (
                <span className="error-text">{run.error.message}</span>
              )}
            </div>
            <Status value={run.status} />
            <button
              className="button secondary"
              onClick={() => setInspect(run)}
            >
              بررسی <ArrowUpRight size={16} />
            </button>
          </article>
        ))}
        {!runs.length && (
          <div className="empty-page">
            <HistoryIcon size={36} />
            <h2>اولین اجرا هنوز انجام نشده</h2>
            <p>
              یک گردش‌کار اجرا کن تا مسیر داده و خروجی‌های آن اینجا ثبت شوند.
            </p>
            <button
              className="button primary"
              onClick={() => useApp.getState().setPage("editor")}
            >
              رفتن به ویرایشگر
            </button>
          </div>
        )}
      </div>
      {inspect && (
        <Modal
          title={"جزئیات اجرا · " + inspect.workflow.name}
          onClose={() => setInspect(undefined)}
        >
          <div className="history-modal-meta">
            <Status value={inspect.status} />
            <span>{new Date(inspect.startedAt).toLocaleString("fa-IR")}</span>
            <button
              className="text-button"
              onClick={() =>
                download(
                  "run-" + inspect.id + ".json",
                  JSON.stringify(inspect, null, 2),
                )
              }
            >
              <Download size={16} /> فایل اجرا
            </button>
          </div>
          <p className="small-muted">
            اطلاعات زیر از نسخهٔ ثابت گردش‌کار هنگام اجرا می‌آید.
          </p>
          <div className="run-details">
            {inspect.workflow.nodes.map((n) => (
              <details key={n.id}>
                <summary>
                  <span>{n.label}</span>
                  <Status value={inspect.nodes[n.id]?.status ?? "pending"} />
                </summary>
                {inspect.nodes[n.id]?.error && (
                  <div className="error-box">
                    <strong>{inspect.nodes[n.id].error?.message}</strong>
                    <p>{inspect.nodes[n.id].error?.action}</p>
                  </div>
                )}
                <h4>ورودی</h4>
                <DataViewer data={inspect.nodes[n.id]?.input} />
                <h4>خروجی</h4>
                <DataViewer data={inspect.nodes[n.id]?.output} />
              </details>
            ))}
          </div>
          <div className="modal-actions">
            <button
              className="button secondary"
              disabled={locked}
              onClick={() => {
                useApp.setState({
                  workflow: clone(inspect.workflow),
                  run: clone(inspect),
                  selected: undefined,
                  page: "editor",
                  past: [],
                  future: [],
                });
                useApp.getState().setPage("editor");
                setInspect(undefined);
              }}
            >
              نمایش روی بوم
            </button>
            {["paused", "interrupted"].includes(inspect.status) &&
              !Object.values(inspect.nodes).some((n) => n.uncertain) && (
                <button
                  className="button primary"
                  disabled={locked}
                  onClick={() => {
                    void execute(false, inspect);
                    setInspect(undefined);
                  }}
                >
                  <RotateCcw size={16} /> ادامهٔ اجرا
                </button>
              )}
          </div>
        </Modal>
      )}
      {confirm && (
        <Modal title="پاک‌کردن تاریخچه" onClose={() => setConfirm(false)}>
          <p>
            همهٔ اجراها و خروجی‌های ذخیره‌شده پاک شوند؟ گردش‌کارها باقی
            می‌مانند.
          </p>
          {error && <p className="error-text">{error}</p>}
          <div className="modal-actions">
            <button
              className="button danger-button"
              onClick={async () => {
                try {
                  await repository.clearRuns();
                  useApp.setState({ runs: [], run: undefined });
                  setConfirm(false);
                } catch (e) {
                  setError(String(e));
                }
              }}
            >
              پاک‌کردن همهٔ اجراها
            </button>
            <button
              className="button secondary"
              onClick={() => setConfirm(false)}
            >
              انصراف
            </button>
          </div>
        </Modal>
      )}
    </main>
  );
}
