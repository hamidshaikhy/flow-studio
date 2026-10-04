import {
  useEffect,
  useRef,
  isValidElement,
  cloneElement,
  Children,
  type ReactNode,
} from "react";
import { X, type LucideIcon } from "lucide-react";
export function IconButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  className = "",
}: {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      className={"icon-button " + className}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
    >
      <Icon size={18} />
    </button>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    const previous = document.activeElement;
    el?.showModal();
    return () => {
      el?.close();
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <header>
        <h2>{title}</h2>
        <IconButton icon={X} label="بستن پنجره" onClick={onClose} />
      </header>
      {children}
    </dialog>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {Children.map(children, (child) =>
        isValidElement<Record<string, unknown>>(child) &&
        typeof child.type === "string" &&
        ["input", "select", "textarea"].includes(child.type)
          ? cloneElement(child, {
              "aria-label": child.props["aria-label"] ?? label,
            })
          : child,
      )}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export const statusNames: Record<string, string> = {
  pending: "در انتظار",
  running: "در حال اجرا",
  paused: "متوقف",
  succeeded: "موفق",
  failed: "ناموفق",
  skipped: "ردشده",
  cancelled: "لغوشده",
  interrupted: "قطع‌شده",
};
export function Status({ value }: { value: string }) {
  return (
    <span className={"status status-" + value}>
      <span className="status-dot" />
      {statusNames[value] ?? value}
    </span>
  );
}
