import React, { useEffect, useId } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useApp } from "../../context/Appcontext";
import { getGlassTokens } from "../../styles/glassTheme";

const modalStack = [];
let savedBodyOverflow = "";

function syncModalDataset() {
  if (typeof document === "undefined") return;
  if (modalStack.length > 0) {
    document.documentElement.dataset.liraModalCount = String(modalStack.length);
  } else {
    delete document.documentElement.dataset.liraModalCount;
  }
}

export function hasOpenModal() {
  if (typeof document === "undefined") return false;
  return Number(document.documentElement.dataset.liraModalCount || 0) > 0;
}

const SIZE_MAP = {
  xs: "max-w-xs",
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
};

const VARIANT_STYLES = {
  default: {
    iconWrap: "",
    border: "",
  },
  primary: {
    iconWrap: "bg-indigo-500/15 border-indigo-500/30 text-indigo-400",
    border: "",
  },
  info: {
    iconWrap: "bg-sky-500/15 border-sky-500/30 text-sky-400",
    border: "",
  },
  success: {
    iconWrap: "bg-emerald-500/15 border-emerald-500/30 text-emerald-400",
    border: "",
  },
  warning: {
    iconWrap: "bg-amber-500/15 border-amber-500/30 text-amber-400",
    border: "ring-1 ring-amber-500/20",
  },
  danger: {
    iconWrap: "bg-rose-500/15 border-rose-500/30 text-rose-400",
    border: "ring-1 ring-rose-500/25",
  },
};

/**
 * Unified glassmorphic popup modal for Lira.
 * Coordinates Escape-key handling and stacking cleanly above SideDrawers and global sidebars.
 */
export default function GlassModal({
  isOpen,
  onClose,
  title,
  subtitle,
  icon: Icon,
  headerIcon,
  badge,
  size = "sm",
  variant = "default",
  closeOnBackdrop = true,
  closeOnEscape = true,
  showCloseButton = true,
  headerActions,
  children,
  footer,
  className = "",
}) {
  const { theme } = useApp();
  const isDark = theme === "dark";
  const g = getGlassTokens(isDark);
  const modalId = useId();
  const vStyle = VARIANT_STYLES[variant] || VARIANT_STYLES.default;

  useEffect(() => {
    if (!isOpen) return undefined;

    if (modalStack.length === 0 && typeof document !== "undefined") {
      savedBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    modalStack.push(modalId);
    syncModalDataset();

    const onKeyDown = (e) => {
      if (e.key !== "Escape" || !closeOnEscape) return;
      if (modalStack[modalStack.length - 1] !== modalId) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation?.();
      onClose?.();
    };

    window.addEventListener("keydown", onKeyDown, true);

    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      const idx = modalStack.lastIndexOf(modalId);
      if (idx !== -1) modalStack.splice(idx, 1);
      syncModalDataset();
      if (modalStack.length === 0 && typeof document !== "undefined") {
        document.body.style.overflow = savedBodyOverflow;
      }
    };
  }, [isOpen, onClose, closeOnEscape, modalId]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center p-4 overflow-y-auto pointer-events-auto"
          role="dialog"
          aria-modal="true"
          aria-label={typeof title === "string" ? title : "Modal Dialog"}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14, ease: "easeOut" }}
            onClick={() => {
              if (closeOnBackdrop) onClose?.();
            }}
            className="fixed inset-0 bg-black/60 backdrop-blur-[3px]"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 6 }}
            transition={{ type: "spring", damping: 28, stiffness: 420, mass: 0.7 }}
            onClick={(e) => e.stopPropagation()}
            className={`relative z-10 w-full ${SIZE_MAP[size] || SIZE_MAP.sm} max-h-[calc(100dvh-2rem)] flex flex-col rounded-2xl border shadow-2xl overflow-hidden ${g.drawer} ${vStyle.border} ${className}`}
          >
            {(title || Icon || headerIcon || showCloseButton || headerActions) && (
              <div className={`px-5 py-4 border-b flex items-start justify-between gap-3 ${g.subHeader}`}>
                <div className="flex items-start gap-3 min-w-0">
                  {headerIcon ? (
                    <div className="shrink-0 mt-0.5">{headerIcon}</div>
                  ) : Icon ? (
                    <div
                      className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${
                        vStyle.iconWrap || g.badge
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                  ) : null}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {title && (
                        <h3 className={`text-sm sm:text-[15px] font-bold tracking-tight ${g.heading}`}>
                          {title}
                        </h3>
                      )}
                      {badge}
                    </div>
                    {subtitle && (
                      <p className={`text-xs mt-0.5 leading-relaxed ${g.muted}`}>{subtitle}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {headerActions}
                  {showCloseButton && (
                    <button
                      type="button"
                      onClick={() => onClose?.()}
                      className={`p-1.5 rounded-lg transition-colors cursor-pointer ${g.iconBtn}`}
                      title="Close"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {children && <div className="px-4 sm:px-5 py-4 text-xs sm:text-sm overflow-y-auto flex-1 min-h-0">{children}</div>}

            {footer && (
              <div className={`px-4 sm:px-5 py-3.5 border-t flex flex-wrap items-center justify-end gap-2 shrink-0 ${g.subHeader}`}>
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

