import React from "react";
import { MessageSquare, Shield, Building2, Mail, BadgeCheck } from "lucide-react";
import UserAvatar from "../common/UserAvatar";
import GlassModal from "../common/GlassModal";
import { useApp } from "../../context/Appcontext";
import { getDisplayName } from "../../utils/formatters";
import { getGlassTokens } from "../../styles/glassTheme";

/**
 * Compact sender profile inspection modal used across Workspace & Office Chat sidebars.
 */
export default function MessageSenderPopover({
  sender,
  currentUserId,
  teamMembers = [],
  onClose,
  onStartDM,
  isDark = true,
}) {
  const { onlineUserIds } = useApp();
  const g = getGlassTokens(isDark);

  const senderId = sender?._id || sender;
  const enriched = sender
    ? teamMembers.find((m) => String(m._id) === String(senderId)) ||
      (typeof sender === "object" ? sender : { _id: senderId })
    : {};

  const isMe = Boolean(sender && String(senderId) === String(currentUserId));
  const isOnline = isMe || (onlineUserIds || []).map(String).includes(String(senderId));
  const name = getDisplayName(enriched, "Team Member");

  return (
    <GlassModal
      isOpen={Boolean(sender)}
      onClose={onClose}
      size="xs"
      title={
        <span className="flex items-center gap-1.5">
          <span className="truncate">{name}</span>
          <BadgeCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span
            className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
              isOnline ? "bg-emerald-500/15 text-emerald-400" : "bg-zinc-500/15 text-zinc-400"
            }`}
          >
            {isOnline ? "Online" : "Offline"}
          </span>
        </span>
      }
      subtitle={
        enriched.publicId ? (
          <span className={`inline-block mt-0.5 px-1.5 py-0.2 rounded border text-[10px] font-mono font-bold ${g.badge}`}>
            {enriched.publicId}
          </span>
        ) : undefined
      }
      headerIcon={
        <UserAvatar
          user={enriched}
          name={name}
          className="w-11 h-11 rounded-xl border border-white/15 shrink-0"
          textClass="text-sm"
        />
      }
      footer={
        !isMe && typeof onStartDM === "function" ? (
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
        ) : undefined
      }
    >
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
    </GlassModal>
  );
}
