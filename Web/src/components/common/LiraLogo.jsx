import React from "react";

/**
 * Pure geometric strokes of the Lira monogram so it can fit full-bleed
 * inside rounded-square badges, full circular pebbles, favicons, and headers.
 */
export function LiraLogoMark({
  className = "w-5 h-5",
  primaryColor = "currentColor",
  secondaryColor = "#a1a1aa",
  dotColor = "#ffffff",
  strokeWidth = 2.4,
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      data-lira-logo="true"
      aria-hidden="true"
    >
      {/* Architectural L-frame */}
      <path
        d="M6.2 4.5V16.8C6.2 17.9046 7.09543 18.8 8.2 18.8H18.5"
        stroke={primaryColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Parallel rhythm bar */}
      <path
        d="M11.2 6.5V13.8H17.6"
        stroke={secondaryColor}
        strokeWidth={Math.max(1.8, strokeWidth - 0.25)}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Anchor node */}
      <circle cx="17.8" cy="7.3" r="2.05" fill={dotColor} />
    </svg>
  );
}

/**
 * Custom geometric brand logo for Lira Workspace.
 */
export default function LiraLogo({
  size = "md",
  shape = "square",
  showBackground = true,
  showWordmark = true,
  showBadge = false,
  isDark = true,
  className = "",
}) {
  const sizes = {
    sm: { box: "w-7 h-7", radius: shape === "circle" ? "rounded-full" : "rounded-lg", icon: "w-4 h-4", text: "text-lg" },
    md: { box: "w-8 h-8", radius: shape === "circle" ? "rounded-full" : "rounded-xl", icon: "w-4.5 h-4.5", text: "text-xl" },
    lg: { box: "w-10 h-10", radius: shape === "circle" ? "rounded-full" : "rounded-xl", icon: "w-6 h-6", text: "text-2xl" },
  };
  const cfg = sizes[size] || sizes.md;

  const mark = (
    <LiraLogoMark
      className={cfg.icon}
      primaryColor="currentColor"
      secondaryColor={isDark ? "#52525b" : "#a1a1aa"}
      dotColor={isDark ? "#18181b" : "#e4e4e7"}
    />
  );

  return (
    <span className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      {showBackground ? (
        <span
          className={`${cfg.box} ${cfg.radius} flex items-center justify-center shrink-0 border transition-colors ${
            isDark
              ? "bg-gradient-to-b from-zinc-100 to-zinc-300 text-zinc-950 border-white/30 shadow-sm shadow-black/40"
              : "bg-gradient-to-b from-zinc-800 to-zinc-950 text-white border-zinc-900/20 shadow-sm shadow-zinc-900/20"
          }`}
        >
          {mark}
        </span>
      ) : (
        mark
      )}

      {showWordmark && (
        <span className="inline-flex items-center gap-2">
          <span
            className={`${cfg.text} font-extrabold tracking-tight leading-none ${
              isDark ? "text-zinc-50" : "text-slate-950"
            }`}
          >
            lira
          </span>
          {showBadge && (
            <span
              className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border backdrop-blur-md ${
                isDark
                  ? "bg-white/[0.06] border-white/[0.12] text-zinc-300"
                  : "bg-slate-900/[0.05] border-slate-900/[0.10] text-slate-600"
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
