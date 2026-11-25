/**
 * Unified Neutral Gray Glassmorphic Design Tokens for Lira.
 * Single source of truth for both Dark (obsidian graphite glass) and Light (frosted silver-white glass).
 */

export const GLASS_TOKENS = {
  dark: {
    canvas: "lira-canvas-bg text-zinc-100",
    header: "bg-[#0c0d11]/82 border-white/[0.09] text-zinc-100 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.45)]",
    subHeader: "bg-[#111218]/68 border-white/[0.08] text-zinc-100 backdrop-blur-xl",
    navRail: "bg-white/[0.04] border-white/[0.09] backdrop-blur-xl shadow-inner shadow-black/30",
    navActivePill: "bg-gradient-to-b from-white/[0.18] to-white/[0.08] border border-white/[0.20] shadow-[0_4px_14px_rgba(0,0,0,0.45)] text-white",
    utilityTray: "bg-white/[0.04] border border-white/[0.09] backdrop-blur-xl",
    card: "lira-glass",
    cardGlow: "lira-glass-glow",
    cardActive: "lira-glass-glow ring-1 ring-white/25 border-white/25",
    drawer: "lira-glass-drawer text-zinc-100",
    dropdown: "glass-dropdown text-zinc-100",
    subtleSurface: "bg-white/[0.04] border-white/[0.08]",
    input:
      "bg-white/[0.05] border-white/[0.11] text-zinc-100 placeholder-zinc-500 focus:border-white/35 focus:bg-white/[0.08] backdrop-blur-md",
    btnPrimary:
      "bg-gradient-to-b from-zinc-50 to-zinc-300 text-zinc-950 hover:from-white hover:to-zinc-200 border border-white/50 shadow-[0_6px_18px_-6px_rgba(0,0,0,0.55)] font-semibold",
    btnSecondary:
      "bg-white/[0.05] hover:bg-white/[0.11] border border-white/[0.11] text-zinc-200 hover:text-white backdrop-blur-md",
    iconBtn:
      "bg-white/[0.04] hover:bg-white/[0.12] border border-white/[0.09] text-zinc-300 hover:text-white backdrop-blur-md",
    pillInactive:
      "bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.08] text-zinc-300 hover:text-white",
    pillActive:
      "bg-white text-zinc-950 font-semibold shadow-sm",
    badge: "bg-white/[0.07] border-white/[0.12] text-zinc-200",
    border: "border-white/[0.08]",
    muted: "text-zinc-400",
    heading: "text-zinc-50",
    accentIcon: "text-zinc-300",
    progressTrack: "bg-white/[0.08]",
    progressFill: "bg-gradient-to-r from-zinc-400 to-zinc-100",
    rowHover: "hover:bg-white/[0.06]",
    selectedRow: "bg-white/[0.09] border-white/[0.20] text-white",
  },
  light: {
    canvas: "lira-canvas-bg text-slate-900",
    header: "bg-white/82 border-slate-900/[0.09] text-slate-900 backdrop-blur-2xl shadow-[0_8px_28px_rgba(15,23,42,0.06)]",
    subHeader: "bg-white/68 border-slate-900/[0.08] text-slate-900 backdrop-blur-xl",
    navRail: "bg-slate-900/[0.04] border-slate-900/[0.09] backdrop-blur-xl",
    navActivePill: "bg-white border border-slate-900/[0.10] shadow-[0_3px_10px_rgba(15,23,42,0.08)] text-slate-950",
    utilityTray: "bg-slate-900/[0.04] border border-slate-900/[0.09] backdrop-blur-xl",
    card: "lira-glass",
    cardGlow: "lira-glass-glow",
    cardActive: "lira-glass-glow ring-1 ring-slate-900/20 border-slate-900/25",
    drawer: "lira-glass-drawer text-slate-900",
    dropdown: "glass-dropdown text-slate-900",
    subtleSurface: "bg-slate-900/[0.035] border-slate-900/[0.08]",
    input:
      "bg-white/80 border-slate-900/[0.11] text-slate-900 placeholder-slate-400 focus:border-slate-900/40 focus:bg-white backdrop-blur-md",
    btnPrimary:
      "bg-gradient-to-b from-zinc-800 to-zinc-950 text-white hover:from-zinc-700 hover:to-zinc-900 border border-zinc-900/80 shadow-[0_8px_20px_-6px_rgba(9,9,11,0.35)] font-semibold",
    btnSecondary:
      "bg-white/80 hover:bg-white border border-slate-900/[0.11] text-slate-700 hover:text-slate-950 backdrop-blur-md",
    iconBtn:
      "bg-white/80 hover:bg-white border border-slate-900/[0.11] text-slate-700 hover:text-slate-950 backdrop-blur-md",
    pillInactive:
      "bg-white/70 hover:bg-white border border-slate-900/[0.08] text-slate-600 hover:text-slate-950",
    pillActive:
      "bg-zinc-900 text-white font-semibold shadow-sm",
    badge: "bg-slate-900/[0.06] border-slate-900/[0.11] text-slate-700",
    border: "border-slate-900/[0.08]",
    muted: "text-slate-500",
    heading: "text-slate-950",
    accentIcon: "text-slate-700",
    progressTrack: "bg-slate-900/[0.08]",
    progressFill: "bg-gradient-to-r from-zinc-600 to-zinc-900",
    rowHover: "hover:bg-slate-900/[0.04]",
    selectedRow: "bg-slate-900/[0.07] border-slate-900/[0.18] text-slate-950",
  },
};

export function getGlassTokens(isDark) {
  return isDark ? GLASS_TOKENS.dark : GLASS_TOKENS.light;
}
