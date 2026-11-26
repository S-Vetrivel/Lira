import React, { useState, useEffect, useCallback } from "react";
import {
  Activity,
  Users,
  Building2,
  FolderKanban,
  ShieldCheck,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  Wifi,
  Clock,
  Globe,
} from "lucide-react";
import { useApp } from "../context/Appcontext";
import { getAuditOverview } from "../services/api";
import { getSocket } from "../services/socket";
import UserAvatar from "../components/common/UserAvatar";
import { formatDateIN, formatTimeIN, getDisplayName } from "../utils/formatters";
import { getGlassTokens } from "../styles/glassTheme";

export default function AuditLogs() {
  const { user, isSuperAdmin, hasPermission, onlineUserIds, theme } = useApp();
  const isDark = theme === "dark";
  const g = getGlassTokens(isDark);

  const [tab, setTab] = useState("logs"); // 'logs' | 'online' | 'teams'
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [mutationsOnly, setMutationsOnly] = useState(false);

  const canViewAudit = isSuperAdmin || hasPermission("audit.view") || hasPermission("dashboard.logs");

  const loadAudit = useCallback(async () => {
    if (!canViewAudit) return;
    setLoading(true);
    const res = await getAuditOverview({
      limit: 50,
      ...(search.trim() ? { search: search.trim() } : {}),
      ...(actionFilter ? { action: actionFilter } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
    });
    if (res.success) {
      setData(res);
    }
    setLoading(false);
  }, [canViewAudit, search, actionFilter, statusFilter]);

  useEffect(() => {
    loadAudit();
  }, [loadAudit]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onPresence = () => loadAudit();
    socket.on("presence:update", onPresence);
    return () => socket.off("presence:update", onPresence);
  }, [loadAudit]);

  if (!canViewAudit) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-center">
        <div className={`p-8 rounded-2xl border max-w-md space-y-2 ${g.card}`}>
          <ShieldCheck className="w-8 h-8 mx-auto text-amber-400" />
          <h2 className={`text-base font-bold ${g.heading}`}>Audit Access Restricted</h2>
          <p className={`text-xs ${g.muted}`}>Requires `audit.view` or Superadmin clearance.</p>
        </div>
      </div>
    );
  }

  const summary = data?.summary || {};
  const liveOnlineSet = new Set([
    ...(onlineUserIds || []).map(String),
    ...(data?.onlineUsers || []).map((u) => String(u._id)),
  ]);
  const allUsersMerged = [
    ...(data?.onlineUsers || []),
    ...(data?.offlineUsers || []),
  ].map((u) => ({ ...u, isLiveOnline: liveOnlineSet.has(String(u._id)) }));
  const onlineList = allUsersMerged.filter((u) => u.isLiveOnline);
  const offlineList = allUsersMerged.filter((u) => !u.isLiveOnline);

  return (
    <div className={`flex-1 w-full h-full min-h-0 overflow-y-auto p-5 sm:p-7 space-y-6 ${isDark ? "text-slate-100" : "text-slate-900"}`}>
      {/* Header */}
      <div className={`flex flex-wrap items-center justify-between gap-4 pb-4 border-b ${g.border}`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${g.badge}`}>
            <Activity className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h1 className={`text-xl sm:text-2xl font-extrabold tracking-tight ${g.heading}`}>
              System Audit, Online Presence & Teams Overview
            </h1>
            <p className={`text-xs ${g.muted}`}>
              Real-time monitoring across active sessions, department capacity, and user action trails.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={loadAudit}
          className={`px-3.5 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${g.btnSecondary}`}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Top KPI Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Online Now", value: onlineList.length, icon: Wifi, cls: "text-emerald-400" },
          { label: "Active Staff", value: summary.totalActiveUsers ?? 0, icon: Users, cls: "text-indigo-400" },
          { label: "Departments", value: summary.teamsCount ?? 0, icon: Building2, cls: "text-sky-400" },
          { label: "Projects", value: summary.projectsCount ?? 0, icon: FolderKanban, cls: "text-amber-400" },
          { label: "Logged Actions", value: summary.totalLogs ?? 0, icon: Activity, cls: "text-purple-400" },
          { label: "HTTP Errors", value: summary.errorLogsCount ?? 0, icon: AlertTriangle, cls: "text-rose-400" },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className={`p-3.5 rounded-2xl border space-y-1 ${g.card}`}>
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-bold uppercase tracking-wider ${g.muted}`}>{stat.label}</span>
                <Icon className={`w-3.5 h-3.5 ${stat.cls}`} />
              </div>
              <p className={`text-xl font-bold font-mono ${g.heading}`}>{stat.value}</p>
            </div>
          );
        })}
      </div>

      {/* Tab Navigation */}
      <div className={`flex items-center gap-2 border-b pb-2 overflow-x-auto ${g.border}`}>
        {[
          { id: "logs", label: `User Action Trail (${data?.auditLogs?.length || 0})` },
          { id: "online", label: `Online Users (${onlineList.length})` },
          { id: "teams", label: `Teams & Workspaces (${data?.teamsOverview?.length || 0})` },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold cursor-pointer whitespace-nowrap ${
              tab === item.id ? g.pillActive : g.pillInactive
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* TAB 1: USER ACTION TRAIL */}
      {tab === "logs" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative flex-1 min-w-[220px]">
              <Search className={`w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 ${g.muted}`} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by user email, Public ID, route path, or action..."
                className={`w-full rounded-xl pl-8 pr-3 py-2 text-xs border focus:outline-none ${g.input}`}
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={`rounded-xl px-3 py-2 text-xs border focus:outline-none ${g.input}`}
            >
              <option value="">All Statuses</option>
              <option value="SUCCESS">SUCCESS (2xx)</option>
              <option value="FAILURE">FAILURE (4xx/5xx)</option>
            </select>

            <input
              type="text"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value.toUpperCase())}
              placeholder="Action e.g. TASK_CREATE"
              className={`rounded-xl px-3 py-2 text-xs border focus:outline-none w-44 font-mono ${g.input}`}
            />

            <button
              type="button"
              onClick={() => setMutationsOnly((v) => !v)}
              className={`px-3 py-2 rounded-xl border text-xs font-semibold cursor-pointer ${
                mutationsOnly ? g.selectedRow : g.btnSecondary
              }`}
              title="Show only state-changing mutations (POST, PUT, PATCH, DELETE)"
            >
              {mutationsOnly ? "Mutations Only ✓" : "All Methods"}
            </button>
          </div>

          <div className={`rounded-2xl border overflow-hidden ${g.card}`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className={`border-b text-[10px] uppercase tracking-wider ${g.border} ${g.subtleSurface}`}>
                    <th className="p-3">Time</th>
                    <th className="p-3">Actor & Public ID</th>
                    <th className="p-3">Action</th>
                    <th className="p-3">Endpoint</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Latency / IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {(data?.auditLogs || [])
                    .filter((l) => !mutationsOnly || l.method !== "GET")
                    .map((log) => (
                    <tr key={log._id || log.actionId} className={g.rowHover}>
                      <td className="p-3 font-mono text-[11px] whitespace-nowrap">
                        <div>{formatTimeIN(log.timestamp)}</div>
                        <div className={`text-[10px] ${g.muted}`}>{formatDateIN(log.timestamp)}</div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <UserAvatar
                            user={log.user || { fullname: log.userName || log.userEmail || "Guest" }}
                            className="w-6 h-6 rounded-full"
                            textClass="text-[9px]"
                          />
                          <div className="min-w-0">
                            <p className="font-semibold truncate max-w-[180px]">
                              {log.user?.fullname || log.userName || log.userEmail || "Anonymous"}
                            </p>
                            <div className="flex items-center gap-1.5 text-[10px] font-mono opacity-75">
                              <span>{log.userRole}</span>
                              {(log.user?.publicId || log.userPublicId) && (
                                <span className={`px-1 rounded border ${g.badge}`}>
                                  {log.user?.publicId || log.userPublicId}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 font-mono font-bold text-[11px] text-indigo-400">
                        {log.action}
                      </td>
                      <td className="p-3 font-mono text-[11px] max-w-[220px] truncate" title={log.url}>
                        <span className="font-bold mr-1.5">{log.method}</span>
                        <span className={g.muted}>{log.path}</span>
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            log.statusCode >= 400
                              ? "bg-rose-500/15 text-rose-400 border-rose-500/30"
                              : "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                          }`}
                        >
                          {log.statusCode} · {log.status}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-[10px] whitespace-nowrap">
                        <span>{log.durationMs}ms</span>
                        <span className={`block ${g.muted}`}>{log.ip}</span>
                      </td>
                    </tr>
                  ))}
                  {(!data?.auditLogs || data.auditLogs.length === 0) && (
                    <tr>
                      <td colSpan={6} className={`p-8 text-center text-xs ${g.muted}`}>
                        No matching audit logs found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Domain Activity Feed */}
          {data?.domainActivity?.length > 0 && (
            <div className={`p-4 rounded-2xl border space-y-2.5 ${g.card}`}>
              <h3 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${g.heading}`}>
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>Recent Domain Activity Feed</span>
              </h3>
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {data.domainActivity.map((act) => (
                  <div
                    key={act._id}
                    className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 text-xs ${g.subtleSurface}`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="truncate">
                        {act.details?.message ||
                          `${act.user?.fullname || "User"} executed ${act.action}`}
                      </span>
                    </div>
                    <span className={`text-[10px] font-mono shrink-0 ${g.muted}`}>
                      {formatTimeIN(act.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: LIVE ONLINE USERS */}
      {tab === "online" && (
        <div className="space-y-6">
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Online Sessions ({onlineList.length})</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {onlineList.map((u) => (
                <div key={u._id} className={`p-4 rounded-2xl border flex items-center justify-between gap-3 ${g.card}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative">
                      <UserAvatar user={u} className="w-10 h-10 rounded-xl" textClass="text-xs" />
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#14161d] absolute -bottom-0.5 -right-0.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate">{getDisplayName(u)}</p>
                      <p className={`text-[10px] truncate ${g.muted}`}>{u.email}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        {u.publicId && <span className={`text-[9px] font-mono px-1.5 rounded border ${g.badge}`}>{u.publicId}</span>}
                        <span className="text-[10px] uppercase font-semibold text-indigo-300">{u.role}</span>
                      </div>
                    </div>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-1 rounded-lg border ${g.subtleSurface}`}>
                    {u.departmentName || "General"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <h3 className={`text-xs font-bold uppercase tracking-wider ${g.muted}`}>
              Offline Active Staff ({offlineList.length})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {offlineList.map((u) => (
                <div key={u._id} className={`p-3 rounded-xl border flex items-center gap-2.5 opacity-75 ${g.subtleSurface}`}>
                  <UserAvatar user={u} className="w-7 h-7 rounded-full" textClass="text-[9px]" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold truncate">{getDisplayName(u)}</p>
                    <p className={`text-[10px] truncate ${g.muted}`}>
                      {u.role} · {u.departmentName || "General"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: TEAMS & WORKSPACES OVERVIEW */}
      {tab === "teams" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(data?.teamsOverview || []).map((dept) => (
              <div key={dept._id} className={`p-5 rounded-2xl border space-y-3.5 ${g.card}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: dept.color || "#6366f1" }} />
                      <h3 className={`text-sm font-bold ${g.heading}`}>{dept.name}</h3>
                      <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${g.badge}`}>{dept.code}</span>
                    </div>
                    <p className={`text-xs mt-1 ${g.muted}`}>{dept.description || "Operational unit"}</p>
                  </div>
                  <span className="text-[11px] font-mono text-emerald-400 font-bold shrink-0">
                    {dept.onlineCount}/{dept.membersCount} online
                  </span>
                </div>

                <div className={`grid grid-cols-4 gap-2 p-2.5 rounded-xl border text-center ${g.subtleSurface}`}>
                  <div>
                    <p className="text-[10px] opacity-60">Staff</p>
                    <p className="text-xs font-bold font-mono">{dept.membersCount}</p>
                  </div>
                  <div>
                    <p className="text-[10px] opacity-60">Projects</p>
                    <p className="text-xs font-bold font-mono">{dept.projectsCount}</p>
                  </div>
                  <div>
                    <p className="text-[10px] opacity-60">Done Tasks</p>
                    <p className="text-xs font-bold font-mono text-emerald-400">
                      {dept.doneTasks}/{dept.totalTasks}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] opacity-60">Overdue</p>
                    <p className="text-xs font-bold font-mono text-rose-400">{dept.overdueTasks}</p>
                  </div>
                </div>

                {dept.members?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {dept.members.map((m) => (
                      <span
                        key={m._id}
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg border text-[10px] ${g.subtleSurface}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${m.isOnline ? "bg-emerald-400" : "bg-zinc-500"}`} />
                        <span>{getDisplayName(m)}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Roles Matrix Summary */}
          {data?.rolesSummary?.length > 0 && (
            <div className={`p-4 rounded-2xl border space-y-3 ${g.card}`}>
              <h3 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${g.heading}`}>
                <Globe className="w-3.5 h-3.5 text-purple-400" />
                <span>Dynamic Roles Distribution</span>
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {data.rolesSummary.map((r) => (
                  <div key={r.name} className={`p-3 rounded-xl border ${g.subtleSurface}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold">{r.displayName || r.name}</span>
                      <span className="font-mono text-xs font-bold">{r.usersCount}</span>
                    </div>
                    <p className={`text-[10px] mt-1 ${g.muted}`}>
                      {r.modules?.length || 0} modules · {r.permissions?.length || 0} perms
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

