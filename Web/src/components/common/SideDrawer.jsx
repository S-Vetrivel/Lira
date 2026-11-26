import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useApp } from "../../context/Appcontext";
import { getGlassTokens } from "../../styles/glassTheme";

export default function SideDrawer({
  isOpen,
  onClose,
  title,
  subtitle,
  icon: Icon,
  headerIcon,
  badge,
  widthClass,
  width,
  headerActions,
  children,
  footer,
}) {
  const { theme } = useApp();
  const isDark = theme === "dark";
  const g = getGlassTokens(isDark);
  const resolvedWidth = widthClass || width || "max-w-xl";

  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [isOpen, onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[70] overflow-hidden flex justify-end">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            onClick={onClose}
            className="fixed inset-0 bg-black/55 backdrop-blur-xs"
          />

          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 340, mass: 0.9 }}
            className={`relative w-full ${resolvedWidth} h-full flex flex-col z-10 border-l shadow-2xl ${g.drawer}`}
          >
            {/* Header */}
            <div
              className={`px-6 py-4 border-b flex items-center justify-between gap-3 shrink-0 ${g.subHeader}`}
            >
              <div className="flex items-center gap-3 min-w-0">
                {headerIcon ? (
                  <div className="shrink-0">{headerIcon}</div>
                ) : Icon ? (
                  <div
                    className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${g.badge}`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                ) : null}
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
              <div className={`px-6 py-3.5 border-t shrink-0 ${g.subHeader}`}>
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}

