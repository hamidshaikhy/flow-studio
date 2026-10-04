import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useReactFlow,
  SelectionMode,
  type NodeChange,
  type Connection,
  type Edge,
  type OnReconnect,
  type EdgeChange,
} from "@xyflow/react";
import {
  Search,
  Plus,
  Layers,
  Terminal,
  CheckCircle2,
  ChevronDown,
  Maximize,
  Info,
  Undo2,
  Redo2,
  ListChecks,
  ArrowDownToLine,
  MousePointer2,
  GripHorizontal,
  Play,
  Trash2,
} from "lucide-react";
import {
  useApp,
  isLocked,
  copyNodes,
  pasteNodes,
  execute,
} from "../../app/store";
import {
  labels,
  descriptions,
  uid,
  type NodeKind,
  type FlowEdge,
} from "../../lib/model";
import { validate, connectionIssue } from "../../lib/validation";
import { download, toCsv } from "../../lib/data";
import { FlowCard, nodeIcons, type CanvasNode } from "./FlowCard";
import { Inspector, DataViewer } from "../nodes/Inspector";
import { Status, IconButton, Modal } from "../../components/ui";
const nodeTypes = { flow: FlowCard };
export function Editor() {
  return (
    <ReactFlowProvider>
      <Workspace />
    </ReactFlowProvider>
  );
}
function Workspace() {
  const workflow = useApp((s) => s.workflow),
    run = useApp((s) => s.run),
    selected = useApp((s) => s.selected),
    edit = useApp((s) => s.edit),
    past = useApp((s) => s.past),
    future = useApp((s) => s.future);
  const [query, setQuery] = useState(""),
    [selectedIds, setSelectedIds] = useState<string[]>([]),
    [selectedEdges, setSelectedEdges] = useState<string[]>([]),
    [positions, setPositions] = useState<
      Record<string, { x: number; y: number }>
    >({}),
    [dimensions, setDimensions] = useState<
      Record<string, { width: number; height: number }>
    >({}),
    [consoleTab, setConsoleTab] = useState("events"),
    [height, setHeight] = useState(215),
    [mobileTab, setMobileTab] = useState("canvas"),
    [confirmClear, setConfirmClear] = useState(false);
  const { fitView, screenToFlowPosition } = useReactFlow();
  const dragging = useRef(false);
  const locked = isLocked();
  const issues = useMemo(
    () => (workflow ? validate(workflow) : []),
    [workflow],
  );
  const nodes = useMemo<CanvasNode[]>(
    () =>
      workflow?.nodes.map((n) => ({
        id: n.id,
        type: "flow",
        position: positions[n.id] ?? n.position,
        measured: dimensions[n.id],
        selected: selectedIds.includes(n.id) || n.id === selected,
        data: {
          node: n,
          record: run?.nodes[n.id],
          invalid: issues.some((i) => i.nodeId === n.id),
          locked,
        },
      })) ?? [],
    [
      workflow,
      positions,
      dimensions,
      selected,
      selectedIds,
      run,
      issues,
      locked,
    ],
  );
  const edges = useMemo<Edge[]>(
    () =>
      workflow?.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.port,
        targetHandle: "in",
        animated: run?.nodes[e.target]?.status === "running",
        style: {
          stroke:
            run?.nodes[e.target]?.status === "skipped"
              ? "var(--muted-line)"
              : e.port === "true"
                ? "var(--mint)"
                : e.port === "false"
                  ? "var(--warning)"
                  : "var(--edge)",
          strokeWidth: 2,
        },
        label:
          e.port === "out" ? undefined : e.port === "true" ? "درست" : "نادرست",
        labelStyle: {
          fill: "var(--muted)",
          fontFamily: "Vazirmatn",
          fontSize: 13,
        },
        labelBgStyle: { fill: "var(--panel)" },
        selected: selectedEdges.includes(e.id),
      })) ?? [],
    [workflow, run, selectedEdges],
  );
  const connect = useCallback(
    (c: Connection, replaced?: string) => {
      if (!workflow || locked || !c.source || !c.target) return;
      const edge: FlowEdge = {
        id: replaced ?? uid(),
        source: c.source,
        target: c.target,
        port: (c.sourceHandle ?? "out") as FlowEdge["port"],
      };
      const error = connectionIssue(workflow, edge);
      if (error) useApp.getState().toast(error);
      else
        edit((w) => {
          w.edges = w.edges.filter((e) => e.id !== replaced);
          w.edges.push(edge);
        });
    },
    [workflow, locked, edit],
  );
  const reconnect: OnReconnect = useCallback(
    (old, c) => connect(c, old.id),
    [connect],
  );
  const onNodesChange = useCallback(
    (changes: NodeChange<CanvasNode>[]) => {
      for (const change of changes) {
        if (change.type === "dimensions" && change.dimensions) {
          const d = change.dimensions;
          setDimensions((p) =>
            p[change.id]?.width === d.width && p[change.id]?.height === d.height
              ? p
              : { ...p, [change.id]: d },
          );
        }
        if (change.type === "position" && change.position) {
          setPositions((p) => ({ ...p, [change.id]: change.position! }));
          if (change.dragging === false && !dragging.current)
            edit((w) => {
              const n = w.nodes.find((v) => v.id === change.id);
              if (n) n.position = change.position!;
            }, true);
        }
        if (change.type === "select")
          setSelectedIds((ids) =>
            change.selected
              ? [...new Set([...ids, change.id])]
              : ids.filter((id) => id !== change.id),
          );
      }
    },
    [edit],
  );
  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    for (const c of changes)
      if (c.type === "select")
        setSelectedEdges((ids) =>
          c.selected
            ? [...new Set([...ids, c.id])]
            : ids.filter((id) => id !== c.id),
        );
  }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const target = e.target;
      if (
        target instanceof HTMLElement &&
        target.closest("input,textarea,select,[contenteditable],dialog")
      )
        return;
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) useApp.getState().redo();
        else useApp.getState().undo();
      }
      if (ctrl && e.key.toLowerCase() === "y") {
        e.preventDefault();
        useApp.getState().redo();
      }
      if (ctrl && e.key.toLowerCase() === "c") {
        e.preventDefault();
        copyNodes(
          selectedIds.length ? selectedIds : selected ? [selected] : [],
        );
      }
      if (ctrl && e.key.toLowerCase() === "v") {
        e.preventDefault();
        pasteNodes();
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        const ids = selectedIds.length
          ? selectedIds
          : selected
            ? [selected]
            : [];
        edit((w) => {
          w.nodes = w.nodes.filter((n) => !ids.includes(n.id));
          w.edges = w.edges.filter(
            (e) =>
              !ids.includes(e.source) &&
              !ids.includes(e.target) &&
              !selectedEdges.includes(e.id),
          );
        });
        useApp.getState().select(undefined);
        setSelectedIds([]);
        setSelectedEdges([]);
      }
      if (e.key.toLowerCase() === "f") {
        e.preventDefault();
        void fitView({ padding: 0.15, duration: 250 });
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [selected, selectedIds, selectedEdges, edit, fitView]);
  const resize = useRef<{ y: number; height: number } | undefined>(undefined);
  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (resize.current)
        setHeight(
          Math.max(
            150,
            Math.min(500, resize.current.height + resize.current.y - e.clientY),
          ),
        );
    };
    const up = () => {
      resize.current = undefined;
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, []);
  if (!workflow) return null;
  const output = workflow.nodes.find(
    (n) =>
      n.config.type === "output" && run?.nodes[n.id]?.status === "succeeded",
  );
  const record = output ? run?.nodes[output.id] : undefined;
  return (
    <main className={"editor mobile-" + mobileTab}>
      <div className="mobile-switch">
        <button
          className={mobileTab === "palette" ? "active" : ""}
          onClick={() => setMobileTab("palette")}
        >
          بلوک‌ها
        </button>
        <button
          className={mobileTab === "canvas" ? "active" : ""}
          onClick={() => setMobileTab("canvas")}
        >
          بوم
        </button>
        <button
          className={mobileTab === "inspector" ? "active" : ""}
          onClick={() => setMobileTab("inspector")}
        >
          تنظیمات
        </button>
      </div>
      <aside className="palette">
        <div className="panel-heading">
          <Layers size={18} />
          <strong>کتابخانهٔ بلوک‌ها</strong>
          <span className="count">۷</span>
        </div>
        <label className="search-input">
          <Search size={16} />
          <input
            aria-label="جست‌وجوی بلوک"
            placeholder="جست‌وجوی بلوک…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div className="palette-scroll">
          <div className="section-label">منابع و ورودی</div>
          {(
            [
              "input",
              "http",
              "filter",
              "sort",
              "condition",
              "delay",
              "output",
            ] as NodeKind[]
          )
            .filter((k) => (labels[k] + descriptions[k]).includes(query))
            .map((kind, index) => {
              const Icon = nodeIcons[kind];
              return (
                <div key={kind}>
                  {index === 2 && (
                    <div className="section-label">منطق و پردازش</div>
                  )}
                  {kind === "output" && (
                    <div className="section-label">نتیجه</div>
                  )}
                  <button
                    className={"palette-node kind-" + kind}
                    draggable={!locked}
                    onDragStart={(e) =>
                      e.dataTransfer.setData("application/flow-node", kind)
                    }
                    onClick={() => {
                      useApp.getState().add(kind);
                      setMobileTab("inspector");
                    }}
                    disabled={
                      locked ||
                      (kind === "input" &&
                        workflow.nodes.some((n) => n.config.type === "input"))
                    }
                    aria-label={"افزودن " + labels[kind]}
                  >
                    <span className="node-icon">
                      <Icon size={18} />
                    </span>
                    <span>
                      <strong>{labels[kind]}</strong>
                      <small>{descriptions[kind]}</small>
                    </span>
                    <Plus size={15} className="add-plus" />
                  </button>
                </div>
              );
            })}
          {!Object.values(labels).some((v) => v.includes(query)) && (
            <p className="small-muted">بلوک موردنظر پیدا نشد.</p>
          )}
        </div>
        <div className="palette-footer">
          <span className="local-dot" />
          همه‌چیز در مرورگر تو<small>ذخیرهٔ محلی با IndexedDB</small>
        </div>
      </aside>
      <section className="center-workspace">
        <div className="canvas-header">
          <div>
            <span className="breadcrumb">
              گردش‌کارها <ChevronDown size={13} />
            </span>
            <strong>{workflow.name}</strong>
          </div>
          <div className="canvas-meta">
            <span>{workflow.nodes.length.toLocaleString("fa")} بلوک</span>
            <span className="divider" />
            <span>{workflow.edges.length.toLocaleString("fa")} اتصال</span>
          </div>
        </div>
        <div
          className="canvas"
          dir="ltr"
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
          }}
          onDrop={(e) => {
            e.preventDefault();
            const k = e.dataTransfer.getData(
              "application/flow-node",
            ) as NodeKind;
            if (k in labels)
              useApp
                .getState()
                .add(k, screenToFlowPosition({ x: e.clientX, y: e.clientY }));
          }}
        >
          <ReactFlow<CanvasNode>
            ariaLabelConfig={{
              "controls.zoomIn.ariaLabel": "بزرگ‌نمایی",
              "controls.zoomOut.ariaLabel": "کوچک‌نمایی",
              "controls.fitView.ariaLabel": "نمایش همهٔ بلوک‌ها",
              "minimap.ariaLabel": "نقشهٔ کوچک گردش‌کار",
            }}
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onEdgeClick={() => {
              useApp.getState().select(undefined);
              setSelectedIds([]);
            }}
            onNodeClick={(_, n) => {
              setSelectedEdges([]);
              useApp.getState().select(n.id);
              setMobileTab("inspector");
            }}
            onPaneClick={() => {
              useApp.getState().select(undefined);
              setSelectedIds([]);
              setSelectedEdges([]);
            }}
            onNodeDragStart={() => {
              dragging.current = true;
            }}
            onNodeDragStop={(_, node, dragged) => {
              dragging.current = false;
              edit((w) => {
                for (const moved of dragged.length ? dragged : [node]) {
                  const n = w.nodes.find((v) => v.id === moved.id);
                  if (n) n.position = moved.position;
                }
              });
              setPositions({});
            }}
            onEdgesDelete={(deleted) =>
              edit((w) => {
                w.edges = w.edges.filter(
                  (e) => !deleted.some((d) => d.id === e.id),
                );
              })
            }
            onConnect={connect}
            onReconnect={reconnect}
            nodesDraggable={!locked}
            nodesConnectable={!locked}
            edgesReconnectable={!locked}
            deleteKeyCode={null}
            selectionMode={SelectionMode.Partial}
            multiSelectionKeyCode="Shift"
            fitView
            fitViewOptions={{ padding: 0.18, maxZoom: 1 }}
            minZoom={0.25}
            maxZoom={1.5}
            proOptions={{ hideAttribution: false }}
            colorMode={useApp.getState().theme}
          >
            <Background
              variant={BackgroundVariant.Dots}
              color="var(--dots)"
              gap={22}
              size={1.2}
            />
            <Controls position="bottom-left" showInteractive={false} />
            <MiniMap
              position="bottom-right"
              style={{ width: 128, height: 84 }}
              nodeColor={(n) =>
                (n.data as CanvasNode["data"]).node.config.type === "http"
                  ? "#5B8CFF"
                  : "#66E3D0"
              }
              maskColor="var(--minimap-mask)"
              pannable
              zoomable
            />
          </ReactFlow>
          <div className="canvas-toolbar" dir="rtl">
            <IconButton
              icon={MousePointer2}
              label="انتخاب و جابه‌جایی بلوک‌ها"
              disabled
            />
            <span className="toolbar-divider" />
            <IconButton
              icon={Undo2}
              label="بازگردانی (Ctrl+Z)"
              onClick={() => useApp.getState().undo()}
              disabled={!past.length || locked}
            />
            <IconButton
              icon={Redo2}
              label="انجام دوباره (Ctrl+Shift+Z)"
              onClick={() => useApp.getState().redo()}
              disabled={!future.length || locked}
            />
            <span className="toolbar-divider" />
            <IconButton
              icon={Maximize}
              label="نمایش همهٔ بلوک‌ها (F)"
              onClick={() => void fitView({ padding: 0.18, duration: 250 })}
            />
            <span className="toolbar-divider" />
            <button
              className="canvas-clear-button"
              aria-label="پاک‌کردن کل صفحه"
              title="پاک‌کردن کل صفحه"
              disabled={locked || workflow.nodes.length === 0}
              onClick={() => setConfirmClear(true)}
            >
              <Trash2 size={16} />
              <span>پاک‌کردن صفحه</span>
            </button>
          </div>
          <div className="canvas-caption" dir="rtl">
            <span className="local-dot" />
            {workflow.nodes.some(
              (n) => n.config.type === "http" && n.config.transport === "live",
            )
              ? "حالت API زنده"
              : "حالت دادهٔ آزمایشی"}
            <span>·</span>
            <span>اجرای مرحله‌ای</span>
          </div>
        </div>
        <section className="execution-console" style={{ height }} dir="rtl">
          <button
            className="console-resize"
            aria-label="تغییر ارتفاع کنسول"
            onPointerDown={(e) => {
              resize.current = { y: e.clientY, height };
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowUp") setHeight((h) => Math.min(500, h + 25));
              if (e.key === "ArrowDown")
                setHeight((h) => Math.max(150, h - 25));
            }}
          >
            <GripHorizontal size={16} />
          </button>
          <header className="console-header">
            <div className="console-tabs">
              <span className="console-icon">
                <Terminal size={17} />
              </span>
              <button
                className={consoleTab === "events" ? "active" : ""}
                onClick={() => setConsoleTab("events")}
              >
                رویدادها{" "}
                {run && (
                  <span className="count">
                    {run.events.length.toLocaleString("fa")}
                  </span>
                )}
              </button>
              <button
                className={consoleTab === "results" ? "active" : ""}
                onClick={() => setConsoleTab("results")}
              >
                نتیجه
              </button>
              <button
                className={consoleTab === "validation" ? "active" : ""}
                onClick={() => setConsoleTab("validation")}
              >
                اعتبارسنجی{" "}
                {issues.length > 0 && (
                  <span className="count warning">
                    {issues.length.toLocaleString("fa")}
                  </span>
                )}
              </button>
            </div>
            {run ? (
              <Status value={run.status} />
            ) : (
              <span className="ready-tag">
                <span className="local-dot" />
                آمادهٔ اجرا
              </span>
            )}
          </header>
          <div className="console-content">
            {consoleTab === "validation" ? (
              issues.length ? (
                <div className="validation-list">
                  {issues.map((i, k) => (
                    <button
                      key={k}
                      onClick={() => {
                        useApp.getState().select(i.nodeId);
                        setMobileTab("inspector");
                      }}
                    >
                      <ListChecks size={15} />
                      <span>
                        <strong>
                          {workflow.nodes.find((n) => n.id === i.nodeId)
                            ?.label ?? "گردش‌کار"}
                        </strong>{" "}
                        · {i.message}
                        <small>{i.action}</small>
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="console-empty">
                  <CheckCircle2 size={25} />
                  <div>
                    <strong>ساختار گردش‌کار معتبر است</strong>
                    <p>اتصال‌ها، مسیرها و تنظیمات بررسی شدند.</p>
                  </div>
                </div>
              )
            ) : consoleTab === "results" ? (
              record?.output !== undefined ? (
                <>
                  <div className="result-bar">
                    <strong>
                      {Array.isArray(record.output)
                        ? record.output.length.toLocaleString("fa") + " رکورد"
                        : "نتیجهٔ ثبت‌شده"}{" "}
                      · {output!.label}
                    </strong>
                    <button
                      onClick={() =>
                        download(
                          "result.csv",
                          toCsv(
                            record.output!,
                            output?.config.type === "output"
                              ? output.config.columns
                              : [],
                          ),
                          "text/csv;charset=utf-8",
                        )
                      }
                    >
                      <ArrowDownToLine size={15} /> دریافت CSV
                    </button>
                    <button
                      onClick={() =>
                        download(
                          "result.json",
                          JSON.stringify(record.output, null, 2),
                        )
                      }
                    >
                      JSON
                    </button>
                  </div>
                  <DataViewer
                    key={run?.id}
                    data={record.output}
                    columns={
                      output?.config.type === "output"
                        ? output.config.columns
                        : []
                    }
                    view="table"
                  />
                </>
              ) : (
                <div className="console-empty">
                  <Info size={25} />
                  <div>
                    <strong>نتیجه بعد از اجرای بلوک خروجی ظاهر می‌شود</strong>
                    <p>خروجی هر مرحله را هم از پنل تنظیمات می‌توانی ببینی.</p>
                  </div>
                </div>
              )
            ) : run ? (
              <div className="event-list">
                {run.events.map((e, i) => (
                  <div key={i} className={"event event-" + e.level}>
                    <time>
                      {new Date(e.time).toLocaleTimeString("fa-IR", {
                        hour12: false,
                      })}
                    </time>
                    <span className="event-level">
                      {e.level === "error"
                        ? "خطا"
                        : e.level === "success"
                          ? "موفق"
                          : "اطلاع"}
                    </span>
                    <button onClick={() => useApp.getState().select(e.nodeId)}>
                      {e.message}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="console-empty welcome-console">
                <span className="console-play">
                  <Play size={23} />
                </span>
                <div>
                  <strong>از دادهٔ خام تا یک نتیجهٔ روشن</strong>
                  <p>
                    گردش‌کار آماده است. اجرا کن و مسیر حرکت داده را قدم‌به‌قدم
                    ببین.
                  </p>
                  <span className="hint-line">
                    <kbd>Ctrl</kbd> + <kbd>K</kbd> فرمان‌ها <span>·</span>{" "}
                    <kbd>F</kbd> نمایش کامل بوم
                  </span>
                </div>
                <button
                  className="button secondary"
                  disabled={issues.length > 0}
                  onClick={() => void execute()}
                >
                  اولین اجرا <Play size={15} />
                </button>
              </div>
            )}
          </div>
        </section>
      </section>
      <Inspector key={selected ?? "empty"} />
      {confirmClear && (
        <Modal title="پاک‌کردن کل صفحه" onClose={() => setConfirmClear(false)}>
          <p>
            همهٔ {workflow.nodes.length.toLocaleString("fa")} بلوک و اتصال‌های
            این گردش‌کار پاک شوند؟ پس از پاک‌کردن می‌توانی با دکمهٔ بازگردانی
            آن‌ها را برگردانی.
          </p>
          <div className="modal-actions">
            <button
              className="button danger-button"
              disabled={locked}
              onClick={() => {
                if (isLocked()) return;
                edit((w) => {
                  w.nodes = [];
                  w.edges = [];
                });
                useApp.getState().select(undefined);
                setSelectedIds([]);
                setSelectedEdges([]);
                setPositions({});
                setDimensions({});
                setConfirmClear(false);
              }}
            >
              پاک‌کردن همهٔ بلوک‌ها
            </button>
            <button
              className="button secondary"
              onClick={() => setConfirmClear(false)}
            >
              انصراف
            </button>
          </div>
        </Modal>
      )}
    </main>
  );
}
