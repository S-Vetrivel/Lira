import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useApp } from "../../context/Appcontext";
import { getGlassTokens } from "../../styles/glassTheme";
import { hasOpenModal } from "./GlassModal";

export default function SideDrawer({
  sidebarId,
  position = "right",
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
  drawerProps = {},
}) {
  const isLeft = position === "left";
  const { theme } = useApp();
  const isDark = theme === "dark";
  const g = getGlassTokens(isDark);
  const resolvedWidth = widthClass || width || "max-w-xl";
  const resolvedId = sidebarId || `drawer:${String(title || "default").toLowerCase().replace(/\W+/g, "-")}`;

  useEffect(() => {
    const onOtherSidebar = (e) => {
      if (isOpen && e?.detail?.id && e.detail.id !== resolvedId) {
        onClose?.();
      }
    };
    const onCloseAll = (e) => {
      if (isOpen && e?.detail?.except !== resolvedId) {
        onClose?.();
      }
    };
    window.addEventListener("lira:sidebar-opened", onOtherSidebar);
    window.addEventListener("lira:close-all-sidebars", onCloseAll);
    return () => {
      window.removeEventListener("lira:sidebar-opened", onOtherSidebar);
      window.removeEventListener("lira:close-all-sidebars", onCloseAll);
    };
  }, [isOpen, onClose, resolvedId]);

  useEffect(() => {
    if (!isOpen) return;
    window.dispatchEvent(new CustomEvent("lira:sidebar-opened", { detail: { id: resolvedId } }));
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape" && !hasOpenModal()) onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [isOpen, onClose, resolvedId]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className={`fixed inset-0 z-[70] overflow-hidden flex ${isLeft ? "justify-start" : "justify-end"} pointer-events-none`}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, pointerEvents: "auto" }}
            exit={{ opacity: 0, pointerEvents: "none" }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            onClick={onClose}
            className="fixed inset-0 bg-black/55 backdrop-blur-xs"
          />

          <motion.div
            initial={{ x: isLeft ? "-100%" : "100%" }}
            animate={{ x: 0, pointerEvents: "auto" }}
            exit={{ x: isLeft ? "-100%" : "100%", pointerEvents: "none" }}
            transition={{ type: "spring", damping: 32, stiffness: 390, mass: 0.8 }}
            {...drawerProps}
            className={`relative w-full ${resolvedWidth} h-full flex flex-col z-10 ${isLeft ? "border-r" : "border-l"} shadow-2xl ${g.drawer} ${drawerProps.className || ""}`}
          >
            {/* Header */}
            <div
              className={`px-4 sm:px-6 py-3.5 sm:py-4 border-b flex items-center justify-between gap-3 shrink-0 ${g.subHeader}`}
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
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</div>

            {/* Optional Footer */}
            {footer && (
              <div className={`px-4 sm:px-6 py-3 sm:py-3.5 border-t shrink-0 ${g.subHeader}`}>
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

