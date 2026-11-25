import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../context/Appcontext";
import { getManagerOverview } from "../services/api";
import { formatINR, formatNumberIN, formatDateIN, getDisplayName } from "../utils/formatters";
import UserAvatar from "../components/common/UserAvatar";
import { getGlassTokens } from "../styles/glassTheme";
import {
  Calendar as CalendarIcon,
  IndianRupee,
  RefreshCw,
  ShieldCheck,
  Briefcase,
  User,
  CheckSquare,
  Activity,
  TrendingUp,
  Clock,
  Layers,
  Zap,
  ArrowUpRight,
  BarChart2,
  Circle,
  Kanban,
  FileCheck2,
  Users,
  MessageSquare,
  Plus,
  FolderKanban,
} from "lucide-react";

const PRIORITY_DOT = {
  urgent: "bg-rose-500",
  high: "bg-amber-400",
  medium: "bg-zinc-400",
  low: "bg-zinc-600",
};

const STATUS_BADGE = {
  in_progress: { label: "In Progress", cls: "bg-sky-500/15 text-sky-400 border-sky-500/25" },
  done: { label: "Done", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" },
  review: { label: "Review", cls: "bg-amber-500/15 text-amber-300 border-amber-500/25" },
  submitted_for_review: { label: "Sign-off", cls: "bg-amber-500/15 text-amber-300 border-amber-500/25" },
  redo_requested: { label: "Revision", cls: "bg-rose-500/15 text-rose-400 border-rose-500/25" },
  todo: { label: "To Do", cls: "bg-zinc-500/15 text-zinc-400 border-zinc-500/25" },
};

function StatPill({ label, value, accent }) {
  return (
    <div className={`flex flex-col items-center px-3.5 py-2 rounded-xl border backdrop-blur-sm shrink-0 ${accent}`}>
      <span className="text-[9px] uppercase tracking-widest font-semibold opacity-65 mb-0.5 whitespace-nowrap">
        {label}
      </span>
      <span className="text-sm font-bold font-display tabular-nums tracking-tight leading-none">
        {value}
      </span>
    </div>
  );
}

function SectionLabel({ children, className = "" }) {
  return (
    <span className={`text-[10px] font-semibold uppercase tracking-widest opacity-55 ${className}`}>
      {children}
    </span>
  );
}

export default function Analytics() {
  const {
    user,
    activeProject,
    setSelectedTaskKeyOrId,
    setIsCreateTaskModalOpen,
    setIsChatOpen,
    theme,
  } = useApp();
  const isDark = theme === "dark";
  const g = getGlassTokens(isDark);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState("Month");
  const [velocityFilter, setVelocityFilter] = useState("Week");
  const [selectedTaskType, setSelectedTaskType] = useState("All");

  const loadOverview = async () => {
    setLoading(true);
    try {
      const res = await getManagerOverview(activeProject?._id);
      if (res.success) setData(res);
    } catch (err) {
      console.error("Failed to load analytics:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, [activeProject?._id]);

  const {
    summary = {
      totalTasks: 0,
      doneTasks: 0,
      inProgressTasks: 0,
      reviewTasks: 0,
      todoTasks: 0,
      overdueCount: 0,
      completionRate: 0,
      totalEstimatedHours: 0,
      totalLoggedHours: 0,
      hourlyRateINR: 1500,
      sprintValuationINR: 0,
    },
    statusBreakdown = {
      inProgress: { count: 0, percentage: 0 },
      done: { count: 0, percentage: 0 },
      review: { count: 0, percentage: 0 },
      todo: { count: 0, percentage: 0 },
    },
    weeklyVelocity = [],
    throughputCurve = [],
    currentMonthDueDays = [],
    topPriorityTickets = [],
    teamWorkload = [],
    departmentBreakdown = [],
    projectProgress = [],
    userRoleData = {},
  } = data || {};

  const currentRole = user?.role || "employee";
  const firstName = getDisplayName(user, "there").split(" ")[0];

  const visibleCurve = useMemo(() => {
    if (!throughputCurve?.length) return [];
    if (timeFilter === "Today") return throughputCurve.slice(-2);
    if (timeFilter === "Week") return throughputCurve.slice(-7);
    return throughputCurve;
  }, [throughputCurve, timeFilter]);

  const filteredTickets = useMemo(() => {
    if (selectedTaskType === "Urgent") return topPriorityTickets.filter((t) => t.priority === "urgent");
    if (selectedTaskType === "High")
      return topPriorityTickets.filter((t) => t.priority === "urgent" || t.priority === "high");
    return topPriorityTickets;
  }, [topPriorityTickets, selectedTaskType]);

  const activeStatusBreakdown = useMemo(() => {
    if (currentRole === "employee" && userRoleData?.myStatusBreakdown) {
      return userRoleData.myStatusBreakdown;
    }
    return statusBreakdown;
  }, [currentRole, userRoleData, statusBreakdown]);

  const svgPathData = useMemo(() => {
    if (!visibleCurve?.length) return null;
    const W = 420;
    const H = 90;
    const px = 14;
    const maxA = Math.max(...visibleCurve.map((d) => d.actions), 1);
    const maxH = Math.max(...visibleCurve.map((d) => d.hours), 1);
    const stepX = visibleCurve.length > 1 ? (W - px * 2) / (visibleCurve.length - 1) : 0;
    const pts = visibleCurve.map((d, i) => {
      const x = visibleCurve.length === 1 ? W / 2 : px + i * stepX;
      return {
        x,
        y: H - (d.actions / maxA) * (H - 18),
        hy: H - (d.hours / maxH) * (H - 22),
        ...d,
      };
    });
    let pathD = `M ${pts[0].x},${pts[0].y}`;
    let hoursD = `M ${pts[0].x},${pts[0].hy}`;
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i - 1];
      const c = pts[i];
      const cx = (p.x + c.x) / 2;
      pathD += ` C ${cx},${p.y} ${cx},${c.y} ${c.x},${c.y}`;
      hoursD += ` C ${cx},${p.hy} ${cx},${c.hy} ${c.x},${c.hy}`;
    }
    const areaD = `${pathD} L ${pts[pts.length - 1].x},${H + 5} L ${pts[0].x},${H + 5} Z`;
    const last = pts[pts.length - 1];
    return {
      pathD,
      areaD,
      hoursD,
      activeX: last?.x ?? W / 2,
      activeY: last?.y ?? H,
      activeHY: last?.hy ?? H,
      points: pts,
    };
  }, [visibleCurve]);

  const today = new Date();
  const currentMonthName = today.toLocaleDateString("en-IN", { month: "long" });
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();
  const currentDayNumber = today.getDate();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOffsetMon = (new Date(currentYear, currentMonth, 1).getDay() + 6) % 7;
  const dueDaysSet = useMemo(() => {
    const s = new Set();
    currentMonthDueDays.forEach((d) => s.add(d.day));
    return s;
  }, [currentMonthDueDays]);

  const displayedVelocity = useMemo(() => {
    if (velocityFilter === "Day") return weeklyVelocity.filter((v) => v.isToday);
    return weeklyVelocity;
  }, [weeklyVelocity, velocityFilter]);

  const hourlyRate = summary.hourlyRateINR || 1500;
  const realValuationINR =
    summary.sprintValuationINR ?? Math.round((summary.totalLoggedHours || 0) * hourlyRate);

  const statusSegments = useMemo(() => {
    const total = Object.values(activeStatusBreakdown).reduce((s, v) => s + (v.count || 0), 0);
    const items = [
      { key: "inProgress", label: "In Progress", barCls: isDark ? "bg-zinc-200" : "bg-zinc-800", dot: isDark ? "#e4e4e7" : "#27272a" },
      { key: "review", label: "In Review", barCls: isDark ? "bg-amber-400" : "bg-amber-500", dot: "#f59e0b" },
      { key: "done", label: "Done", barCls: "bg-emerald-400", dot: "#34d399" },
      { key: "todo", label: "To Do", barCls: isDark ? "bg-zinc-600" : "bg-slate-300", dot: isDark ? "#52525b" : "#cbd5e1" },
    ];
    return {
      total,
      items: items.map((item) => {
        const count = activeStatusBreakdown[item.key]?.count || 0;
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        return { ...item, count, pct };
      }),
    };
  }, [activeStatusBreakdown, isDark]);

  if (loading) {
    return (
      <div className={`flex-1 w-full h-full flex items-center justify-center ${g.muted}`}>
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-6 h-6 animate-spin opacity-60" />
          <span className="text-sm font-medium tracking-wide">Loading workspace dashboard…</span>
        </div>
      </div>
    );
  }

  const roleMeta = {
    admin: {
      label: "Executive",
      icon: ShieldCheck,
      accent: g.badge,
    },
    manager: {
      label: "Lead",
      icon: Briefcase,
      accent: g.badge,
    },
    employee: {
      label: "Contributor",
      icon: User,
      accent: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
    },
  }[currentRole];
  const RoleIcon = roleMeta.icon;

  return (
    <div className={`flex-1 w-full h-full overflow-y-auto ${g.heading}`}>
      <div className="max-w-[1680px] mx-auto px-4 sm:px-6 lg:px-7 py-5 space-y-5 select-none">
        {/* 1. HERO HOME BANNER + QUICK ACTION LAUNCHPAD */}
        <div className={`rounded-2xl p-4 sm:p-5 border flex flex-col gap-4 ${g.cardGlow}`}>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <UserAvatar
                user={user}
                className="w-12 h-12 rounded-2xl border border-white/15 shadow-sm"
                textClass="text-base"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${roleMeta.accent}`}>
                    <RoleIcon className="w-3 h-3" />
                    {roleMeta.label}
                  </span>
                  <span className={`text-[11px] font-medium ${g.muted}`}>
                    {activeProject ? `[${activeProject.prefix}] ${activeProject.name}` : "All Workspaces"}
                  </span>
                </div>
                <h1 className={`text-xl sm:text-2xl font-display font-bold tracking-tight truncate leading-tight ${g.heading}`}>
                  {currentRole === "admin" && `Good day, ${firstName} — Organization Overview`}
                  {currentRole === "manager" && `Good day, ${firstName} — Sprint & Team Overview`}
                  {currentRole === "employee" && `Welcome back, ${firstName}`}
                </h1>
                <p className={`text-xs mt-0.5 ${g.muted}`}>
                  {new Date().toLocaleDateString("en-IN", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>
            </div>

            {/* KPI Summary Strip */}
            <div className="flex items-center gap-2 flex-wrap shrink-0">
              {currentRole === "admin" && (
                <>
                  <StatPill
                    label="Workspaces"
                    value={formatNumberIN(userRoleData.adminMetrics?.totalProjectsCount ?? projectProgress.length)}
                    accent={g.subtleSurface}
                  />
                  <StatPill
                    label="Staff"
                    value={formatNumberIN(userRoleData.adminMetrics?.totalUsersCount ?? teamWorkload.length)}
                    accent={g.subtleSurface}
                  />
                  <StatPill
                    label="Depts"
                    value={formatNumberIN(userRoleData.adminMetrics?.totalDepartmentsCount ?? departmentBreakdown.length)}
                    accent={g.subtleSurface}
                  />
                  <StatPill
                    label="Completion"
                    value={`${summary.completionRate}%`}
                    accent={isDark ? "bg-emerald-500/15 border-emerald-500/25 text-emerald-300" : "bg-emerald-50 border-emerald-200 text-emerald-700"}
                  />
                </>
              )}
              {currentRole === "manager" && (
                <>
                  <StatPill label="Tickets" value={formatNumberIN(summary.totalTasks)} accent={g.subtleSurface} />
                  <StatPill label="Logged" value={`${summary.totalLoggedHours || 0}h`} accent={g.subtleSurface} />
                  <StatPill
                    label="Completion"
                    value={`${summary.completionRate}%`}
                    accent={isDark ? "bg-emerald-500/15 border-emerald-500/25 text-emerald-300" : "bg-emerald-50 border-emerald-200 text-emerald-700"}
                  />
                  {(userRoleData.managerMetrics?.unassignedTasksCount || 0) > 0 && (
                    <StatPill
                      label="Unassigned"
                      value={formatNumberIN(userRoleData.managerMetrics?.unassignedTasksCount ?? 0)}
                      accent={isDark ? "bg-amber-500/15 border-amber-500/25 text-amber-300" : "bg-amber-50 border-amber-200 text-amber-700"}
                    />
                  )}
                </>
              )}
              {currentRole === "employee" && (
                <>
                  <StatPill label="My Tasks" value={formatNumberIN(userRoleData.myMetrics?.totalTasks || 0)} accent={g.subtleSurface} />
                  <StatPill
                    label="Done"
                    value={formatNumberIN(userRoleData.myMetrics?.doneTasks || 0)}
                    accent={isDark ? "bg-emerald-500/15 border-emerald-500/25 text-emerald-300" : "bg-emerald-50 border-emerald-200 text-emerald-700"}
                  />
                  <StatPill label="Logged" value={`${userRoleData.myMetrics?.loggedHours || 0}h`} accent={g.subtleSurface} />
                  {(userRoleData.myMetrics?.overdueCount || 0) > 0 && (
                    <StatPill
                      label="Overdue"
                      value={formatNumberIN(userRoleData.myMetrics?.overdueCount ?? 0)}
                      accent={isDark ? "bg-rose-500/15 border-rose-500/25 text-rose-300" : "bg-rose-50 border-rose-200 text-rose-700"}
                    />
                  )}
                </>
              )}

              <button
                type="button"
                onClick={loadOverview}
                className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all cursor-pointer ${g.iconBtn}`}
                title="Refresh Dashboard"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quick Home Navigation Shortcuts */}
          <div className={`pt-3 border-t flex items-center justify-between gap-2 flex-wrap ${g.border}`}>
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                to="/board"
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${g.btnSecondary}`}
              >
                <Kanban className="w-3.5 h-3.5 opacity-75" />
                <span>Open Sprint Board</span>
              </Link>
              <Link
                to="/my-work"
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${g.btnSecondary}`}
              >
                <CheckSquare className="w-3.5 h-3.5 opacity-75" />
                <span>My Day</span>
              </Link>
              <Link
                to="/requests"
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${g.btnSecondary}`}
              >
                <FileCheck2 className="w-3.5 h-3.5 opacity-75" />
                <span>Approvals</span>
              </Link>
              <Link
                to="/team"
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${g.btnSecondary}`}
              >
                <Users className="w-3.5 h-3.5 opacity-75" />
                <span>Team</span>
              </Link>
              <Link
                to="/projects"
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${g.btnSecondary}`}
              >
                <FolderKanban className="w-3.5 h-3.5 opacity-75" />
                <span>Workspaces</span>
              </Link>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsChatOpen(true)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${g.btnSecondary}`}
              >
                <MessageSquare className="w-3.5 h-3.5 opacity-75" />
                <span>Team Chat</span>
              </button>
              <button
                type="button"
                onClick={() => setIsCreateTaskModalOpen(true)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs transition-all cursor-pointer ${g.btnPrimary}`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Task</span>
              </button>
            </div>
          </div>
        </div>

        {/* 2. TOP ANALYTICS GRID (3 cards) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Col A: Throughput Curve (5/12) */}
          <div className={`lg:col-span-5 rounded-2xl p-5 border flex flex-col gap-3.5 overflow-hidden ${g.cardGlow}`}>
            <div className="flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${g.badge}`}>
                  <Activity className="w-4 h-4 opacity-80" />
                </div>
                <div>
                  <h2 className={`text-sm font-display font-bold leading-tight ${g.heading}`}>
                    Throughput & Delivery
                  </h2>
                  <SectionLabel>Live logs · {timeFilter.toLowerCase()} window</SectionLabel>
                </div>
              </div>
              <div className={`flex items-center p-0.5 rounded-full border gap-0.5 ${g.subtleSurface}`}>
                {["Today", "Week", "Month", "All"].map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setTimeFilter(f)}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all cursor-pointer ${
                      timeFilter === f ? g.pillActive : g.muted
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-5 shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`text-2xl font-display font-bold tabular-nums ${g.heading}`}>
                    {formatNumberIN(summary.inProgressTasks)}
                  </span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${g.badge}`}>
                    In Flight
                  </span>
                </div>
                <span className={`block text-[10px] mt-0.5 ${g.muted}`}>Active workspace tickets</span>
              </div>
              <div className={`w-px h-9 ${isDark ? "bg-white/[0.08]" : "bg-slate-200"}`} />
              <div>
                <span className={`text-2xl font-display font-bold tabular-nums ${g.heading}`}>
                  {summary.totalLoggedHours || 0}
                  <span className="text-sm font-medium opacity-50 ml-0.5">h</span>
                </span>
                <span className={`block text-[10px] mt-0.5 ${g.muted}`}>Logged team effort</span>
              </div>
              <div className={`w-px h-9 ${isDark ? "bg-white/[0.08]" : "bg-slate-200"}`} />
              <div>
                <span className={`text-2xl font-display font-bold tabular-nums ${g.heading}`}>
                  {summary.overdueCount || 0}
                </span>
                <span className={`block text-[10px] mt-0.5 ${g.muted}`}>Overdue tickets</span>
              </div>
            </div>

            <div className="flex-1 relative min-h-[100px]">
              <div className={`absolute top-0 right-0 z-10 flex items-center gap-2 rounded-full px-2.5 py-1 text-[10px] border backdrop-blur-md ${g.badge}`}>
                <span className="flex items-center gap-1 font-semibold">
                  <span className={`w-1.5 h-1.5 rounded-full inline-block ${isDark ? "bg-zinc-200" : "bg-zinc-800"}`} />
                  {visibleCurve.reduce((a, d) => a + d.actions, 0)} Events
                </span>
                <span className="opacity-30">·</span>
                <span className="flex items-center gap-1 font-semibold text-amber-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                  {Math.round(visibleCurve.reduce((a, d) => a + d.hours, 0) * 10) / 10}h
                </span>
              </div>

              {svgPathData ? (
                <svg viewBox="0 0 420 100" className="w-full h-full overflow-visible">
                  <defs>
                    <linearGradient id="actGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={isDark ? "#d4d4d8" : "#52525b"} stopOpacity="0.32" />
                      <stop offset="100%" stopColor={isDark ? "#d4d4d8" : "#52525b"} stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <line
                    x1={svgPathData.activeX}
                    y1="4"
                    x2={svgPathData.activeX}
                    y2="95"
                    stroke={isDark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.09)"}
                    strokeDasharray="2 3"
                  />
                  <path d={svgPathData.areaD} fill="url(#actGrad)" />
                  <path
                    d={svgPathData.pathD}
                    fill="none"
                    stroke={isDark ? "#e4e4e7" : "#3f3f46"}
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />
                  <path
                    d={svgPathData.hoursD}
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    opacity="0.8"
                  />
                  <circle
                    cx={svgPathData.activeX}
                    cy={svgPathData.activeY}
                    r="4"
                    fill={isDark ? "#fff" : "#09090b"}
                    stroke={isDark ? "#090a0d" : "#fff"}
                    strokeWidth="2"
                  />
                  <circle
                    cx={svgPathData.activeX}
                    cy={svgPathData.activeHY}
                    r="3"
                    fill="#f59e0b"
                    stroke={isDark ? "#090a0d" : "#fff"}
                    strokeWidth="1.5"
                  />
                </svg>
              ) : (
                <div className="h-full flex items-center justify-center gap-2 opacity-40">
                  <Activity className="w-4 h-4" />
                  <span className="text-xs">No timeline activity yet</span>
                </div>
              )}
            </div>

            {svgPathData && (
              <div className={`flex items-center justify-between text-[9px] font-mono shrink-0 ${g.muted}`}>
                {visibleCurve.map((d, i) => {
                  if (visibleCurve.length > 8 && i % 2 !== 0 && i !== visibleCurve.length - 1) return null;
                  return (
                    <span key={d.date} className={d.dayNumber === currentDayNumber ? `font-bold ${g.heading}` : ""}>
                      {d.dayNumber}
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          {/* Col B: Calendar & Valuation (3/12) */}
          <div className={`lg:col-span-3 rounded-2xl p-5 border flex flex-col gap-3 overflow-hidden ${g.card}`}>
            <div className="flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${g.badge}`}>
                  <CalendarIcon className="w-4 h-4 opacity-80" />
                </div>
                <div>
                  <h2 className={`text-sm font-display font-bold leading-tight ${g.heading}`}>
                    {currentMonthName} {currentYear}
                  </h2>
                  <SectionLabel>Schedule & Deadlines</SectionLabel>
                </div>
              </div>
              {currentMonthDueDays.length > 0 && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border bg-amber-500/15 border-amber-500/25 text-amber-400`}>
                  {currentMonthDueDays.length} Due
                </span>
              )}
            </div>

            <div className="grid grid-cols-7 gap-y-0.5 text-center text-[10px] flex-1 tabular-nums">
              {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                <div key={i} className={`py-1 font-bold tracking-widest ${g.muted}`}>
                  {d}
                </div>
              ))}
              {Array.from({ length: firstDayOffsetMon }).map((_, i) => (
                <div key={`p${i}`} />
              ))}
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                const isToday = day === currentDayNumber;
                const hasDue = dueDaysSet.has(day);
                return (
                  <div
                    key={day}
                    className={`py-1 mx-0.5 rounded-lg font-semibold transition-colors ${
                      isToday
                        ? isDark
                          ? "bg-white text-zinc-950 font-bold shadow-xs"
                          : "bg-zinc-900 text-white font-bold shadow-xs"
                        : hasDue
                        ? isDark
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          : "bg-amber-100 text-amber-800 border border-amber-300"
                        : g.muted
                    }`}
                  >
                    {day}
                  </div>
                );
              })}
            </div>

            <div className={`mt-auto p-3 rounded-xl border flex items-center justify-between shrink-0 ${g.subtleSurface}`}>
              <div>
                <SectionLabel>{currentRole === "employee" ? "Logged Effort" : "Sprint Valuation"}</SectionLabel>
                <span className={`text-base font-display font-bold tabular-nums block mt-0.5 ${g.heading}`}>
                  {currentRole === "employee"
                    ? `${userRoleData.myMetrics?.loggedHours || 0}h logged`
                    : formatINR(realValuationINR)}
                </span>
                <span className={`text-[10px] ${g.muted}`}>
                  {currentRole === "employee"
                    ? `${userRoleData.myMetrics?.doneTasks || 0} tasks resolved`
                    : `${summary.totalLoggedHours || 0}h @ ${formatINR(hourlyRate)}/hr`}
                </span>
              </div>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center border shrink-0 ${g.badge}`}>
                <IndianRupee className="w-4 h-4 opacity-75" />
              </div>
            </div>
          </div>

          {/* Col C: Weekly Burnup (4/12) */}
          <div className={`lg:col-span-4 rounded-2xl p-5 border flex flex-col gap-3 overflow-hidden ${g.card}`}>
            <div className="flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${g.badge}`}>
                  <BarChart2 className="w-4 h-4 opacity-80" />
                </div>
                <div>
                  <h2 className={`text-sm font-display font-bold leading-tight ${g.heading}`}>
                    Weekly Burnup
                  </h2>
                  <SectionLabel>Tasks completed · effort</SectionLabel>
                </div>
              </div>
              <div className={`flex items-center p-0.5 rounded-full border gap-0.5 ${g.subtleSurface}`}>
                {["Day", "Week"].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setVelocityFilter(p)}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all cursor-pointer ${
                      velocityFilter === p ? g.pillActive : g.muted
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="shrink-0">
              <span className={`text-2xl font-display font-bold tabular-nums ${g.heading}`}>
                {summary.doneTasks || 0}
                <span className="text-sm font-normal opacity-45 ml-1">
                  / {summary.totalTasks || 0}
                </span>
              </span>
              <span className={`block text-[10px] mt-0.5 ${g.muted}`}>
                Tasks completed · {displayedVelocity.reduce((s, v) => s + (v.tasksCount || 0), 0)} touched this {velocityFilter.toLowerCase()}
              </span>
              <div className={`flex items-center gap-2 mt-1.5 text-[10px] font-semibold ${g.muted}`}>
                <span className="flex items-center gap-1 tabular-nums">
                  <Clock className="w-3 h-3" />
                  {displayedVelocity.reduce((s, v) => s + (v.hours || 0), 0).toFixed(1)}h logged
                </span>
                <span className={`px-2 py-0.5 rounded-full border ${g.badge}`}>
                  {displayedVelocity.filter((v) => (v.hours || 0) > 0 || (v.tasksCount || 0) > 0).length} Active Days
                </span>
              </div>
            </div>

            <div className="flex-1 flex items-end gap-1.5 min-h-[100px] pt-2">
              {displayedVelocity.length > 0 ? (
                displayedVelocity.map((v, i) => {
                  const maxH = Math.max(...displayedVelocity.map((x) => x.hours || 0), 1);
                  const hPct = ((v.hours || 0) / maxH) * 100;
                  const maxT = Math.max(...displayedVelocity.map((x) => x.tasksCount || 0), 1);
                  const tPct = ((v.tasksCount || 0) / maxT) * 100;
                  const barHeight = Math.max(hPct, tPct, 12);
                  return (
                    <div
                      key={v.day || i}
                      className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end"
                      title={`${v.day}: ${v.tasksCount || 0} tasks touched · ${(v.hours || 0).toFixed(1)}h logged`}
                    >
                      <div
                        className={`w-full relative rounded-t-lg overflow-hidden transition-all border ${
                          isDark
                            ? "bg-white/[0.05] border-white/[0.08] hatched-bar"
                            : "bg-slate-200/70 border-slate-300/60 hatched-bar-light"
                        }`}
                        style={{ height: `${barHeight}%` }}
                      >
                        {(v.hours || 0) > 0 && (
                          <div
                            className={`absolute bottom-0 left-0 right-0 rounded-t-lg transition-all ${
                              isDark ? "bg-zinc-200" : "bg-zinc-800"
                            }`}
                            style={{ height: `${Math.max(hPct, 25)}%` }}
                          />
                        )}
                      </div>
                      <span
                        className={`text-[10px] font-mono font-semibold ${
                          v.isToday ? `${g.heading} underline underline-offset-4` : g.muted
                        }`}
                      >
                        {v.day || ""}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="w-full flex items-center justify-center gap-2 opacity-35 pb-4">
                  <BarChart2 className="w-4 h-4" />
                  <span className="text-xs">No velocity data</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 3. BOTTOM WORKSPACE GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Top Priority Tickets (5/12) */}
          <div className={`lg:col-span-5 rounded-2xl p-5 border flex flex-col gap-3 overflow-hidden ${g.card}`}>
            <div className="flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${g.badge}`}>
                  <Zap className="w-4 h-4 opacity-80" />
                </div>
                <div>
                  <h2 className={`text-sm font-display font-bold leading-tight ${g.heading}`}>
                    Priority Focus Queue
                  </h2>
                  <SectionLabel>Click any ticket to open drawer</SectionLabel>
                </div>
              </div>
              <div className={`flex items-center p-0.5 rounded-full border gap-0.5 ${g.subtleSurface}`}>
                {["All", "Urgent", "High"].map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setSelectedTaskType(f)}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all cursor-pointer ${
                      selectedTaskType === f ? g.pillActive : g.muted
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2 flex-1 overflow-y-auto max-h-[260px] pr-0.5">
              {filteredTickets.length > 0 ? (
                filteredTickets.map((t) => {
                  const sb = STATUS_BADGE[t.status] || STATUS_BADGE.todo;
                  return (
                    <div
                      key={t.id}
                      onClick={() => setSelectedTaskKeyOrId(t.key || t.id)}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer group ${g.subtleSurface} ${g.rowHover}`}
                    >
                      <span className={`w-2 h-2 rounded-full shrink-0 ${PRIORITY_DOT[t.priority] || "bg-zinc-400"}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`text-[10px] font-mono font-bold ${g.muted}`}>{t.key}</span>
                          {t.assigneeName && (
                            <span className={`text-[10px] truncate ${g.muted}`}>· {t.assigneeName}</span>
                          )}
                        </div>
                        <span className={`text-xs font-semibold leading-snug block truncate ${g.heading}`}>
                          {t.title}
                        </span>
                        {t.dueDate && (
                          <span className={`text-[10px] mt-0.5 flex items-center gap-1 ${g.muted}`}>
                            <CalendarIcon className="w-2.5 h-2.5" />
                            Due {formatDateIN(t.dueDate, { day: "2-digit", month: "short" })}
                          </span>
                        )}
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${sb.cls}`}>
                        {sb.label}
                      </span>
                      <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
                    </div>
                  );
                })
              ) : (
                <div className={`flex-1 flex flex-col items-center justify-center gap-2 py-10 ${g.muted}`}>
                  <CheckSquare className="w-7 h-7 opacity-40" />
                  <span className="text-xs font-medium">All caught up — no matching priority tickets</span>
                </div>
              )}
            </div>
          </div>

          {/* Status Distribution Mix (3/12) */}
          <div className={`lg:col-span-3 rounded-2xl p-5 border flex flex-col gap-3.5 overflow-hidden ${g.card}`}>
            <div className="flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${g.badge}`}>
                  <Layers className="w-4 h-4 opacity-80" />
                </div>
                <div>
                  <h2 className={`text-sm font-display font-bold leading-tight ${g.heading}`}>
                    Status Distribution
                  </h2>
                  <SectionLabel>{statusSegments.total} tracked tasks</SectionLabel>
                </div>
              </div>
              <span className={`text-sm font-display font-bold tabular-nums ${g.heading}`}>
                {summary.completionRate}%
              </span>
            </div>

            {/* Clean Stacked Segmented Bar */}
            <div className={`w-full h-3 rounded-full overflow-hidden flex gap-0.5 p-0.5 ${g.progressTrack}`}>
              {statusSegments.items.map(
                (seg) =>
                  seg.pct > 0 && (
                    <div
                      key={seg.key}
                      className={`h-full rounded-full transition-all duration-500 ${seg.barCls}`}
                      style={{ width: `${seg.pct}%` }}
                      title={`${seg.label}: ${seg.count} (${seg.pct}%)`}
                    />
                  )
              )}
            </div>

            {/* Status Metric Rows */}
            <div className="grid grid-cols-2 gap-2 flex-1">
              {statusSegments.items.map((seg) => (
                <div key={seg.key} className={`p-3 rounded-xl border flex flex-col justify-between ${g.subtleSurface}`}>
                  <div className="flex items-center justify-between">
                    <span className="w-2 h-2 rounded-full" style={{ background: seg.dot }} />
                    <span className={`text-[10px] font-mono font-bold tabular-nums ${g.muted}`}>{seg.pct}%</span>
                  </div>
                  <div className="mt-2">
                    <span className={`text-lg font-display font-bold tabular-nums block leading-none ${g.heading}`}>
                      {seg.count}
                    </span>
                    <span className={`text-[10px] font-medium mt-1 block ${g.muted}`}>{seg.label}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Department Capacity / Deliverables (4/12) */}
          <div className={`lg:col-span-4 rounded-2xl p-5 border flex flex-col gap-3 overflow-hidden ${g.card}`}>
            {currentRole === "admin" || currentRole === "manager" ? (
              <>
                <div className="flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${g.badge}`}>
                      <TrendingUp className="w-4 h-4 opacity-80" />
                    </div>
                    <div>
                      <h2 className={`text-sm font-display font-bold leading-tight ${g.heading}`}>
                        Department Capacity
                      </h2>
                      <SectionLabel>Workload & effort across teams</SectionLabel>
                    </div>
                  </div>
                  <span className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded-full border ${g.badge}`}>
                    {summary.totalLoggedHours || 0} hrs
                  </span>
                </div>

                <div className="flex flex-col gap-2.5 flex-1 overflow-y-auto max-h-[220px] pr-0.5">
                  {departmentBreakdown.length > 0 ? (
                    departmentBreakdown.map((dept, i) => {
                      const deptHours = dept.hoursLogged ?? dept.loggedHours ?? 0;
                      const maxH = Math.max(...departmentBreakdown.map((d) => d.hoursLogged ?? d.loggedHours ?? 0), 1);
                      const pct = Math.max((deptHours / maxH) * 100, dept.taskCount > 0 ? 12 : 0);
                      return (
                        <div key={dept.name || i} className={`p-2.5 rounded-xl border ${g.subtleSurface}`}>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className={`text-xs font-semibold ${g.heading}`}>{dept.name}</span>
                            <div className="flex items-center gap-2 text-[10px] font-mono tabular-nums">
                              <span className={`font-bold ${g.heading}`}>{deptHours}h</span>
                              <span className={g.muted}>{dept.taskCount || 0} tasks</span>
                            </div>
                          </div>
                          <div className={`w-full h-1.5 rounded-full overflow-hidden ${g.progressTrack}`}>
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${g.progressFill}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="flex flex-col gap-2">
                      {teamWorkload.slice(0, 5).map((m, i) => {
                        const maxT = Math.max(...teamWorkload.map((x) => x.openTasks || 0), 1);
                        const pct = ((m.openTasks || 0) / maxT) * 100;
                        return (
                          <div key={m.userId || i} className={`flex items-center gap-2.5 p-2 rounded-xl border ${g.subtleSurface}`}>
                            <UserAvatar
                              user={{ fullname: m.name, avatar: m.profileImageUrl || m.avatar }}
                              className="w-7 h-7 rounded-full border border-white/15"
                              textClass="text-[10px]"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <span className={`text-xs font-semibold truncate ${g.heading}`}>{m.name}</span>
                                <span className={`font-mono text-[10px] tabular-nums ${g.muted}`}>{m.openTasks} open</span>
                              </div>
                              <div className={`w-full h-1.5 rounded-full overflow-hidden ${g.progressTrack}`}>
                                <div
                                  className={`h-full rounded-full ${m.isOverloaded ? "bg-rose-400" : g.progressFill}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className={`flex items-center justify-between text-[10px] pt-1 font-medium ${g.muted}`}>
                  <span className="flex items-center gap-1.5">
                    <Circle className="w-2 h-2 fill-emerald-400 text-emerald-400" />
                    Live synced with MongoDB workload
                  </span>
                  <Link to="/team" className="hover:underline font-semibold">
                    View Team →
                  </Link>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2.5 shrink-0">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${g.badge}`}>
                    <CheckSquare className="w-4 h-4 opacity-80" />
                  </div>
                  <div>
                    <h2 className={`text-sm font-display font-bold leading-tight ${g.heading}`}>
                      My Deliverables
                    </h2>
                    <SectionLabel>Personal progress & upcoming deadlines</SectionLabel>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <div>
                    <span className={`text-2xl font-display font-bold tabular-nums ${g.heading}`}>
                      {userRoleData.myMetrics?.doneTasks || 0}
                      <span className="text-sm font-normal opacity-45 ml-1">
                        / {userRoleData.myMetrics?.totalTasks || 0}
                      </span>
                    </span>
                    <span className={`block text-[10px] ${g.muted}`}>Tasks completed</span>
                  </div>
                </div>

                <div className="flex flex-col gap-2 flex-1 overflow-y-auto">
                  {topPriorityTickets.slice(0, 4).map((t) => {
                    const sb = STATUS_BADGE[t.status] || STATUS_BADGE.todo;
                    return (
                      <div
                        key={t.id}
                        onClick={() => setSelectedTaskKeyOrId(t.key || t.id)}
                        className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${g.subtleSurface} ${g.rowHover}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${PRIORITY_DOT[t.priority] || "bg-zinc-400"}`} />
                        <span className={`text-xs font-semibold flex-1 truncate ${g.heading}`}>{t.title}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${sb.cls}`}>
                          {sb.label}
                        </span>
                      </div>
                    );
                  })}
                  {topPriorityTickets.length === 0 && (
                    <div className={`flex-1 flex flex-col items-center justify-center gap-2 py-8 ${g.muted}`}>
                      <CheckSquare className="w-6 h-6 opacity-40" />
                      <span className="text-xs">All caught up!</span>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
