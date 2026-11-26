import React from "react";
import { X, MessageSquare, Shield, Building2, Mail, BadgeCheck } from "lucide-react";
import UserAvatar from "../common/UserAvatar";
import { getDisplayName } from "../../utils/formatters";
import { getGlassTokens } from "../../styles/glassTheme";

/**
 * Compact sender profile inspection card used across Workspace & Office Chat interfaces.
 */
export default function MessageSenderPopover({
  sender,
  currentUserId,
  teamMembers = [],
  onClose,
  onStartDM,
  isDark = true,
}) {
  if (!sender) return null;
  const g = getGlassTokens(isDark);

  const senderId = sender?._id || sender;
  const enriched =
    teamMembers.find((m) => String(m._id) === String(senderId)) ||
    (typeof sender === "object" ? sender : { _id: senderId });

  const isMe = String(senderId) === String(currentUserId);
  const name = getDisplayName(enriched, "Team Member");

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-xs rounded-2xl border p-4 shadow-2xl space-y-3.5 ${g.dropdown}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <UserAvatar
              user={enriched}
              name={name}
              className="w-11 h-11 rounded-xl border border-white/15 shrink-0"
              textClass="text-sm"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h4 className={`text-sm font-bold truncate ${g.heading}`}>{name}</h4>
                <BadgeCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              </div>
              {enriched.publicId && (
                <span className={`inline-block mt-0.5 px-1.5 py-0.2 rounded border text-[10px] font-mono font-bold ${g.badge}`}>
                  {enriched.publicId}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`p-1 rounded-lg cursor-pointer ${g.iconBtn}`}
            title="Close profile"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className={`p-3 rounded-xl border space-y-2 text-xs ${g.subtleSurface}`}>
          <div className="flex items-center justify-between gap-2">
            <span className={`flex items-center gap-1.5 ${g.muted}`}>
              <Shield className="w-3.5 h-3.5" /> Role
            </span>
            <span className={`font-semibold uppercase text-[11px] ${g.heading}`}>
              {enriched.role || "member"}
              {enriched.jobTitle ? ` · ${enriched.jobTitle}` : ""}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className={`flex items-center gap-1.5 ${g.muted}`}>
              <Building2 className="w-3.5 h-3.5" /> Department
            </span>
            <span className={`font-semibold truncate ${g.heading}`}>
              {enriched.departmentName || enriched.department?.name || "General"}
            </span>
          </div>
          {enriched.email && (
            <div className="flex items-center justify-between gap-2">
              <span className={`flex items-center gap-1.5 ${g.muted}`}>
                <Mail className="w-3.5 h-3.5" /> Email
              </span>
              <span className={`font-mono text-[11px] truncate max-w-[170px] ${g.heading}`}>
                {enriched.email}
              </span>
            </div>
          )}
        </div>

        {!isMe && typeof onStartDM === "function" && (
          <button
            type="button"
            onClick={() => {
              onStartDM(enriched);
              onClose?.();
            }}
            className={`w-full py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${g.btnPrimary}`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Open Direct Message</span>
          </button>
        )}
      </div>
    </div>
  );
}

