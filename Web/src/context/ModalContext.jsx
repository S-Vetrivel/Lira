import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { AlertTriangle, CheckCircle2, Info, ShieldAlert, Sparkles } from "lucide-react";
import GlassModal from "../components/common/GlassModal";
import { useApp } from "./Appcontext";
import { getGlassTokens } from "../styles/glassTheme";

const ModalContext = createContext(null);

const VARIANT_META = {
  danger: {
    icon: AlertTriangle,
    confirmBtnDark: "bg-rose-600 hover:bg-rose-500 text-white border border-rose-500/60 shadow-lg shadow-rose-950/30 font-semibold",
    confirmBtnLight: "bg-rose-600 hover:bg-rose-700 text-white border border-rose-600 shadow-sm font-semibold",
  },
  warning: {
    icon: ShieldAlert,
    confirmBtnDark: "bg-amber-500 hover:bg-amber-400 text-zinc-950 border border-amber-400/60 font-semibold",
    confirmBtnLight: "bg-amber-600 hover:bg-amber-700 text-white border border-amber-600 font-semibold",
  },
  success: {
    icon: CheckCircle2,
    confirmBtnDark: "bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500/60 font-semibold",
    confirmBtnLight: "bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-600 font-semibold",
  },
  info: {
    icon: Info,
    confirmBtnDark: null,
    confirmBtnLight: null,
  },
  primary: {
    icon: Sparkles,
    confirmBtnDark: null,
    confirmBtnLight: null,
  },
};

export function ModalProvider({ children }) {
  const { theme } = useApp();
  const isDark = theme === "dark";
  const g = getGlassTokens(isDark);

  const [queue, setQueue] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [inputError, setInputError] = useState("");
  const inputRef = useRef(null);
  const active = queue[0] || null;

  useEffect(() => {
    if (!active) return;
    setInputValue(active.defaultValue || "");
    setInputError("");
    if (active.kind === "prompt") {
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [active]);

  const enqueueDialog = useCallback((config) => {
    return new Promise((resolve) => {
      setQueue((prev) => [...prev, { ...config, resolve, id: `${Date.now()}_${Math.random()}` }]);
    });
  }, []);

  const confirm = useCallback(
    (opts) => {
      const cfg = typeof opts === "string" ? { message: opts } : opts || {};
      return enqueueDialog({
        kind: "confirm",
        title: cfg.title || "Confirm Action",
        message: cfg.message || "Are you sure you want to proceed?",
        confirmLabel: cfg.confirmLabel || "Confirm",
        cancelLabel: cfg.cancelLabel || "Cancel",
        variant: cfg.variant || "danger",
        icon: cfg.icon || null,
        size: cfg.size || "sm",
      });
    },
    [enqueueDialog]
  );

  const alert = useCallback(
    (opts) => {
      const cfg = typeof opts === "string" ? { message: opts } : opts || {};
      return enqueueDialog({
        kind: "alert",
        title: cfg.title || "Notice",
        message: cfg.message || "",
        confirmLabel: cfg.confirmLabel || "OK",
        variant: cfg.variant || "info",
        icon: cfg.icon || null,
        size: cfg.size || "sm",
      });
    },
    [enqueueDialog]
  );

  const prompt = useCallback(
    (opts) => {
      const cfg = typeof opts === "string" ? { title: opts } : opts || {};
      return enqueueDialog({
        kind: "prompt",
        title: cfg.title || "Input Required",
        message: cfg.message || "",
        placeholder: cfg.placeholder || "Enter value...",
        defaultValue: cfg.defaultValue || "",
        confirmLabel: cfg.confirmLabel || "Submit",
        cancelLabel: cfg.cancelLabel || "Cancel",
        multiline: Boolean(cfg.multiline),
        required: cfg.required !== false,
        variant: cfg.variant || "primary",
        icon: cfg.icon || null,
        size: cfg.size || "sm",
      });
    },
    [enqueueDialog]
  );

  const settleActive = useCallback((result) => {
    setQueue((prev) => {
      const [head, ...rest] = prev;
      if (head?.resolve) head.resolve(result);
      return rest;
    });
  }, []);

  const handleClose = () => {
    if (!active) return;
    if (active.kind === "confirm") settleActive(false);
    else if (active.kind === "prompt") settleActive(null);
    else settleActive(undefined);
  };

  const handleConfirmSubmit = (e) => {
    e?.preventDefault?.();
    if (!active) return;
    if (active.kind === "prompt") {
      const trimmed = String(inputValue || "").trim();
      if (active.required && !trimmed) {
        setInputError("This field cannot be empty.");
        inputRef.current?.focus();
        return;
      }
      settleActive(trimmed);
      return;
    }
    if (active.kind === "confirm") settleActive(true);
    else settleActive(undefined);
  };

  const meta = active ? VARIANT_META[active.variant] || VARIANT_META.info : VARIANT_META.info;
  const ActiveIcon = active?.icon || meta.icon;
  const confirmBtnClass =
    (isDark ? meta.confirmBtnDark : meta.confirmBtnLight) || g.btnPrimary;

  return (
    <ModalContext.Provider value={{ confirm, alert, prompt }}>
      {children}

      <GlassModal
        isOpen={Boolean(active)}
        onClose={handleClose}
        title={active?.title}
        icon={ActiveIcon}
        variant={active?.variant || "default"}
        size={active?.size || "sm"}
        footer={
          active && (
            <>
              {active.kind !== "alert" && (
                <button
                  type="button"
                  onClick={handleClose}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${g.btnSecondary}`}
                >
                  {active.cancelLabel || "Cancel"}
                </button>
              )}
              <button
                type="button"
                onClick={handleConfirmSubmit}
                autoFocus={active.kind !== "prompt"}
                className={`px-4 py-2 rounded-xl text-xs transition-colors cursor-pointer ${confirmBtnClass}`}
              >
                {active.confirmLabel || "Confirm"}
              </button>
            </>
          )
        }
      >
        {active && (
          <form onSubmit={handleConfirmSubmit} className="space-y-3">
            {active.message && (
              <p className={`text-xs sm:text-[13px] leading-relaxed ${isDark ? "text-zinc-300" : "text-slate-600"}`}>
                {active.message}
              </p>
            )}

            {active.kind === "prompt" && (
              <div className="space-y-1.5">
                {active.multiline ? (
                  <textarea
                    ref={inputRef}
                    rows={3}
                    value={inputValue}
                    onChange={(e) => {
                      setInputValue(e.target.value);
                      if (inputError) setInputError("");
                    }}
                    placeholder={active.placeholder}
                    className={`w-full rounded-xl border px-3 py-2 text-xs sm:text-[13px] focus:outline-none transition-colors ${g.input}`}
                  />
                ) : (
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => {
                      setInputValue(e.target.value);
                      if (inputError) setInputError("");
                    }}
                    placeholder={active.placeholder}
                    className={`w-full rounded-xl border px-3 py-2 text-xs sm:text-[13px] focus:outline-none transition-colors ${g.input}`}
                  />
                )}
                {inputError && <p className="text-[11px] font-medium text-rose-400">{inputError}</p>}
              </div>
            )}
          </form>
        )}
      </GlassModal>
    </ModalContext.Provider>
  );
}

export function useModal() {
  const ctx = useContext(ModalContext);
  if (!ctx) {
    throw new Error("useModal must be used inside a ModalProvider");
  }
  return ctx;
}
