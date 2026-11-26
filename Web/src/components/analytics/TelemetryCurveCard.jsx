import React, { useMemo, useState, useId } from "react";
import { Activity } from "lucide-react";
import { useApp } from "../../context/Appcontext";
import { getGlassTokens } from "../../styles/glassTheme";

export const TELEMETRY_RANGES = [
  { key: "1h", label: "1H" },
  { key: "6h", label: "6H" },
  { key: "24h", label: "24H" },
  { key: "7d", label: "7D" },
  { key: "14d", label: "14D" },
  { key: "30d", label: "30D" },
];

/**
 * Dashboard-style smooth cubic-bezier SVG telemetry card with time-range switcher (1H -> 30D),
 * dual-series overlay, KPI strip, and interactive hover crosshair tooltip.
 */
export default function TelemetryCurveCard({
  title,
  subtitle,
  icon: Icon = Activity,
  iconClass = "text-indigo-400",
  range = "24h",
  onRangeChange,
  loading = false,
  metrics = [],
  series = [],
  primaryKey = "value",
  primaryLabel = "Primary",
  primaryColor = "#34d399",
  secondaryKey = "",
  secondaryLabel = "Secondary",
  secondaryColor = "#818cf8",
  formatValue = (v) => String(v ?? 0),
  formatSecondary = (v) => String(v ?? 0),
  renderTooltipExtra = null,
}) {
  const { theme } = useApp();
  const isDark = theme === "dark";
  const g = getGlassTokens(isDark);
  const gradId = useId().replace(/:/g, "");
  const [hoverIdx, setHoverIdx] = useState(null);

  const chart = useMemo(() => {
    if (!Array.isArray(series) || series.length === 0) return null;
    const W = 520;
    const H = 128;
    const px = 16;
    const pyTop = 16;
    const pyBot = 10;
    const usableH = H - pyTop - pyBot;

    const maxPrimary = Math.max(...series.map((d) => Number(d[primaryKey]) || 0), 1);
    const maxSecondary = secondaryKey
      ? Math.max(...series.map((d) => Number(d[secondaryKey]) || 0), 1)
      : 1;
    const stepX = series.length > 1 ? (W - px * 2) / (series.length - 1) : 0;

    const pts = series.map((d, i) => {
      const pVal = Number(d[primaryKey]) || 0;
      const sVal = secondaryKey ? Number(d[secondaryKey]) || 0 : 0;
      const x = series.length === 1 ? W / 2 : px + i * stepX;
      const y = H - pyBot - (pVal / maxPrimary) * usableH;
      const sy = H - pyBot - (sVal / maxSecondary) * (usableH * 0.88);
      return { x, y, sy, pVal, sVal, raw: d, idx: i };
    });

    const buildSmoothPath = (getY) => {
      let d = `M ${pts[0].x},${getY(pts[0])}`;
      for (let i = 1; i < pts.length; i++) {
        const p = pts[i - 1];
        const c = pts[i];
        const cx = (p.x + c.x) / 2;
        d += ` C ${cx},${getY(p)} ${cx},${getY(c)} ${c.x},${getY(c)}`;
      }
      return d;
    };

    const primaryD = buildSmoothPath((p) => p.y);
    const areaD = `${primaryD} L ${pts[pts.length - 1].x},${H} L ${pts[0].x},${H} Z`;
    const secondaryD = secondaryKey ? buildSmoothPath((p) => p.sy) : "";

    return { W, H, pts, primaryD, areaD, secondaryD };
  }, [series, primaryKey, secondaryKey]);

  const activePoint =
    chart && chart.pts.length > 0
      ? chart.pts[hoverIdx !== null && chart.pts[hoverIdx] ? hoverIdx : chart.pts.length - 1]
      : null;

  const tickStride = series.length > 20 ? 5 : series.length > 12 ? 3 : series.length > 8 ? 2 : 1;

  return (
    <div className={`rounded-2xl p-4 sm:p-5 border flex flex-col gap-3 overflow-hidden ${g.cardGlow}`}>
      {/* Header + 1H..30D Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center border shrink-0 ${g.badge}`}>
            <Icon className={`w-4 h-4 ${iconClass}`} />
          </div>
          <div className="min-w-0">
            <h2 className={`text-sm font-display font-bold leading-tight truncate ${g.heading}`}>
              {title}
            </h2>
            <span className="text-[10px] font-semibold uppercase tracking-widest opacity-55 block truncate">
              {subtitle}
            </span>
          </div>
        </div>

        <div className={`flex items-center p-0.5 rounded-full border gap-0.5 ${g.subtleSurface}`}>
          {TELEMETRY_RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => onRangeChange?.(r.key)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all cursor-pointer ${
                range === r.key ? g.pillActive : `${g.muted} hover:opacity-100`
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Metrics Strip */}
      {metrics.length > 0 && (
        <div className="flex flex-wrap items-center gap-4 sm:gap-5">
          {metrics.map((m, idx) => (
            <React.Fragment key={m.label}>
              {idx > 0 && (
                <div className={`hidden sm:block w-px h-8 ${isDark ? "bg-white/[0.08]" : "bg-slate-200"}`} />
              )}
              <div className="min-w-[80px]">
                <div className="flex items-center gap-1.5">
                  <span className={`text-xl sm:text-2xl font-display font-bold tabular-nums ${g.heading}`}>
                    {m.value}
                  </span>
                  {m.badge && (
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${g.badge}`}>
                      {m.badge}
                    </span>
                  )}
                </div>
                <span className={`block text-[10px] mt-0.5 ${g.muted}`}>{m.sublabel || m.label}</span>
              </div>
            </React.Fragment>
          ))}
        </div>
      )}

      {/* Smooth SVG Curve */}
      <div className="relative min-h-[148px] flex-1">
        {/* Legend Pill */}
        {activePoint && (
          <div
            className={`absolute top-0 right-0 z-10 flex items-center gap-2 rounded-full px-2.5 py-1 text-[10px] border backdrop-blur-md ${g.badge}`}
          >
            <span className="font-mono opacity-80">{activePoint.raw.fullLabel || activePoint.raw.label}</span>
            <span className="opacity-30">·</span>
            <span className="flex items-center gap-1 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: primaryColor }} />
              {formatValue(activePoint.pVal)} {primaryLabel}
            </span>
            {secondaryKey && (
              <>
                <span className="opacity-30">·</span>
                <span className="flex items-center gap-1 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: secondaryColor }} />
                  {formatSecondary(activePoint.sVal)} {secondaryLabel}
                </span>
              </>
            )}
            {renderTooltipExtra && renderTooltipExtra(activePoint.raw)}
          </div>
        )}

        {chart ? (
          <svg
            viewBox={`0 0 ${chart.W} ${chart.H}`}
            className={`w-full h-36 overflow-visible ${loading ? "opacity-60 transition-opacity" : ""}`}
            onMouseLeave={() => setHoverIdx(null)}
          >
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={primaryColor} stopOpacity="0.34" />
                <stop offset="100%" stopColor={primaryColor} stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Subtle horizontal guide lines */}
            {[0.25, 0.5, 0.75].map((frac) => (
              <line
                key={frac}
                x1="12"
                y1={chart.H * frac}
                x2={chart.W - 12}
                y2={chart.H * frac}
                stroke={isDark ? "rgba(255,255,255,0.05)" : "rgba(15,23,42,0.06)"}
                strokeDasharray="3 3"
              />
            ))}

            {activePoint && (
              <line
                x1={activePoint.x}
                y1="10"
                x2={activePoint.x}
                y2={chart.H - 4}
                stroke={isDark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.14)"}
                strokeDasharray="2 3"
              />
            )}

            <path d={chart.areaD} fill={`url(#${gradId})`} />

            {chart.secondaryD && (
              <path
                d={chart.secondaryD}
                fill="none"
                stroke={secondaryColor}
                strokeWidth="1.6"
                strokeLinecap="round"
                opacity="0.82"
              />
            )}

            <path
              d={chart.primaryD}
              fill="none"
              stroke={primaryColor}
              strokeWidth="2.3"
              strokeLinecap="round"
            />

            {activePoint && (
              <>
                {secondaryKey && (
                  <circle
                    cx={activePoint.x}
                    cy={activePoint.sy}
                    r="3.2"
                    fill={secondaryColor}
                    stroke={isDark ? "#090a0d" : "#fff"}
                    strokeWidth="1.5"
                  />
                )}
                <circle
                  cx={activePoint.x}
                  cy={activePoint.y}
                  r="4.5"
                  fill={primaryColor}
                  stroke={isDark ? "#090a0d" : "#fff"}
                  strokeWidth="2"
                />
              </>
            )}

            {/* Invisible wide hover hit columns per bucket */}
            {chart.pts.map((p, idx) => {
              const colW = chart.pts.length > 1 ? chart.W / chart.pts.length : chart.W;
              return (
                <rect
                  key={idx}
                  x={Math.max(0, p.x - colW / 2)}
                  y={0}
                  width={colW}
                  height={chart.H}
                  fill="transparent"
                  className="cursor-crosshair"
                  onMouseEnter={() => setHoverIdx(idx)}
                />
              );
            })}
          </svg>
        ) : (
          <div className="h-36 flex items-center justify-center gap-2 opacity-45">
            <Activity className="w-4 h-4" />
            <span className="text-xs">No telemetry points in this window yet</span>
          </div>
        )}
      </div>

      {/* X-Axis Labels */}
      {series.length > 0 && (
        <div className={`flex items-center justify-between text-[9px] font-mono ${g.muted}`}>
          {series.map((d, i) => {
            if (i % tickStride !== 0 && i !== series.length - 1) return null;
            return (
              <span key={`${d.iso || d.label}_${i}`} className={i === series.length - 1 ? `font-bold ${g.heading}` : ""}>
                {d.label}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

