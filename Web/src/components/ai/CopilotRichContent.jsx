import React, { useMemo } from "react";
import DOMPurify from "dompurify";
import {
  Download,
  BarChart3,
  FileSpreadsheet,
  FileText,
  Presentation,
  Image as ImageIcon,
  Table2,
} from "lucide-react";
import { exportAIAssistantArtifactAPI } from "../../services/api";
import { getGlassTokens } from "../../styles/glassTheme";

const PALETTE = ["#a855f7", "#38bdf8", "#10b981", "#f59e0b", "#f43f5e", "#6366f1"];

function getThemeCssVars(isDark) {
  if (isDark) {
    return {
      "--lira-card": "rgba(255,255,255,0.045)",
      "--lira-surface": "rgba(255,255,255,0.03)",
      "--lira-border": "rgba(255,255,255,0.12)",
      "--lira-text": "#f4f4f5",
      "--lira-muted": "#a1a1aa",
      "--lira-accent-bg": "rgba(168,85,247,0.18)",
      "--lira-accent-text": "#e9d5ff",
      "--lira-danger-bg": "rgba(244,63,94,0.18)",
      "--lira-danger-text": "#fda4af",
    };
  }
  return {
    "--lira-card": "rgba(255,255,255,0.88)",
    "--lira-surface": "rgba(15,23,42,0.04)",
    "--lira-border": "rgba(15,23,42,0.12)",
    "--lira-text": "#0f172a",
    "--lira-muted": "#64748b",
    "--lira-accent-bg": "rgba(147,51,234,0.12)",
    "--lira-accent-text": "#6b21a8",
    "--lira-danger-bg": "rgba(225,29,72,0.1)",
    "--lira-danger-text": "#be123c",
  };
}

function downloadSvgElementAsPng(svgEl, filename = "lira-visual") {
  if (!svgEl) return;
  const xml = new XMLSerializer().serializeToString(svgEl);
  const svgBlob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(720, img.width * 2);
    canvas.height = Math.max(360, img.height * 2);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#11131a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((pngBlob) => {
      if (pngBlob) {
        const pngUrl = URL.createObjectURL(pngBlob);
        const a = document.createElement("a");
        a.href = pngUrl;
        a.download = `${filename}.png`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(pngUrl), 2000);
      }
    }, "image/png");
    URL.revokeObjectURL(url);
  };
  img.src = url;
}

let domPurifyHookAttached = false;
if (!domPurifyHookAttached && typeof window !== "undefined") {
  DOMPurify.addHook("uponSanitizeElement", (node) => {
    if (node?.tagName === "INPUT") {
      const t = String(node.getAttribute?.("type") || "").toLowerCase();
      if (t !== "checkbox" && t !== "radio") {
        node.parentNode?.removeChild(node);
      }
    }
  });
  domPurifyHookAttached = true;
}

export function SanitizedCopilotHtml({ html, isDark, onStepClick, onReplyClick }) {
  const containerRef = React.useRef(null);
  const [submittingForm, setSubmittingForm] = React.useState(false);

  const cleanHtml = useMemo(() => {
    if (!html) return "";
    return DOMPurify.sanitize(html, {
      ADD_TAGS: ["input", "label"],
      ADD_ATTR: ["type", "name", "value", "checked"],
      FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form", "link", "meta", "base", "applet"],
      FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onfocus", "onblur", "srcdoc", "formaction"],
      ALLOW_DATA_ATTR: true,
    });
  }, [html]);

  if (!cleanHtml) return null;

  const handleClick = async (e) => {
    const submitFormTarget = e.target.closest("[data-lira-submit-form]");
    if (submitFormTarget) {
      e.preventDefault();
      if (submittingForm) return;
      const formType = submitFormTarget.getAttribute("data-lira-submit-form");
      const scopeEl = submitFormTarget.closest("[data-lira-form]") || containerRef.current;
      if (!formType || !scopeEl) return;

      const allChecked = Array.from(scopeEl.querySelectorAll('input[type="checkbox"]:checked'));
      const modules = allChecked
        .filter((el) => el.getAttribute("data-lira-checkbox-group") === "modules")
        .map((el) => el.value)
        .filter(Boolean);

      const defaultBox = scopeEl.querySelector('input[type="checkbox"][data-lira-field="isDefault"]');
      const roleId = submitFormTarget.getAttribute("data-lira-role-id") || "";
      const roleName = submitFormTarget.getAttribute("data-lira-role-name") || "";

      let stepPayload;
      if (formType === "update_role" || formType === "create_role" || modules.length > 0 || defaultBox || roleId) {
        stepPayload = {
          type: formType,
          label: `Configure ${roleName || "role"} (${modules.length} module${modules.length === 1 ? "" : "s"})`,
          prefill: {
            ...(roleId ? { roleId } : {}),
            ...(roleName ? { name: roleName } : {}),
            modules,
            ...(defaultBox ? { isDefault: Boolean(defaultBox.checked) } : {}),
          },
        };
      } else {
        const selectedValues = allChecked.map((el) => el.value).filter(Boolean);
        const pluralKeyMap = {
          delete_user: "userIds",
          delete_project: "projectIds",
          delete_department: "departmentIds",
          delete_task: "taskIds",
          delete_role: "roleIds",
        };
        const targetKey = pluralKeyMap[formType] || "selectedIds";
        stepPayload = {
          type: formType,
          label: `${formType.replace(/_/g, " ")} (${selectedValues.length} selected)`,
          prefill: { [targetKey]: selectedValues },
        };
      }

      setSubmittingForm(true);
      try {
        await onStepClick?.(stepPayload);
      } finally {
        setSubmittingForm(false);
      }
      return;
    }

    const stepTarget = e.target.closest("[data-lira-step]");
    if (stepTarget) {
      e.preventDefault();
      try {
        const parsed = JSON.parse(stepTarget.getAttribute("data-lira-step") || "{}");
        if (parsed && parsed.type) onStepClick?.(parsed);
      } catch {
        // ignore malformed step payload
      }
      return;
    }
    const replyTarget = e.target.closest("[data-lira-reply]");
    if (replyTarget) {
      e.preventDefault();
      const text = replyTarget.getAttribute("data-lira-reply");
      if (text) onReplyClick?.(text);
    }
  };

  return (
    <div
      ref={containerRef}
      style={getThemeCssVars(isDark)}
      onClick={handleClick}
      className={`w-full max-w-full overflow-x-auto space-y-2 [&>*]:max-w-full ${submittingForm ? "opacity-70 pointer-events-none" : ""}`}
      dangerouslySetInnerHTML={{ __html: cleanHtml }}
    />
  );
}

function WorkspaceChartCard({ artifact, isDark, g }) {
  const labels = Array.isArray(artifact.labels) ? artifact.labels : [];
  const values = Array.isArray(artifact.values) ? artifact.values.map((v) => Number(v) || 0) : [];
  const maxVal = Math.max(1, ...values);
  const total = values.reduce((a, b) => a + b, 0) || 1;
  const chartRef = React.useRef(null);

  return (
    <div className={`p-3 rounded-xl border space-y-2.5 w-full ${g.subtleSurface}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[11px] font-bold min-w-0">
          <BarChart3 className="w-3.5 h-3.5 text-purple-400 shrink-0" />
          <span className="truncate">{artifact.title || "Workspace Analytics"}</span>
        </div>
        <button
          type="button"
          onClick={() => downloadSvgElementAsPng(chartRef.current, (artifact.title || "chart").replace(/\W+/g, "_"))}
          className={`px-2 py-1 rounded-lg border text-[10px] font-semibold flex items-center gap-1 cursor-pointer shrink-0 ${g.btnSecondary}`}
        >
          <Download className="w-3 h-3" />
          <span>PNG</span>
        </button>
      </div>

      {artifact.chartType === "pie" ? (
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <svg ref={chartRef} viewBox="0 0 120 120" className="w-28 h-28 shrink-0">
            {values.reduce(
              (acc, val, i) => {
                const angle = (val / total) * Math.PI * 2;
                const x1 = 60 + 48 * Math.cos(acc.cur);
                const y1 = 60 + 48 * Math.sin(acc.cur);
                const next = acc.cur + angle;
                const x2 = 60 + 48 * Math.cos(next);
                const y2 = 60 + 48 * Math.sin(next);
                const large = angle > Math.PI ? 1 : 0;
                const path =
                  val <= 0
                    ? null
                    : values.filter((x) => x > 0).length === 1
                      ? <circle key={i} cx="60" cy="60" r="48" fill={PALETTE[i % PALETTE.length]} />
                      : (
                        <path
                          key={i}
                          d={`M 60 60 L ${x1} ${y1} A 48 48 0 ${large} 1 ${x2} ${y2} Z`}
                          fill={PALETTE[i % PALETTE.length]}
                          stroke={isDark ? "#0e1017" : "#fff"}
                          strokeWidth="1.5"
                        />
                      );
                return { cur: next, nodes: [...acc.nodes, path] };
              },
              { cur: -Math.PI / 2, nodes: [] }
            ).nodes}
          </svg>
          <div className="flex-1 w-full space-y-1">
            {labels.map((lbl, i) => (
              <div key={i} className="flex items-center justify-between text-[11px] gap-2">
                <span className="flex items-center gap-1.5 truncate">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: PALETTE[i % PALETTE.length] }} />
                  <span className="truncate">{lbl}</span>
                </span>
                <span className="font-mono font-bold">{values[i] ?? 0}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          <svg
            ref={chartRef}
            viewBox={`0 0 320 ${Math.max(110, labels.length * 28 + 16)}`}
            className="w-full h-auto"
          >
            {labels.map((lbl, i) => {
              const val = values[i] ?? 0;
              const barW = Math.max(6, (val / maxVal) * 185);
              const y = 12 + i * 28;
              return (
                <g key={i}>
                  <text x="4" y={y + 13} fontSize="10" fill={isDark ? "#cbd5e1" : "#334155"}>
                    {String(lbl).slice(0, 14)}
                  </text>
                  <rect
                    x="92"
                    y={y + 2}
                    width={barW}
                    height="15"
                    rx="4"
                    fill={PALETTE[i % PALETTE.length]}
                  />
                  <text
                    x={92 + barW + 6}
                    y={y + 13}
                    fontSize="10"
                    fontWeight="bold"
                    fill={isDark ? "#f8fafc" : "#0f172a"}
                  >
                    {val}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      )}
    </div>
  );
}

export function CopilotArtifactsList({ artifacts = [], isDark }) {
  const g = getGlassTokens(isDark);
  if (!Array.isArray(artifacts) || artifacts.length === 0) return null;

  return (
    <div className="space-y-2.5 w-full">
      {artifacts.map((art, idx) => {
        if (art.type === "chart") {
          return <WorkspaceChartCard key={idx} artifact={art} isDark={isDark} g={g} />;
        }

        if (art.type === "csv" || art.type === "table") {
          const headers = art.headers || art.columns || [];
          const rows = art.rows || [];
          return (
            <div key={idx} className={`p-3 rounded-xl border space-y-2 w-full ${g.subtleSurface}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-[11px] font-bold truncate">
                  {art.type === "csv" ? (
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  ) : (
                    <Table2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  )}
                  <span className="truncate">{art.title || "Workspace Table"}</span>
                </div>
                <button
                  type="button"
                  onClick={() => exportAIAssistantArtifactAPI({ format: "csv", artifact: art })}
                  className={`px-2 py-1 rounded-lg border text-[10px] font-semibold flex items-center gap-1 cursor-pointer shrink-0 ${g.btnSecondary}`}
                >
                  <Download className="w-3 h-3" />
                  <span>CSV</span>
                </button>
              </div>
              {headers.length > 0 && (
                <div className={`overflow-auto max-h-44 rounded-lg border ${g.border}`}>
                  <table className="w-full text-left border-collapse text-[10px]">
                    <thead className={isDark ? "bg-white/[0.06]" : "bg-slate-900/[0.06]"}>
                      <tr>
                        {headers.map((h, i) => (
                          <th key={i} className="px-2 py-1.5 font-bold whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 8).map((r, rIdx) => (
                        <tr key={rIdx} className={`border-t ${g.border}`}>
                          {(r || []).map((cell, cIdx) => (
                            <td key={cIdx} className="px-2 py-1 truncate max-w-[140px]">
                              {String(cell ?? "")}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        }

        if (art.type === "pdf" || art.type === "ppt") {
          const isPpt = art.type === "ppt";
          const IconComp = isPpt ? Presentation : FileText;
          return (
            <div key={idx} className={`p-3 rounded-xl border flex items-center justify-between gap-3 w-full ${g.subtleSurface}`}>
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${g.badge}`}>
                  <IconComp className={`w-4 h-4 ${isPpt ? "text-amber-400" : "text-rose-400"}`} />
                </div>
                <div className="min-w-0">
                  <div className={`text-[11px] font-bold truncate ${g.heading}`}>
                    {art.title || (isPpt ? "Presentation Deck" : "PDF Report")}
                  </div>
                  <div className={`text-[10px] truncate ${g.muted}`}>
                    {art.subtitle || (isPpt ? `${art.slides?.length || 1} slides ready` : "Formatted PDF document ready")}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => exportAIAssistantArtifactAPI({ format: isPpt ? "ppt" : "pdf", artifact: art })}
                className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer shrink-0 ${g.btnPrimary}`}
              >
                <Download className="w-3 h-3" />
                <span>{isPpt ? "Download PPT" : "Download PDF"}</span>
              </button>
            </div>
          );
        }

        if (art.type === "image" && art.svgMarkup) {
          const cleanSvg = DOMPurify.sanitize(art.svgMarkup, {
            USE_PROFILES: { svg: true, svgFilters: false },
            FORBID_TAGS: ["script", "foreignObject"],
          });
          return (
            <div key={idx} className={`p-3 rounded-xl border space-y-2 w-full ${g.subtleSurface}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-[11px] font-bold truncate">
                  <ImageIcon className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  <span className="truncate">{art.title || "Workspace Visual"}</span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    const svgNode = e.currentTarget.closest("div.rounded-xl")?.querySelector("svg[viewBox]");
                    if (svgNode) downloadSvgElementAsPng(svgNode, (art.title || "diagram").replace(/\W+/g, "_"));
                  }}
                  className={`px-2 py-1 rounded-lg border text-[10px] font-semibold flex items-center gap-1 cursor-pointer shrink-0 ${g.btnSecondary}`}
                >
                  <Download className="w-3 h-3" />
                  <span>PNG</span>
                </button>
              </div>
              <div
                className={`w-full overflow-hidden rounded-lg p-1 ${isDark ? "text-zinc-100" : "text-slate-900"}`}
                dangerouslySetInnerHTML={{ __html: cleanSvg }}
              />
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}

