import React, { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  icon?: ReactNode;
  iconBg?: string;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: "sm" | "md" | "lg";
}

export function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  iconBg = "rgba(194, 144, 90, 0.15)",
  children,
  footer,
  maxWidth = "sm",
}: ModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidthClass =
    maxWidth === "lg" ? "max-w-lg" : maxWidth === "md" ? "max-w-md" : "max-w-sm";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md transition-opacity animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className={`w-full ${maxWidthClass} rounded-2xl p-6 space-y-4 border shadow-2xl transition-all animate-in zoom-in-95 duration-200`}
        style={{
          background: "var(--color-surface)",
          borderColor: "var(--color-border)",
          boxShadow: "0 24px 48px -12px rgba(0, 0, 0, 0.75), 0 0 0 1px var(--color-border)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {(title || icon) && (
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              {icon && (
                <div
                  className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 border"
                  style={{
                    background: iconBg,
                    borderColor: "var(--color-border)",
                  }}
                >
                  {icon}
                </div>
              )}
              <div>
                {title && (
                  <h3 className="font-semibold text-base leading-tight" style={{ color: "var(--color-fg)" }}>
                    {title}
                  </h3>
                )}
                {subtitle && (
                  <p className="text-xs mt-0.5" style={{ color: "var(--color-muted)" }}>
                    {subtitle}
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800/80 transition-colors"
              title="Close"
            >
              <X size={15} />
            </button>
          </div>
        )}

        <div className="text-sm leading-relaxed" style={{ color: "var(--color-fg)" }}>
          {children}
        </div>

        {footer && <div className="pt-2 flex items-center justify-end gap-2.5">{footer}</div>}
      </div>
    </div>
  );
}
