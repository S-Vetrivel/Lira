import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useApp } from "../../context/Appcontext";
import { LiraLogoMark } from "../common/LiraLogo";

/**
 * Animated Copilot Cursor Overlay:
 * Supports both single-target focus and multi-step sequential cursor playback using
 * the minimal monochrome Lira monogram badge without blocking page interaction.
 */
export default function AICursorOverlay() {
  const { aiCursorTarget, theme } = useApp();
  const isDark = theme === "dark";
  const [coords, setCoords] = useState(null);

  useEffect(() => {
    if (!aiCursorTarget) {
      return undefined;
    }

    const timers = [];
    const resolveTargetPos = (step) => {
      let x = window.innerWidth * 0.55;
      let y = window.innerHeight * 0.42;
      if (step?.selector) {
        const el = document.querySelector(step.selector);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            x = Math.min(window.innerWidth - 150, Math.max(24, rect.left + Math.min(rect.width * 0.35, 80)));
            y = Math.min(window.innerHeight - 60, Math.max(78, rect.top + rect.height * 0.5));
          }
        }
      } else if (typeof step?.x === "number" && typeof step?.y === "number") {
        x = step.x;
        y = step.y;
      }
      return {
        x,
        y,
        label: step?.label || "Lira Copilot",
        nonce: aiCursorTarget.nonce || Date.now(),
      };
    };

    const steps =
      Array.isArray(aiCursorTarget.sequence) && aiCursorTarget.sequence.length > 0
        ? aiCursorTarget.sequence
        : [aiCursorTarget];

    let elapsed = 80;
    steps.forEach((step, idx) => {
      const waitMs = elapsed;
      timers.push(
        setTimeout(() => {
          if (step?.selector) {
            const targetEl = document.querySelector(step.selector);
            if (targetEl) {
              targetEl.scrollIntoView?.({ behavior: "smooth", block: "center" });
              targetEl.focus?.({ preventScroll: true });
            }
          }
          setTimeout(() => setCoords(resolveTargetPos(step)), 60);
        }, waitMs)
      );
      elapsed += Number(step?.delayMs || (idx === 0 ? 750 : 900));
    });

    timers.push(setTimeout(() => setCoords(null), elapsed + 1100));

    return () => timers.forEach((t) => clearTimeout(t));
  }, [aiCursorTarget]);

  return (
    <AnimatePresence>
      {aiCursorTarget && coords && (
        <motion.div
          initial={{ opacity: 0, x: window.innerWidth - 96, y: window.innerHeight - 96, scale: 0.85 }}
          animate={{ opacity: 1, x: coords.x, y: coords.y, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ type: "spring", damping: 24, stiffness: 220 }}
          className="fixed top-0 left-0 z-[90] pointer-events-none select-none flex items-center gap-1.5"
        >
          <span
            className={`relative flex items-center justify-center w-7 h-7 rounded-full border shadow-lg ${
              isDark
                ? "bg-gradient-to-b from-zinc-100 to-zinc-300 text-zinc-950 border-white/40 shadow-black/50"
                : "bg-gradient-to-b from-zinc-800 to-zinc-950 text-white border-zinc-900/25 shadow-zinc-900/25"
            }`}
          >
            <LiraLogoMark
              className="w-4 h-4"
              primaryColor="currentColor"
              secondaryColor={isDark ? "#52525b" : "#a1a1aa"}
              dotColor={isDark ? "#18181b" : "#e4e4e7"}
              strokeWidth={2.4}
            />
          </span>
          <span
            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border shadow-xl backdrop-blur-md whitespace-nowrap ${
              isDark
                ? "bg-[#121318]/92 text-zinc-100 border-white/15"
                : "bg-white/95 text-slate-900 border-slate-900/15"
            }`}
          >
            {coords.label}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
