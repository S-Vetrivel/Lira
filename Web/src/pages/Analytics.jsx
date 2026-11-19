import React, { useState, useEffect, useMemo } from "react";
import { useApp } from "../context/Appcontext";
import { getManagerOverview } from "../services/api";
import {
  TrendingUp,
  ArrowUpRight,
  ChevronDown,
  Calendar as CalendarIcon,
  BarChart2,
  PieChart,
  CheckCircle2,
  Clock,
  Layers,
  Sparkles,
  RefreshCw,
  Globe,
  SlidersHorizontal,
  Flame,
  ArrowRight,
  AlertCircle,
  ShieldCheck,
  Briefcase,
  User,
  Users,
  Target,
  CheckSquare,
} from "lucide-react";

export default function Analytics() {
  const { user, activeProject, setSelectedTaskKeyOrId, theme } = useApp();
  const isDark = theme === "dark";

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState("Month");
  const [installTimeFilter, setInstallTimeFilter] = useState("Week");
  const [selectedTaskType, setSelectedTaskType] = useState("All");

  const loadOverview = async () => {
    setLoading(true);
    try {
      const res = await getManagerOverview(activeProject?._id);
      if (res.success) {
        setData(res);
      }
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
    },
    statusBreakdown = {
      inProgress: { count: 0, percentage: 0 },
      done: { count: 0, percentage: 0 },
      review: { count: 0, percentage: 0 },
      todo: { count: 0, percentage: 0 },
    },
    weeklyVelocity = [],
    throughputCurve = [],
    topPriorityTickets = [],
    teamWorkload = [],
    departmentBreakdown = [],
    projectProgress = [],
    overdueTasks = [],
    userRoleData = {},
  } = data || {};

  const currentRole = user?.role || "employee";

  // Filtered tickets based on dropdown selection
  const filteredTickets = useMemo(() => {
    if (selectedTaskType === "Urgent") {
      return topPriorityTickets.filter((t) => t.priority === "urgent");
    }
    if (selectedTaskType === "High") {
      return topPriorityTickets.filter(
        (t) => t.priority === "urgent" || t.priority === "high"
      );
    }
    return topPriorityTickets;
  }, [topPriorityTickets, selectedTaskType]);

  // Determine effective status breakdown (role-aware: contributor sees their own, manager/admin sees project/company)
  const activeStatusBreakdown = useMemo(() => {
    if (currentRole === "employee" && userRoleData?.myStatusBreakdown) {
      return userRoleData.myStatusBreakdown;
    }
    return statusBreakdown;
  }, [currentRole, userRoleData, statusBreakdown]);

  // Generate SVG path points for throughput curve
  const svgPathData = useMemo(() => {
    if (!throughputCurve || throughputCurve.length === 0) {
      return {
        pathD: "M 10,80 Q 50,40 100,75 T 180,95 T 240,40 T 320,60 T 390,70",
        areaD: "M 10,80 Q 50,40 100,75 T 180,95 T 240,40 T 320,60 T 390,70 L 390,120 L 10,120 Z",
        amberD: "M 10,95 Q 50,65 100,90 T 180,105 T 240,55 T 320,75 T 390,85",
        activeX: 240,
        activeY: 40,
      };
    }

    const width = 390;
    const height = 110;
    const paddingX = 15;
    const maxVal = Math.max(...throughputCurve.map((d) => d.actions), 10);
    const stepX = (width - paddingX * 2) / (throughputCurve.length - 1);

    const points = throughputCurve.map((d, i) => {
      const x = paddingX + i * stepX;
      const y = height - (d.actions / maxVal) * (height - 25);
      return { x, y, hours: d.hours, actions: d.actions };
    });

    // Build SVG path
    let pathD = `M ${points[0].x},${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cx = (prev.x + curr.x) / 2;
      pathD += ` C ${cx},${prev.y} ${cx},${curr.y} ${curr.x},${curr.y}`;
    }

    const areaD = `${pathD} L ${points[points.length - 1].x},120 L ${points[0].x},120 Z`;

    // Amber secondary line
    let amberD = `M ${points[0].x},${Math.min(115, points[0].y + 15)}`;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cx = (prev.x + curr.x) / 2;
      amberD += ` C ${cx},${Math.min(115, prev.y + 15)} ${cx},${Math.min(115, curr.y + 15)} ${curr.x},${Math.min(115, curr.y + 15)}`;
    }

    const lastIdx = points.length - 1;
    const activeX = points[lastIdx]?.x || 240;
    const activeY = points[lastIdx]?.y || 40;

    return { pathD, areaD, amberD, activeX, activeY, points };
  }, [throughputCurve]);

  // Calendar dates setup (current real month)
  const today = new Date();
  const currentMonthName = today.toLocaleDateString("en-US", { month: "long" });
  const currentYear = today.getFullYear();
  const currentDayNumber = today.getDate();

  return (
    <div
      className={`flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 w-full max-w-[1540px] mx-auto transition-colors duration-150 ${
        isDark ? "text-slate-100" : "text-slate-800"
      }`}
    >
      {/* ==============================================================
          ROLE-AWARE EXECUTIVE HEADER BANNER
          ============================================================== */}
      <div
        className={`p-5 sm:p-6 rounded-3xl border transition-all ${
          isDark
            ? "bg-[#14151c] border-white/10 shadow-xl"
            : "bg-white border-slate-200/90 shadow-xs"
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {currentRole === "admin" && (
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-purple-500/15 text-purple-400 border border-purple-500/20 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Enterprise Executive Oversight
                </span>
              )}
              {currentRole === "manager" && (
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/20 flex items-center gap-1">
                  <Briefcase className="w-3.5 h-3.5" />
                  Sprint Leadership & Delivery Cockpit
                </span>
              )}
              {currentRole === "employee" && (
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                  <User className="w-3.5 h-3.5" />
                  Contributor Cockpit & Velocity
                </span>
              )}
              <span className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                • {activeProject ? `Project [${activeProject.prefix}] ${activeProject.name}` : "All Workspaces"}
              </span>
            </div>
            <h1 className={`text-xl sm:text-2xl font-black tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
              {currentRole === "admin" && "Company-Wide Health & Velocity"}
              {currentRole === "manager" && `Sprint Velocity & Team Capacity`}
              {currentRole === "employee" && `Personal Workload & Delivery Velocity`}
            </h1>
          </div>

          {/* Quick Metrics Bar */}
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            {currentRole === "admin" && (
              <>
                <div className={`px-3.5 py-2 rounded-2xl border text-center ${isDark ? "bg-[#1b1c26] border-white/10" : "bg-slate-100 border-slate-200"}`}>
                  <span className={`text-[10px] uppercase font-bold block ${isDark ? "text-slate-400" : "text-slate-500"}`}>Workspaces</span>
                  <span className={`text-sm font-black ${isDark ? "text-white" : "text-slate-900"}`}>{userRoleData.adminMetrics?.totalProjectsCount ?? projectProgress.length}</span>
                </div>
                <div className={`px-3.5 py-2 rounded-2xl border text-center ${isDark ? "bg-[#1b1c26] border-white/10" : "bg-slate-100 border-slate-200"}`}>
                  <span className={`text-[10px] uppercase font-bold block ${isDark ? "text-slate-400" : "text-slate-500"}`}>Active Staff</span>
                  <span className={`text-sm font-black ${isDark ? "text-white" : "text-slate-900"}`}>{userRoleData.adminMetrics?.totalUsersCount ?? teamWorkload.length}</span>
                </div>
                <div className={`px-3.5 py-2 rounded-2xl border text-center ${isDark ? "bg-[#1b1c26] border-white/10" : "bg-slate-100 border-slate-200"}`}>
                  <span className={`text-[10px] uppercase font-bold block ${isDark ? "text-slate-400" : "text-slate-500"}`}>Departments</span>
                  <span className={`text-sm font-black ${isDark ? "text-white" : "text-slate-900"}`}>{userRoleData.adminMetrics?.totalDepartmentsCount ?? departmentBreakdown.length}</span>
                </div>
                <div className={`px-3.5 py-2 rounded-2xl border text-center ${isDark ? "bg-emerald-500/10 border-emerald-500/20" : "bg-emerald-50 border-emerald-200"}`}>
                  <span className="text-[10px] uppercase font-bold text-emerald-600 block">Overall Done</span>
                  <span className="text-sm font-black text-emerald-600">{summary.completionRate}%</span>
                </div>
              </>
            )}

            {currentRole === "manager" && (
              <>
                <div className={`px-3.5 py-2 rounded-2xl border text-center ${isDark ? "bg-[#1b1c26] border-white/10" : "bg-slate-100 border-slate-200"}`}>
                  <span className={`text-[10px] uppercase font-bold block ${isDark ? "text-slate-400" : "text-slate-500"}`}>Total Tickets</span>
                  <span className={`text-sm font-black ${isDark ? "text-white" : "text-slate-900"}`}>{summary.totalTasks}</span>
                </div>
                <div className={`px-3.5 py-2 rounded-2xl border text-center ${isDark ? "bg-[#1b1c26] border-white/10" : "bg-slate-100 border-slate-200"}`}>
                  <span className={`text-[10px] uppercase font-bold block ${isDark ? "text-slate-400" : "text-slate-500"}`}>Unassigned</span>
                  <span className={`text-sm font-black ${isDark ? "text-amber-400" : "text-amber-600"}`}>
                    {userRoleData.managerMetrics?.unassignedTasksCount ?? 0}
                  </span>
                </div>
                <div className={`px-3.5 py-2 rounded-2xl border text-center ${
                  (userRoleData.managerMetrics?.overloadedMembersCount || 0) > 0
                    ? isDark ? "bg-rose-500/15 border-rose-500/30 text-rose-400" : "bg-rose-50 border-rose-200 text-rose-700"
                    : isDark ? "bg-[#1b1c26] border-white/10" : "bg-slate-100 border-slate-200"
                }`}>
                  <span className="text-[10px] uppercase font-bold block">Overloaded</span>
                  <span className="text-sm font-black">{userRoleData.managerMetrics?.overloadedMembersCount ?? 0}</span>
                </div>
                <div className={`px-3.5 py-2 rounded-2xl border text-center ${isDark ? "bg-indigo-500/10 border-indigo-500/20" : "bg-indigo-50 border-indigo-200"}`}>
                  <span className="text-[10px] uppercase font-bold text-indigo-500 block">Sprint Done</span>
                  <span className="text-sm font-black text-indigo-500">{summary.completionRate}%</span>
                </div>
              </>
            )}

            {currentRole === "employee" && (
              <>
                <div className={`px-3.5 py-2 rounded-2xl border text-center ${isDark ? "bg-[#1b1c26] border-white/10" : "bg-slate-100 border-slate-200"}`}>
                  <span className={`text-[10px] uppercase font-bold block ${isDark ? "text-slate-400" : "text-slate-500"}`}>Assigned To Me</span>
                  <span className={`text-sm font-black ${isDark ? "text-white" : "text-slate-900"}`}>{userRoleData.myMetrics?.totalTasks ?? 0}</span>
                </div>
                <div className={`px-3.5 py-2 rounded-2xl border text-center ${isDark ? "bg-[#1b1c26] border-white/10" : "bg-slate-100 border-slate-200"}`}>
                  <span className={`text-[10px] uppercase font-bold block ${isDark ? "text-slate-400" : "text-slate-500"}`}>In Progress</span>
                  <span className={`text-sm font-black text-blue-500`}>{userRoleData.myMetrics?.inProgressTasks ?? 0}</span>
                </div>
                <div className={`px-3.5 py-2 rounded-2xl border text-center ${isDark ? "bg-[#1b1c26] border-white/10" : "bg-slate-100 border-slate-200"}`}>
                  <span className={`text-[10px] uppercase font-bold block ${isDark ? "text-slate-400" : "text-slate-500"}`}>Hours Logged</span>
                  <span className={`text-sm font-black ${isDark ? "text-amber-400" : "text-amber-600"}`}>
                    {userRoleData.myMetrics?.loggedHours ?? 0}h / {userRoleData.myMetrics?.estimatedHours ?? 0}h
                  </span>
                </div>
                <div className={`px-3.5 py-2 rounded-2xl border text-center ${isDark ? "bg-emerald-500/10 border-emerald-500/20" : "bg-emerald-50 border-emerald-200"}`}>
                  <span className="text-[10px] uppercase font-bold text-emerald-600 block">Completion</span>
                  <span className="text-sm font-black text-emerald-600">{userRoleData.myMetrics?.completionRate ?? 0}%</span>
                </div>
              </>
            )}

            <button
              onClick={loadOverview}
              className={`p-2.5 rounded-2xl border transition-all cursor-pointer ${
                isDark
                  ? "bg-[#1b1c26] border-white/10 text-slate-300 hover:text-white hover:bg-white/10"
                  : "bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-200"
              }`}
              title="Refresh Analytics"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {/* ==============================================================
          ROW 1: Throughput (Chart), Calendar (Sprint), Velocity (Bars)
          ============================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* 1. Throughput & Velocity Curve (5 Cols) */}
        <div
          className={`lg:col-span-5 p-6 flex flex-col justify-between rounded-3xl border transition-all ${
            isDark
              ? "bg-[#14151c] border-white/10 shadow-2xl"
              : "bg-white border-slate-200/90 shadow-sm"
          }`}
        >
          <div>
            {/* Header: Title & Time Filter Pills */}
            <div className="flex items-center justify-between gap-2 mb-4">
              <div>
                <h3 className={`text-base font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                  Throughput & Delivery Curve
                </h3>
                <span className={`text-[11px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  {currentRole === "employee" ? "Your contribution activity over 14 days" : "Team task throughput & actions"}
                </span>
              </div>
              <div
                className={`flex items-center p-0.5 rounded-full border text-[11px] font-medium ${
                  isDark ? "bg-[#1b1c26] border-white/5" : "bg-slate-100 border-slate-200"
                }`}
              >
                {["Today", "Week", "Month", "All"].map((period) => (
                  <button
                    key={period}
                    onClick={() => setTimeFilter(period)}
                    className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
                      timeFilter === period
                        ? isDark
                          ? "bg-white text-slate-950 font-bold shadow-xs"
                          : "bg-slate-900 text-white font-bold shadow-xs"
                        : isDark
                        ? "text-slate-400 hover:text-white"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {period}
                  </button>
                ))}
              </div>
            </div>

            {/* Real Metric Numbers */}
            <div className="flex items-baseline gap-6 mb-6">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`text-3xl sm:text-4xl font-black tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                    {currentRole === "employee"
                      ? userRoleData.myMetrics?.totalTasks || summary.totalTasks
                      : summary.totalTasks}
                  </span>
                  <span className="text-[10px] font-bold bg-emerald-500/15 text-emerald-500 px-2 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-0.5">
                    ↗ {summary.completionRate}% Done
                  </span>
                </div>
                <span className={`text-xs font-medium mt-1 block ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  {currentRole === "employee" ? "Active tickets in queue" : "Sprint tickets tracked"}
                </span>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                    {currentRole === "employee"
                      ? `${userRoleData.myMetrics?.loggedHours || 0}h`
                      : `${summary.totalLoggedHours || 0}h`}
                  </span>
                  <span className="text-[10px] font-bold bg-indigo-500/15 text-indigo-400 px-2 py-0.5 rounded-full border border-indigo-500/20 flex items-center gap-0.5">
                    {summary.totalEstimatedHours ? `of ${summary.totalEstimatedHours}h est.` : "Logged effort"}
                  </span>
                </div>
                <span className={`text-xs font-medium mt-1 block ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  Logged work effort
                </span>
              </div>
            </div>
          </div>

          {/* Glowing Wave Chart */}
          <div className="relative pt-4 w-full">
            {/* Tooltip Tag */}
            <div
              className={`absolute top-0 right-1/4 z-10 flex items-center gap-2 rounded-full px-3 py-1 text-[10px] shadow-lg border ${
                isDark
                  ? "bg-[#222330] border-white/10 text-white"
                  : "bg-white border-slate-200 text-slate-800"
              }`}
            >
              <span className="flex items-center gap-1 text-purple-400 font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                {summary.totalTasks} Tasks
              </span>
              <span className={isDark ? "text-slate-500" : "text-slate-400"}>•</span>
              <span className="flex items-center gap-1 text-amber-500 font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                {summary.totalLoggedHours}h Work
              </span>
            </div>

            {/* Dynamic SVG Chart */}
            <svg viewBox="0 0 400 130" className="w-full h-32 sm:h-36 overflow-visible">
              <defs>
                <linearGradient id="purpleGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#818cf8" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#818cf8" stopOpacity="0" />
                </linearGradient>
              </defs>

              <line
                x1={svgPathData.activeX}
                y1="10"
                x2={svgPathData.activeX}
                y2="110"
                stroke={isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)"}
                strokeDasharray="3 3"
              />

              {/* Purple Area & Path */}
              <path d={svgPathData.areaD} fill="url(#purpleGrad)" />
              <path
                d={svgPathData.pathD}
                fill="none"
                stroke="#818cf8"
                strokeWidth="2.5"
                strokeLinecap="round"
              />

              {/* Yellow/Amber Secondary Curve */}
              <path
                d={svgPathData.amberD}
                fill="none"
                stroke="#f59e0b"
                strokeWidth="2"
                strokeLinecap="round"
                opacity="0.85"
              />

              {/* Markers */}
              <circle
                cx={svgPathData.activeX}
                cy={svgPathData.activeY}
                r="4.5"
                fill="#818cf8"
                stroke={isDark ? "#ffffff" : "#0f172a"}
                strokeWidth="2"
              />
              <circle
                cx={svgPathData.activeX}
                cy={Math.min(115, svgPathData.activeY + 15)}
                r="3.5"
                fill="#f59e0b"
                stroke={isDark ? "#ffffff" : "#0f172a"}
                strokeWidth="1.5"
              />
            </svg>

            {/* X-Axis labels from 14-day timeline */}
            <div className={`flex items-center justify-between text-[10px] font-mono pt-1 ${isDark ? "text-slate-500" : "text-slate-400"}`}>
              {throughputCurve.length > 0 ? (
                throughputCurve.filter((_, idx) => idx % 2 === 0).map((d, i) => (
                  <span
                    key={i}
                    className={d.dayNumber === currentDayNumber ? `font-bold ${isDark ? "text-white" : "text-slate-900"}` : ""}
                  >
                    {d.dayNumber}
                  </span>
                ))
              ) : (
                <>
                  <span>1</span>
                  <span>5</span>
                  <span>10</span>
                  <span>15</span>
                  <span className={`font-bold ${isDark ? "text-white" : "text-slate-900"}`}>{currentDayNumber}</span>
                  <span>25</span>
                  <span>30</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* 2. Sprint Calendar / Schedule (3 Cols) */}
        <div
          className={`lg:col-span-3 p-6 flex flex-col justify-between rounded-3xl border transition-all ${
            isDark
              ? "bg-[#14151c] border-white/10 shadow-2xl"
              : "bg-white border-slate-200/90 shadow-sm"
          }`}
        >
          <div>
            {/* Header: Month & Year */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-1.5">
                <CalendarIcon className="w-4 h-4 text-indigo-400" />
                <span className={`text-xs font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
                  {currentMonthName} {currentYear}
                </span>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                isDark ? "bg-indigo-500/15 border-indigo-500/30 text-indigo-300" : "bg-indigo-50 border-indigo-200 text-indigo-700"
              }`}>
                Active Sprint
              </span>
            </div>

            {/* Calendar Days Matrix */}
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-mono">
              {["M", "T", "W", "T", "F", "S", "S"].map((d, idx) => (
                <div key={idx} className={`py-1 font-bold ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                  {d}
                </div>
              ))}

              {Array.from({ length: 12 }, (_, i) => i + 1).map((day) => (
                <div key={day} className={`py-1.5 font-medium ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  {day}
                </div>
              ))}

              {/* Active Sprint highlighted days */}
              <div
                className={`col-span-7 grid grid-cols-7 gap-1 p-1 rounded-2xl border my-0.5 ${
                  isDark
                    ? "bg-indigo-500/10 border-indigo-500/20"
                    : "bg-indigo-50 border-indigo-200"
                }`}
              >
                {[13, 14, 15, 16, 17, 18, 19].map((day) => (
                  <div
                    key={day}
                    className={`py-1.5 rounded-xl font-bold transition-all ${
                      day === currentDayNumber
                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/30"
                        : isDark
                        ? "bg-indigo-500/20 text-indigo-300"
                        : "bg-indigo-100 text-indigo-700"
                    }`}
                  >
                    {day}
                  </div>
                ))}
              </div>

              {Array.from({ length: 11 }, (_, i) => i + 20).map((day) => (
                <div key={day} className={`py-1.5 ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                  {day}
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Card: Sprint Valuation / Personal Effort */}
          <div
            className={`mt-4 p-4 rounded-2xl border flex items-center justify-between ${
              isDark
                ? "bg-gradient-to-r from-[#1c1d27] to-[#252636] border-white/10"
                : "bg-slate-50 border-slate-200"
            }`}
          >
            <div>
              <span className={`text-[10px] uppercase tracking-wider block font-semibold ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                {currentRole === "employee" ? "My Logged Effort" : "Sprint Effort Value"}
              </span>
              <span className={`text-2xl font-black tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                {currentRole === "employee"
                  ? `${userRoleData.myMetrics?.loggedHours || 0} Hours`
                  : `$${Math.max(1200, (summary.totalLoggedHours || 12) * 75).toLocaleString()}`}
              </span>
              <span className={`text-[10px] block mt-0.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                {currentRole === "employee"
                  ? `${userRoleData.myMetrics?.doneTasks || 0} tasks resolved`
                  : `@ $75/hr billing valuation`}
              </span>
            </div>
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center border shrink-0 ${
                isDark
                  ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/30"
                  : "bg-indigo-100 text-indigo-600 border-indigo-200"
              }`}
            >
              <BarChart2 className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* 3. Task Velocity & Bar Chart (4 Cols) */}
        <div
          className={`lg:col-span-4 p-6 flex flex-col justify-between rounded-3xl border transition-all ${
            isDark
              ? "bg-[#14151c] border-white/10 shadow-2xl"
              : "bg-white border-slate-200/90 shadow-sm"
          }`}
        >
          <div>
            {/* Header: Title & Time Filter */}
            <div className="flex items-center justify-between gap-2 mb-4">
              <h3 className={`text-base font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                Weekly Burnup & Effort
              </h3>
              <div
                className={`flex items-center p-0.5 rounded-full border text-[11px] font-medium ${
                  isDark ? "bg-[#1b1c26] border-white/5" : "bg-slate-100 border-slate-200"
                }`}
              >
                {["Day", "Week", "Month"].map((period) => (
                  <button
                    key={period}
                    onClick={() => setInstallTimeFilter(period)}
                    className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
                      installTimeFilter === period
                        ? isDark
                          ? "bg-white text-slate-950 font-bold shadow-xs"
                          : "bg-slate-900 text-white font-bold shadow-xs"
                        : isDark
                        ? "text-slate-400 hover:text-white"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {period}
                  </button>
                ))}
              </div>
            </div>

            {/* Real Metric + splits */}
            <div className="flex items-center justify-between mb-5">
              <div>
                <span className={`text-3xl sm:text-4xl font-black tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                  {summary.totalTasks > 0 ? summary.totalTasks * 4 : 24}
                </span>
                <span className={`text-xs font-medium block mt-0.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  Story points this cycle
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl border text-xs font-bold ${
                    isDark ? "bg-[#1b1c26] border-white/10 text-white" : "bg-slate-100 border-slate-200 text-slate-900"
                  }`}
                >
                  <span>💻</span>
                  <span>{summary.inProgressTasks + summary.doneTasks} Active</span>
                </div>
                <div
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl border text-xs font-bold ${
                    isDark
                      ? "bg-[#1b1c26] border-white/10 text-amber-300"
                      : "bg-amber-50 border-amber-200 text-amber-800"
                  }`}
                >
                  <span>⚙️</span>
                  <span>{summary.totalLoggedHours}h</span>
                </div>
              </div>
            </div>
          </div>

          {/* Real Dynamic Weekly Velocity Bars */}
          <div className="space-y-2 pt-2">
            <div className="flex items-end justify-between gap-2 h-36 px-1">
              {weeklyVelocity.map((v) => {
                const maxBarHours = Math.max(...weeklyVelocity.map((x) => x.hours), 4);
                const heightPercent = Math.max(15, Math.round((v.hours / maxBarHours) * 90));

                if (v.isToday) {
                  return (
                    <div key={v.day} className="flex-1 flex flex-col items-center gap-1 h-full justify-end relative">
                      <span className="absolute -top-3 text-[10px] font-bold bg-indigo-500 text-white px-1.5 py-0.5 rounded-md shadow-md">
                        {v.hours}h
                      </span>
                      <div
                        style={{ height: `${heightPercent}%` }}
                        className="w-full max-w-[28px] rounded-2xl bg-indigo-500 shadow-lg shadow-indigo-500/20"
                      />
                      <div className="w-full max-w-[28px] h-4 rounded-xl bg-amber-400 shadow-lg shadow-amber-500/20 relative flex items-center justify-center">
                        <span className="text-[8px] font-black text-slate-950">{v.tasksCount}</span>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={v.day} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className={`w-full max-w-[28px] rounded-2xl transition-all ${
                        isDark ? "bg-[#222330] hatched-bar" : "bg-slate-100 hatched-bar-light border border-slate-200"
                      }`}
                    />
                  </div>
                );
              })}
            </div>

            {/* X-axis days */}
            <div className={`flex items-center justify-between text-[10px] font-medium px-1 ${isDark ? "text-slate-500" : "text-slate-400"}`}>
              {weeklyVelocity.map((v) => (
                <span
                  key={v.day}
                  className={v.isToday ? `font-bold ${isDark ? "text-white" : "text-slate-900"}` : ""}
                >
                  {v.day}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ==============================================================
          ROW 2: Top Tickets (List), Status Bubbles, Role-Specific Widget
          ============================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* 4. Top Priority Tickets (4 Cols) */}
        <div
          className={`lg:col-span-4 p-6 flex flex-col justify-between rounded-3xl border transition-all ${
            isDark
              ? "bg-[#14151c] border-white/10 shadow-2xl"
              : "bg-white border-slate-200/90 shadow-sm"
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-base font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                Top Priority Tickets
              </h3>
              <div className="relative">
                <select
                  value={selectedTaskType}
                  onChange={(e) => setSelectedTaskType(e.target.value)}
                  className={`appearance-none text-xs font-semibold rounded-full pl-3 pr-7 py-1 border cursor-pointer focus:outline-none ${
                    isDark
                      ? "bg-[#1b1c26] text-slate-300 border-white/10"
                      : "bg-slate-100 text-slate-700 border-slate-200"
                  }`}
                >
                  <option value="All">All Priorities</option>
                  <option value="High">High & Urgent</option>
                  <option value="Urgent">Urgent Only</option>
                </select>
                <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div className="space-y-3">
              {filteredTickets.length > 0 ? (
                filteredTickets.map((item) => {
                  const isUrgent = item.priority === "urgent";
                  const isHigh = item.priority === "high";

                  const tagBg = isUrgent
                    ? isDark
                      ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
                      : "bg-rose-50 text-rose-700 border-rose-200"
                    : isHigh
                    ? isDark
                      ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                      : "bg-amber-50 text-amber-700 border-amber-200"
                    : isDark
                    ? "bg-blue-500/20 text-blue-300 border-blue-500/30"
                    : "bg-blue-50 text-blue-700 border-blue-200";

                  const iconEmoji =
                    item.type === "bug"
                      ? "🐛"
                      : item.type === "request"
                      ? "⚡"
                      : item.type === "approval"
                      ? "📋"
                      : "🚀";

                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedTaskKeyOrId(item.key || item.id)}
                      className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 cursor-pointer group ${
                        isDark
                          ? "bg-[#1b1c26] border-white/5 hover:border-white/20"
                          : "bg-slate-50 border-slate-200 hover:border-indigo-300 shadow-xs"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-xl border flex items-center justify-center text-lg shrink-0 ${
                            isDark ? "bg-white/5 border-white/10" : "bg-white border-slate-200"
                          }`}
                        >
                          {iconEmoji}
                        </div>
                        <div className="min-w-0">
                          <h4
                            className={`text-xs font-bold truncate transition-colors ${
                              isDark
                                ? "text-white group-hover:text-indigo-300"
                                : "text-slate-900 group-hover:text-indigo-600"
                            }`}
                          >
                            [{item.key}] {item.title}
                          </h4>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-[9px] font-bold px-2 py-0.2 rounded-md border capitalize ${tagBg}`}>
                              {item.priority}
                            </span>
                            <span className={`text-[10px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                              {item.assigneeName} • {item.loggedHours}h / {item.estimatedHours}h
                            </span>
                          </div>
                        </div>
                      </div>

                      <span
                        className={`text-xs font-bold px-2.5 py-1 rounded-xl border shrink-0 capitalize ${
                          isDark
                            ? "text-slate-300 bg-white/5 border-white/5"
                            : "text-slate-700 bg-white border-slate-200"
                        }`}
                      >
                        {item.status.replace("_", " ")}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className={`p-6 text-center text-xs italic ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                  No active priority tickets matching criteria
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 5. Status Distribution Bubbles (3 Cols) */}
        <div
          className={`lg:col-span-3 p-6 flex flex-col justify-between rounded-3xl border transition-all ${
            isDark
              ? "bg-[#14151c] border-white/10 shadow-2xl"
              : "bg-white border-slate-200/90 shadow-sm"
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className={`text-base font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                  Status Distribution
                </h3>
                <span className={`text-[10px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  {currentRole === "employee" ? "Your workload distribution" : "Sprint cycle completion"}
                </span>
              </div>
              <button
                className={`w-7 h-7 rounded-full border flex items-center justify-center transition-all cursor-pointer ${
                  isDark
                    ? "bg-white/5 hover:bg-white/10 border-white/10 text-slate-300 hover:text-white"
                    : "bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700 hover:text-slate-900"
                }`}
              >
                <PieChart className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Dynamic Overlapping Circular Bubbles */}
            <div className="relative h-52 flex items-center justify-center overflow-hidden">
              {/* In Progress Circle */}
              <div className="absolute left-6 bottom-2 w-28 h-28 rounded-full bg-indigo-500 flex flex-col items-center justify-center text-white font-black shadow-2xl shadow-indigo-500/25 z-10 transition-transform hover:scale-105">
                <span className="text-2xl font-black">{activeStatusBreakdown.inProgress.percentage}%</span>
                <span className="text-[9px] font-bold uppercase opacity-90">In Progress</span>
                <span className="text-[9px] opacity-75 font-mono">{activeStatusBreakdown.inProgress.count} tasks</span>
              </div>

              {/* Completed Circle */}
              <div className="absolute right-4 bottom-4 w-24 h-24 rounded-full bg-amber-400 flex flex-col items-center justify-center text-slate-950 font-black shadow-xl shadow-amber-500/25 z-20 transition-transform hover:scale-105">
                <span className="text-xl font-black">{activeStatusBreakdown.done.percentage}%</span>
                <span className="text-[8px] font-bold text-slate-900 uppercase">Completed</span>
                <span className="text-[8px] opacity-75 font-mono">{activeStatusBreakdown.done.count} tasks</span>
              </div>

              {/* In Review Circle */}
              <div className="absolute top-2 right-16 w-20 h-20 rounded-full bg-sky-400 flex flex-col items-center justify-center text-slate-950 font-black shadow-lg shadow-sky-500/25 z-15 transition-transform hover:scale-105">
                <span className="text-base font-black">{activeStatusBreakdown.review.percentage}%</span>
                <span className="text-[8px] font-bold text-slate-900 uppercase">Review</span>
              </div>

              {/* Backlog / Todo Circle */}
              <div className="absolute top-10 right-4 w-11 h-11 rounded-full bg-emerald-400 flex flex-col items-center justify-center text-slate-950 text-[10px] font-black shadow-md shadow-emerald-500/25 z-30 transition-transform hover:scale-105">
                <span>{activeStatusBreakdown.todo.percentage}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* 6. Dynamic Role-Specific Widget (5 Cols) */}
        <div
          className={`lg:col-span-5 p-6 flex flex-col justify-between rounded-3xl border transition-all ${
            isDark
              ? "bg-[#14151c] border-white/10 shadow-2xl"
              : "bg-white border-slate-200/90 shadow-sm"
          }`}
        >
          {/* ================= ADMIN VIEW: Company Departments ================= */}
          {currentRole === "admin" && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className={`text-base font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                    Department Workload & Capacity
                  </h3>
                  <span className={`text-[10px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    Enterprise department output & logged effort
                  </span>
                </div>
                <div className="text-right">
                  <span className={`text-xl sm:text-2xl font-black tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                    {summary.totalLoggedHours || 0} hrs
                  </span>
                  <span className={`text-[10px] block -mt-0.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    Total logged across teams
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                <div
                  className={`relative p-3 rounded-2xl border flex items-center justify-center min-h-[140px] ${
                    isDark ? "bg-[#1b1c26] border-white/5" : "bg-slate-50 border-slate-200"
                  }`}
                >
                  <div className="text-center space-y-2">
                    <Globe className={`w-10 h-10 mx-auto animate-pulse ${isDark ? "text-indigo-400/50" : "text-indigo-600/50"}`} />
                    <span className={`text-[10px] font-mono block ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                      Cross-Department Sync
                    </span>
                    <span className="text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                      🟢 All Systems Nominal
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  {departmentBreakdown.map((dept) => {
                    const icon =
                      dept.name.toLowerCase().includes("engineer") ? "💻" :
                      dept.name.toLowerCase().includes("operation") ? "⚙️" :
                      dept.name.toLowerCase().includes("market") ? "📈" : "👥";

                    return (
                      <div
                        key={dept.id}
                        className={`flex items-center justify-between p-2 rounded-xl transition-colors text-xs ${
                          isDark
                            ? "bg-white/5 hover:bg-white/10 text-slate-200"
                            : "bg-slate-100 hover:bg-slate-200 text-slate-800"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span>{icon}</span>
                          <span className="font-semibold">{dept.name}</span>
                        </div>
                        <div className="flex items-center gap-2 font-mono">
                          <span className="text-[10px] opacity-75">{dept.taskCount} tasks</span>
                          <span className="font-bold">{dept.hoursLogged}h</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ================= MANAGER VIEW: Team Workload Radar ================= */}
          {currentRole === "manager" && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className={`text-base font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                    Team Workload & Overload Flags
                  </h3>
                  <span className={`text-[10px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    Personnel capacity monitoring (alert at 5+ open tickets)
                  </span>
                </div>
                <div className="text-right">
                  <span className={`text-xl sm:text-2xl font-black tracking-tight ${
                    (userRoleData.managerMetrics?.overloadedMembersCount || 0) > 0 ? "text-rose-500" : "text-emerald-500"
                  }`}>
                    {userRoleData.managerMetrics?.overloadedMembersCount || 0}
                  </span>
                  <span className={`text-[10px] block -mt-0.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    Overloaded staff
                  </span>
                </div>
              </div>

              <div className="space-y-2.5 max-h-[175px] overflow-y-auto pr-1">
                {teamWorkload.slice(0, 5).map((m) => (
                  <div
                    key={m.userId}
                    className={`flex items-center justify-between p-2.5 rounded-2xl border transition-all text-xs ${
                      m.isOverloaded
                        ? isDark
                          ? "bg-rose-500/10 border-rose-500/30 text-rose-300"
                          : "bg-rose-50 border-rose-200 text-rose-800"
                        : isDark
                        ? "bg-[#1b1c26] border-white/5 text-slate-200"
                        : "bg-slate-50 border-slate-200 text-slate-800"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={m.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${m.name}`}
                        alt={m.name}
                        className="w-7 h-7 rounded-full object-cover shrink-0 border border-white/10"
                      />
                      <div className="min-w-0">
                        <span className="font-bold block truncate">{m.name}</span>
                        <span className="text-[10px] opacity-75 truncate block">
                          {m.jobTitle} • {m.departmentName}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        m.isOverloaded
                          ? "bg-rose-500 text-white shadow-xs"
                          : isDark
                          ? "bg-white/10 text-slate-300"
                          : "bg-slate-200 text-slate-700"
                      }`}>
                        {m.openTasks} open
                      </span>
                      <span className="font-mono text-[10px] opacity-80">{m.hoursLogged}h</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ================= EMPLOYEE VIEW: Personal Deadlines ================= */}
          {currentRole === "employee" && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className={`text-base font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                    My Deliverables & Deadlines
                  </h3>
                  <span className={`text-[10px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    Your upcoming task deadlines and progress
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xl sm:text-2xl font-black text-emerald-500">
                    {userRoleData.myMetrics?.doneTasks || 0} / {userRoleData.myMetrics?.totalTasks || 0}
                  </span>
                  <span className={`text-[10px] block -mt-0.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    Completed tasks
                  </span>
                </div>
              </div>

              <div className="space-y-2.5 max-h-[175px] overflow-y-auto pr-1">
                {topPriorityTickets.length > 0 ? (
                  topPriorityTickets.slice(0, 4).map((t) => (
                    <div
                      key={t.id}
                      onClick={() => setSelectedTaskKeyOrId(t.key || t.id)}
                      className={`flex items-center justify-between p-2.5 rounded-2xl border transition-all text-xs cursor-pointer group ${
                        isDark
                          ? "bg-[#1b1c26] border-white/5 hover:border-white/20 text-slate-200"
                          : "bg-slate-50 border-slate-200 hover:border-indigo-300 text-slate-800"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <CheckSquare className="w-4 h-4 text-indigo-400 shrink-0" />
                        <div className="min-w-0">
                          <span className={`font-bold block truncate transition-colors ${
                            isDark ? "group-hover:text-indigo-300" : "group-hover:text-indigo-600"
                          }`}>
                            [{t.key}] {t.title}
                          </span>
                          <span className={`text-[10px] block ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                            Due: {t.dueDate ? new Date(t.dueDate).toLocaleDateString([], { month: "short", day: "numeric" }) : "Sprint end"}
                          </span>
                        </div>
                      </div>

                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize shrink-0 ${
                        t.priority === "urgent"
                          ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                          : t.priority === "high"
                          ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                          : isDark
                          ? "bg-white/10 text-slate-300"
                          : "bg-slate-200 text-slate-700"
                      }`}>
                        {t.status.replace("_", " ")}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className={`p-4 text-center text-xs italic ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                    All assigned tasks completed! Great work!
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
