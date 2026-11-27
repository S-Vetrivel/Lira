import React, { useEffect, useState } from "react";
import { RefreshCw, Download, Sparkles } from "lucide-react";
import GlassModal from "./GlassModal";
import {
  subscribeAppUpdater,
  getAppUpdaterSnapshot,
  applyAppUpdate,
  dismissAppUpdate,
} from "../../services/appUpdater";
import { useApp } from "../../context/Appcontext";
import { getGlassTokens } from "../../styles/glassTheme";
import { formatDateIN, formatTimeIN } from "../../utils/formatters";

export default function AppUpdaterModal() {
  const { theme } = useApp();
  const isDark = theme === "dark";
  const g = getGlassTokens(isDark);
  const [snap, setSnap] = useState(getAppUpdaterSnapshot);

  useEffect(() => subscribeAppUpdater(setSnap), []);

  const isPwaMode = Boolean(snap.isPwa || snap.swWaiting || snap.source === "pwa");
  const title = isPwaMode ? "PWA Update Ready" : "New App Update Available";
  const subtitle = snap.newVersion
    ? `Version ${snap.newVersion}${snap.newBuildId ? ` · ${snap.newBuildId.slice(0, 12)}` : ""}`
    : "Fresh workspace build live";

  return (
    <GlassModal
      isOpen={Boolean(snap.available && snap.modalOpen)}
      onClose={() => {
        if (!snap.updating) dismissAppUpdate();
      }}
      closeOnBackdrop={!snap.updating}
      closeOnEscape={!snap.updating}
      showCloseButton={!snap.updating}
      title={title}
      subtitle={subtitle}
      icon={isPwaMode ? Download : Sparkles}
      variant="primary"
      size="sm"
      footer={
        <>
          <button
            type="button"
            disabled={snap.updating}
            onClick={dismissAppUpdate}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 ${g.btnSecondary}`}
          >
            Later
          </button>
          <button
            type="button"
            disabled={snap.updating}
            onClick={applyAppUpdate}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-70 ${g.btnPrimary}`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${snap.updating ? "animate-spin" : ""}`} />
            <span>
              {snap.updating
                ? "Updating..."
                : isPwaMode
                  ? "Update & Relaunch PWA"
                  : "Refresh & Update Now"}
            </span>
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <p className={`text-xs sm:text-[13px] leading-relaxed ${isDark ? "text-zinc-300" : "text-slate-600"}`}>
          A newer release of Lira Workspace is live
          {snap.source === "websocket" ? " (detected on your live connection)" : ""}.{" "}
          {isPwaMode
            ? "Install the updated PWA worker and reload to switch seamlessly to the latest assets."
            : "Refresh now to load the latest UI fixes, features, and security improvements cleanly."}
        </p>

        <div className={`p-3 rounded-xl border text-[11px] space-y-1 ${g.subtleSurface} ${g.border}`}>
          <div className="flex items-center justify-between gap-2">
            <span className={g.muted}>Current Build</span>
            <span className={`font-mono font-semibold ${g.heading}`}>
              v{snap.currentVersion} ({snap.currentBuildId || "dev"})
            </span>
          </div>
          {snap.newBuildId && (
            <div className="flex items-center justify-between gap-2">
              <span className={g.muted}>Available Build</span>
              <span className="font-mono font-semibold text-emerald-400">
                v{snap.newVersion || snap.currentVersion} ({snap.newBuildId.slice(0, 14)})
              </span>
            </div>
          )}
          {snap.builtAt && (
            <div className="flex items-center justify-between gap-2">
              <span className={g.muted}>Published</span>
              <span className={g.muted}>
                {formatDateIN(snap.builtAt)} {formatTimeIN(snap.builtAt)}
              </span>
            </div>
          )}
        </div>
      </div>
    </GlassModal>
  );
}
