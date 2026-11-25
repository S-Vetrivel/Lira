import React, { useEffect } from "react";
import { X } from "lucide-react";
import { useApp } from "../../context/Appcontext";
import { getGlassTokens } from "../../styles/glassTheme";

export default function SideDrawer({
  isOpen,
  onClose,
  title,
  subtitle,
  icon: Icon,
  badge,
  widthClass = "max-w-xl",
  headerActions,
  children,
  footer,
}) {
  const { theme } = useApp();
  const isDark = theme === "dark";
  const g = getGlassTokens(isDark);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/55 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
      />

      <div
        className={`relative w-full ${widthClass} h-full flex flex-col z-10 border-l animate-in slide-in-from-right duration-200 ${g.drawer}`}
      >
        {/* Header */}
        <div
          className={`px-6 py-4 border-b flex items-center justify-between gap-3 shrink-0 ${g.subHeader}`}
        >
          <div className="flex items-center gap-3 min-w-0">
            {Icon && (
              <div
                className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${g.badge}`}
              >
                <Icon className="w-4 h-4" />
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold tracking-tight truncate">
                  {title}
                </h2>
                {badge}
              </div>
              {subtitle && (
                <p className={`text-xs truncate mt-0.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {headerActions}
            <button
              type="button"
              onClick={onClose}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                isDark
                  ? "text-slate-400 hover:text-white hover:bg-white/[0.06]"
                  : "text-slate-500 hover:text-slate-900 hover:bg-slate-200/70"
              }`}
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6">{children}</div>

        {/* Optional Footer */}
        {footer && (
          <div
            className={`px-6 py-3.5 border-t shrink-0 ${g.subHeader}`}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

