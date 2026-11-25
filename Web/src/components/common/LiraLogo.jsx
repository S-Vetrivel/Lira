import React from "react";

/**
 * Custom geometric brand logo for Lira Workspace.
 */
export default function LiraLogo({
  size = "md",
  showWordmark = true,
  showBadge = false,
  isDark = true,
  className = "",
}) {
  const sizes = {
    sm: { box: "w-7 h-7 rounded-lg", icon: "w-4 h-4", text: "text-lg" },
    md: { box: "w-8 h-8 rounded-xl", icon: "w-4.5 h-4.5", text: "text-xl" },
    lg: { box: "w-10 h-10 rounded-xl", icon: "w-5.5 h-5.5", text: "text-2xl" },
  };
  const cfg = sizes[size] || sizes.md;

  return (
    <span className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      <span
        className={`${cfg.box} flex items-center justify-center shrink-0 border transition-colors ${
          isDark
            ? "bg-white text-slate-950 border-white/20 shadow-sm"
            : "bg-slate-900 text-white border-slate-900/10 shadow-sm"
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={cfg.icon}
          aria-hidden="true"
        >
          {/* Architectural L-frame */}
          <path
            d="M6.5 4.5V16.5C6.5 17.6046 7.39543 18.5 8.5 18.5H18.5"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Parallel rhythm bar */}
          <path
            d="M11.5 6.5V13.5H17.5"
            stroke="#6366f1"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Anchor node */}
          <circle cx="17.5" cy="7.5" r="2" fill="#6366f1" />
        </svg>
      </span>

      {showWordmark && (
        <span className="inline-flex items-center gap-2">
          <span
            className={`${cfg.text} font-extrabold tracking-tight leading-none ${
              isDark ? "text-white" : "text-slate-950"
            }`}
          >
            lira
          </span>
          {showBadge && (
            <span
              className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                isDark
                  ? "bg-white/[0.04] border-white/[0.1] text-slate-300"
                  : "bg-slate-100 border-slate-200 text-slate-600"
              }`}
            >
              Workspace
            </span>
          )}
        </span>
      )}
    </span>
  );
}

