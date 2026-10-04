import { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import {
  Braces,
  Globe,
  ListFilter,
  ArrowDownWideNarrow,
  GitBranch,
  Timer,
  Table2,
  Check,
  LoaderCircle,
  AlertCircle,
  Minus,
  CirclePause,
} from "lucide-react";
import {
  labels,
  type FlowNode,
  type NodeRecord,
  type NodeKind,
} from "../../lib/model";
function hostname(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return "آدرس نیاز به اصلاح دارد";
  }
}
export const nodeIcons = {
  input: Braces,
  http: Globe,
  filter: ListFilter,
  sort: ArrowDownWideNarrow,
  condition: GitBranch,
  delay: Timer,
  output: Table2,
};
export type CanvasNode = Node<
  { node: FlowNode; record?: NodeRecord; invalid: boolean; locked: boolean },
  "flow"
>;
export const FlowCard = memo(function FlowCard({
  data,
  selected,
}: NodeProps<CanvasNode>) {
  const n = data.node,
    c = n.config,
    Icon = nodeIcons[c.type];
  const state = data.record?.status;
  const StateIcon =
    state === "succeeded"
      ? Check
      : state === "failed"
        ? AlertCircle
        : state === "running"
          ? LoaderCircle
          : state === "skipped"
            ? Minus
            : CirclePause;
  const preview = (kind: NodeKind) => {
    switch (kind) {
      case "input":
        return "JSON · نقطهٔ شروع";
      case "http":
        return c.type === "http" ? hostname(c.url) : "";
      case "filter":
        return c.type === "filter"
          ? `${c.path || "ریشه"} ${{ eq: "=", neq: "≠", gt: ">", lt: "<", contains: "شامل", exists: "موجود" }[c.operator]} ${JSON.stringify(c.value)}`
          : "";
      case "sort":
        return c.type === "sort"
          ? `${c.path || "ریشه"} · ${c.direction === "desc" ? "نزولی" : "صعودی"}`
          : "";
      case "condition":
        return "دو مسیر بر اساس دادهٔ ورودی";
      case "delay":
        return c.type === "delay"
          ? `${(c.ms / 1000).toLocaleString("fa")} ثانیه`
          : "";
      case "output":
        return "جدول / JSON / CSV";
    }
  };
  return (
    <div
      className={`flow-card kind-${c.type} ${selected ? "is-selected" : ""} ${state ? "node-" + state : ""} ${data.invalid ? "node-invalid" : ""}`}
      dir="rtl"
      aria-label={`بلوک ${n.label}`}
    >
      {c.type !== "input" && (
        <Handle
          id="in"
          type="target"
          position={Position.Left}
          aria-label="پورت ورودی"
        />
      )}
      <div className="node-head">
        <span className="node-icon">
          <Icon size={19} />
        </span>
        <div>
          <span className="node-kind">{labels[c.type]}</span>
          <strong>{n.label}</strong>
        </div>
        <span className="node-menu">···</span>
      </div>
      <p
        className="node-preview"
        dir={c.type === "http" || c.type === "filter" ? "ltr" : undefined}
      >
        {preview(c.type)}
      </p>
      <div className="node-footer">
        <span
          className={
            "node-tag " +
            (c.type === "http" && c.transport === "live" ? "live" : "")
          }
        >
          {c.type === "http"
            ? c.transport === "fixture"
              ? "دادهٔ آزمایشی"
              : c.method + " · زنده"
            : c.type === "input"
              ? "شروع"
              : c.type === "output"
                ? "پایان"
                : "پردازش"}
        </span>
        {state ? (
          <span className={"node-state " + state}>
            <StateIcon
              size={13}
              className={state === "running" ? "spin" : ""}
            />
            {
              (
                {
                  succeeded: "موفق",
                  running: "در حال اجرا",
                  failed: "خطا",
                  skipped: "ردشده",
                  pending: "آماده",
                  interrupted: "قطع‌شده",
                  cancelled: "لغو",
                } as const
              )[state]
            }
          </span>
        ) : (
          <span className="node-id">{n.id.slice(0, 4)}</span>
        )}
      </div>
      {c.type === "condition" ? (
        <>
          <Handle
            id="true"
            type="source"
            position={Position.Right}
            style={{ top: "36%" }}
            aria-label="پورت درست"
          />
          <span className="port-name true">درست</span>
          <Handle
            id="false"
            type="source"
            position={Position.Right}
            style={{ top: "76%" }}
            aria-label="پورت نادرست"
          />
          <span className="port-name false">نادرست</span>
        </>
      ) : (
        c.type !== "output" && (
          <Handle
            id="out"
            type="source"
            position={Position.Right}
            aria-label="پورت خروجی"
          />
        )
      )}
    </div>
  );
});
