import {
  lazy,
  Suspense,
  useEffect,
  useState,
  Component,
  type ReactNode,
} from "react";
import {
  Play,
  Square,
  Pause,
  StepForward,
  Moon,
  Sun,
  Search,
  GitBranch,
  LayoutGrid,
  History,
  BookOpen,
  Download,
  Check,
  LoaderCircle,
  AlertTriangle,
  X,
  RotateCcw,
  Plus,
  ArrowLeft,
  Command,
  ChevronLeft,
} from "lucide-react";
import {
  initialize,
  useApp,
  execute,
  cancelRun,
  engine,
  flushSave,
  setTheme,
  isLocked,
  createWorkflow,
} from "./store";
import { Editor } from "../features/editor/Editor";
import { IconButton, Modal, Field, Status } from "../components/ui";
import { validate } from "../lib/validation";
import { download } from "../lib/data";
import { type Run } from "../lib/model";
import { registerStudioTools } from "./webmcp";
const Library = lazy(() =>
  import("../features/workflows/Library").then((m) => ({ default: m.Library })),
);
const HistoryPage = lazy(() =>
  import("../features/executions/History").then((m) => ({
    default: m.History,
  })),
);
const Guide = lazy(() =>
  import("../features/guide/Guide").then((m) => ({ default: m.Guide })),
);
let boot: Promise<void> | undefined;
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { error?: string }
> {
  state: { error?: string } = {};
  static getDerivedStateFromError(e: Error) {
    return { error: e.message };
  }
  render() {
    if (this.state.error)
      return (
        <main className="fatal">
          <AlertTriangle size={34} />
          <h1>برنامه با یک خطا روبه‌رو شد</h1>
          <p>{this.state.error}</p>
          <button className="button primary" onClick={() => location.reload()}>
            بارگذاری دوباره
          </button>
        </main>
      );
    return this.props.children;
  }
}
export function App() {
  const loaded = useApp((s) => s.loaded),
    page = useApp((s) => s.page),
    theme = useApp((s) => s.theme),
    workflow = useApp((s) => s.workflow),
    run = useApp((s) => s.run),
    runs = useApp((s) => s.runs),
    saveState = useApp((s) => s.saveState),
    saveError = useApp((s) => s.saveError),
    notice = useApp((s) => s.notice),
    pausePending = useApp((s) => s.pausePending);
  const [command, setCommand] = useState(false),
    [search, setSearch] = useState(""),
    [rename, setRename] = useState(false),
    [name, setName] = useState(""),
    [unsafe, setUnsafe] = useState<Run>(),
    [recoveryHidden, setRecoveryHidden] = useState<string>();
  useEffect(() => {
    boot ??= initialize();
  }, []);
  useEffect(() => registerStudioTools(), []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);
  useEffect(() => {
    const onHash = () => {
      const p = location.hash.slice(1);
      if (["editor", "library", "templates", "history", "guide"].includes(p))
        useApp.setState({ page: p as typeof page });
    };
    const keyboard = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommand((v) => !v);
      }
    };
    window.addEventListener("hashchange", onHash);
    document.addEventListener("keydown", keyboard);
    return () => {
      window.removeEventListener("hashchange", onHash);
      document.removeEventListener("keydown", keyboard);
    };
  }, []);
  const recovery = runs.find(
    (r) =>
      r.status === "interrupted" && r.id !== recoveryHidden && r.id !== run?.id,
  );
  const issues = workflow ? validate(workflow) : [];
  const locked = isLocked();
  const resume = (r: Run, step = false) => {
    if (Object.values(r.nodes).some((n) => n.uncertain)) setUnsafe(r);
    else void execute(step, r);
  };
  if (!loaded)
    return (
      <div className="loading-screen">
        <span className="brand-mark">F</span>
        <LoaderCircle size={25} className="spin" />
        <p>در حال آماده‌کردن فضای کار…</p>
      </div>
    );
  const commands = [
    {
      label: "رفتن به بوم",
      icon: GitBranch,
      action: () => useApp.getState().setPage("editor"),
    },
    {
      label: "گردش‌کارهای من",
      icon: LayoutGrid,
      action: () => useApp.getState().setPage("library"),
    },
    {
      label: "الگوهای آماده",
      icon: Plus,
      action: () => useApp.getState().setPage("templates"),
    },
    {
      label: "تاریخچهٔ اجراها",
      icon: History,
      action: () => useApp.getState().setPage("history"),
    },
    {
      label: "راهنمای برنامه",
      icon: BookOpen,
      action: () => useApp.getState().setPage("guide"),
    },
    {
      label: "ساخت گردش‌کار تازه",
      icon: Plus,
      action: () => void createWorkflow(),
      disabled: locked,
    },
    {
      label: "تغییر پوسته",
      icon: theme === "dark" ? Sun : Moon,
      action: () => void setTheme(),
    },
    {
      label: "اجرای گردش‌کار",
      icon: Play,
      action: () => void execute(),
      disabled: locked || issues.length > 0,
    },
    {
      label: "دریافت فایل گردش‌کار",
      icon: Download,
      action: () => {
        if (workflow)
          download(workflow.name + ".json", JSON.stringify(workflow, null, 2));
      },
    },
  ];
  return (
    <div className="app-shell">
      <header className="topbar">
        <a
          className="brand"
          href="#editor"
          aria-label="Flow Studio — صفحهٔ بوم"
        >
          <span className="brand-mark">
            <GitBranch size={23} />
          </span>
          <span dir="ltr">
            flow<span className="brand-light">studio</span>
            <small>استودیوی گردش‌کار</small>
          </span>
        </a>
        <span className="topbar-divider" />
        <div className="workflow-top">
          <button
            disabled={locked}
            onClick={() => {
              setName(workflow?.name ?? "");
              setRename(true);
            }}
            className="workflow-name"
          >
            {workflow?.name}
            <ChevronLeft size={15} />
          </button>
          <span className={"save-indicator save-" + saveState} role="status">
            {saveState === "saved" ? (
              <Check size={13} />
            ) : saveState === "saving" ? (
              <LoaderCircle size={13} className="spin" />
            ) : (
              <AlertTriangle size={13} />
            )}{" "}
            {saveState === "saved"
              ? "ذخیره شد"
              : saveState === "saving"
                ? "در حال ذخیره…"
                : "ذخیره نشد"}
          </span>
        </div>
        <div className="topbar-spacer" />
        <button className="command-trigger" onClick={() => setCommand(true)}>
          <Search size={16} />
          <span>فرمان‌ها</span>
          <kbd dir="ltr">⌘ K</kbd>
        </button>
        <IconButton
          icon={theme === "dark" ? Sun : Moon}
          label="تغییر پوسته"
          onClick={() => void setTheme()}
        />
        <IconButton
          icon={Download}
          label="دریافت فایل گردش‌کار"
          onClick={() => {
            if (workflow)
              download(
                workflow.name + ".json",
                JSON.stringify(workflow, null, 2),
              );
          }}
        />
        <span className="topbar-divider" />
        <div className="run-controls">
          {run && ["running", "paused", "interrupted"].includes(run.status) ? (
            <>
              <IconButton
                icon={Square}
                label="لغو اجرا"
                onClick={() => void cancelRun()}
              />
              {run.status === "running" ? (
                <button
                  className="button secondary pause-button"
                  disabled={pausePending}
                  onClick={() => {
                    engine.pause();
                    useApp.setState({ pausePending: true });
                  }}
                >
                  <Pause size={16} />
                  {pausePending ? "در حال توقف…" : "توقف"}
                </button>
              ) : (
                <>
                  <IconButton
                    icon={StepForward}
                    label="اجرای مرحلهٔ بعد"
                    onClick={() => resume(run, true)}
                  />
                  <button
                    className="button primary"
                    onClick={() => resume(run)}
                  >
                    <Play size={16} /> ادامهٔ اجرا
                  </button>
                </>
              )}
            </>
          ) : (
            <>
              <IconButton
                icon={StepForward}
                label="اجرای تک‌مرحله‌ای"
                disabled={issues.length > 0}
                onClick={() => void execute(true)}
              />
              <button
                className="button primary run-button"
                disabled={issues.length > 0}
                title={issues[0]?.message}
                onClick={() => void execute()}
              >
                <Play size={17} fill="currentColor" /> اجرا
              </button>
            </>
          )}
        </div>
      </header>
      <div className="app-body">
        <nav className="rail" aria-label="ناوبری اصلی">
          <div className="rail-label">فضای کار</div>
          {[
            { id: "editor" as const, icon: GitBranch, label: "ویرایشگر" },
            { id: "library" as const, icon: LayoutGrid, label: "گردش‌کارها" },
            { id: "templates" as const, icon: Plus, label: "الگوها" },
            { id: "history" as const, icon: History, label: "تاریخچه" },
            { id: "guide" as const, icon: BookOpen, label: "راهنما" },
          ].map((item) => (
            <button
              key={item.id}
              className={page === item.id ? "active" : ""}
              onClick={() => useApp.getState().setPage(item.id)}
              aria-label={item.label}
              aria-current={page === item.id ? "page" : undefined}
            >
              <item.icon size={21} />
              <span>{item.label}</span>
            </button>
          ))}
          <div className="rail-bottom">
            <span className="avatar">FS</span>
            <span>نسخهٔ محلی</span>
          </div>
        </nav>
        <div className="main-surface">
          {saveError && (
            <div className="storage-error" role="alert">
              <AlertTriangle size={19} />
              <span>{saveError}</span>
              <button onClick={() => void flushSave()}>تلاش دوباره</button>
              <button
                onClick={() => {
                  if (workflow)
                    download(
                      "recovery-workflow.json",
                      JSON.stringify(workflow, null, 2),
                    );
                }}
              >
                دریافت فایل
              </button>
            </div>
          )}
          {recovery && (
            <div className="recovery-banner">
              <RotateCcw size={21} />
              <div>
                <strong>یک اجرای نیمه‌تمام پیدا شد</strong>
                <span>
                  {recovery.workflow.name} ·{" "}
                  {Object.values(recovery.nodes)
                    .filter((n) => n.status === "succeeded")
                    .length.toLocaleString("fa")}{" "}
                  مرحله ثبت شده؛ هنگام بسته‌بودن صفحه پردازشی انجام نشده است.
                </span>
              </div>
              <button
                className="button primary"
                disabled={locked}
                onClick={() => resume(recovery)}
              >
                ادامهٔ اجرای ذخیره‌شده
              </button>
              <button
                className="button secondary"
                disabled={locked}
                onClick={() => {
                  useApp.setState({
                    workflow: recovery.workflow,
                    run: recovery,
                    page: "editor",
                  });
                  useApp.getState().setPage("editor");
                }}
              >
                بررسی
              </button>
              <IconButton
                icon={X}
                label="بستن اعلان بازیابی"
                onClick={() => setRecoveryHidden(recovery.id)}
              />
            </div>
          )}
          {run?.status === "interrupted" && (
            <div className="recovery-banner">
              <RotateCcw size={20} />
              <div>
                <strong>این اجرا قطع شده است</strong>
                <span>
                  ادامه، خروجی‌های ثبت‌شده را نگه می‌دارد و مرحلهٔ نیمه‌تمام را
                  دوباره اجرا می‌کند.
                </span>
              </div>
              <button
                className="button secondary"
                onClick={() => {
                  useApp.setState({ run: undefined });
                  engine.current = undefined;
                  void execute();
                }}
              >
                شروع اجرای تازه
              </button>
            </div>
          )}
          {run?.error?.code === "STORAGE" && (
            <div className="storage-error" role="alert">
              <AlertTriangle size={18} />
              <span>
                {run.error.message} اجرا متوقف شده؛ ادامه را بعد از رفع مشکل
                انتخاب کن.
              </span>
            </div>
          )}
          <Suspense
            fallback={
              <div className="loading-screen">
                <LoaderCircle className="spin" size={24} />
              </div>
            }
          >
            {page === "editor" ? (
              <Editor key={workflow?.id} />
            ) : page === "library" ? (
              <Library />
            ) : page === "templates" ? (
              <Library templatePage />
            ) : page === "history" ? (
              <HistoryPage />
            ) : (
              <Guide />
            )}
          </Suspense>
        </div>
      </div>
      {notice && (
        <div className="toast" role="status">
          <InfoNotice />
          <span>{notice}</span>
          <IconButton
            icon={X}
            label="بستن پیام"
            onClick={() => useApp.getState().toast(undefined)}
          />
        </div>
      )}
      {command && (
        <Modal
          title="چه کاری می‌خواهی انجام بدهی؟"
          onClose={() => {
            setCommand(false);
            setSearch("");
          }}
        >
          <label className="command-search">
            <Search size={20} />
            <input
              autoFocus
              aria-label="جست‌وجوی فرمان"
              placeholder="یک فرمان جست‌وجو کن…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Command size={17} />
          </label>
          <div className="command-list">
            {commands
              .filter((c) => c.label.includes(search))
              .map((c) => (
                <button
                  key={c.label}
                  disabled={c.disabled}
                  onClick={() => {
                    c.action();
                    setCommand(false);
                    setSearch("");
                  }}
                >
                  <c.icon size={18} />
                  <span>{c.label}</span>
                  <ArrowLeft size={16} />
                </button>
              ))}
          </div>
          <p className="small-muted">
            برای بستن، Esc را بزن. فرمان‌های ناسازگار با اجرای فعلی غیرفعال‌اند.
          </p>
        </Modal>
      )}
      {rename && (
        <Modal title="نام گردش‌کار" onClose={() => setRename(false)}>
          <Field label="نام گردش‌کار">
            <input
              autoFocus
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <div className="modal-actions">
            <button
              className="button primary"
              disabled={!name.trim()}
              onClick={() => {
                useApp.getState().edit((w) => {
                  w.name = name.trim();
                });
                setRename(false);
              }}
            >
              ذخیرهٔ نام
            </button>
          </div>
        </Modal>
      )}
      {unsafe && (
        <Modal
          title="نتیجهٔ درخواست قبلی مشخص نیست"
          onClose={() => setUnsafe(undefined)}
        >
          <div className="uncertain-warning">
            <AlertTriangle size={30} />
            <p>
              ممکن است درخواست نوشتن قبلاً در سرور انجام شده باشد، ولی پاسخ آن
              در مرورگر ثبت نشده باشد. تکرار درخواست ممکن است عملیات را دوباره
              انجام دهد.
            </p>
          </div>
          <p>
            پیش از ادامه، نتیجه را در سرویس مقصد بررسی کن. لغو این اجرا هم
            عملیات انجام‌شده در سرور را برنمی‌گرداند.
          </p>
          <Status value={unsafe.status} />
          <div className="modal-actions">
            <button
              className="button danger-button"
              onClick={() => {
                void execute(false, unsafe, true);
                setUnsafe(undefined);
              }}
            >
              ریسک تکرار را می‌پذیرم؛ ادامه بده
            </button>
            <button
              className="button secondary"
              onClick={() => setUnsafe(undefined)}
            >
              فعلاً ادامه نده
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
function InfoNotice() {
  return <AlertTriangle size={19} />;
}
