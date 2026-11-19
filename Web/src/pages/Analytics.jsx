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
        pathD: "M 10,60 Q 50,30 100,55 T 180,75 T 240,30 T 320,45 T 390,55",
        areaD: "M 10,60 Q 50,30 100,55 T 180,75 T 240,30 T 320,45 T 390,55 L 390,95 L 10,95 Z",
        amberD: "M 10,75 Q 50,50 100,70 T 180,85 T 240,45 T 320,60 T 390,70",
        activeX: 240,
        activeY: 30,
      };
    }

    const width = 390;
    const height = 85;
    const paddingX = 12;
    const maxVal = Math.max(...throughputCurve.map((d) => d.actions), 10);
    const stepX = (width - paddingX * 2) / (throughputCurve.length - 1);

    const points = throughputCurve.map((d, i) => {
      const x = paddingX + i * stepX;
      const y = height - (d.actions / maxVal) * (height - 20);
      return { x, y, hours: d.hours, actions: d.actions };
    });

    let pathD = `M ${points[0].x},${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cx = (prev.x + curr.x) / 2;
      pathD += ` C ${cx},${prev.y} ${cx},${curr.y} ${curr.x},${curr.y}`;
    }

    const areaD = `${pathD} L ${points[points.length - 1].x},95 L ${points[0].x},95 Z`;

    let amberD = `M ${points[0].x},${Math.min(90, points[0].y + 12)}`;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cx = (prev.x + curr.x) / 2;
      amberD += ` C ${cx},${Math.min(90, prev.y + 12)} ${cx},${Math.min(90, curr.y + 12)} ${curr.x},${Math.min(90, curr.y + 12)}`;
    }

    const lastIdx = points.length - 1;
    const activeX = points[lastIdx]?.x || 240;
    const activeY = points[lastIdx]?.y || 30;

    return { pathD, areaD, amberD, activeX, activeY, points };
  }, [throughputCurve]);

  // Calendar dates setup (current real month)
  const today = new Date();
  const currentMonthName = today.toLocaleDateString("en-US", { month: "short" });
  const currentYear = today.getFullYear();
  const currentDayNumber = today.getDate();

  return (
    <div
      className={`flex-1 w-full h-full min-h-0 flex flex-col lg:justify-between p-3 sm:p-4 lg:p-4 xl:p-5 gap-2.5 sm:gap-3 xl:gap-3.5 overflow-y-auto lg:overflow-hidden max-w-[1680px] mx-auto select-none transition-colors duration-150 ${
        isDark ? "text-slate-100" : "text-slate-800"
      }`}
    >
      {/* ==============================================================
          1. COMPACT ROLE-AWARE EXECUTIVE HEADER BANNER (Fixed Height)
          ============================================================== */}
      <div
        className={`px-4 py-2.5 sm:px-5 sm:py-3 rounded-2xl border shrink-0 transition-all ${
          isDark
            ? "bg-[#14151c] border-white/10 shadow-lg"
            : "bg-white border-slate-200 shadow-xs"
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {currentRole === "admin" && (
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-purple-500/15 text-purple-400 border border-purple-500/20 flex items-center gap-1 shrink-0">
                <ShieldCheck className="w-3 h-3" />
                Executive
              </span>
            )}
            {currentRole === "manager" && (
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/20 flex items-center gap-1 shrink-0">
                <Briefcase className="w-3 h-3" />
                Lead
              </span>
            )}
            {currentRole === "employee" && (
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 flex items-center gap-1 shrink-0">
                <User className="w-3 h-3" />
                Contributor
              </span>
            )}

            <div className="min-w-0">
              <h1 className={`text-sm sm:text-base xl:text-lg font-black tracking-tight truncate ${isDark ? "text-white" : "text-slate-900"}`}>
                {currentRole === "admin" && "Company-Wide Health & Velocity"}
                {currentRole === "manager" && "Sprint Velocity & Team Capacity"}
                {currentRole === "employee" && "Personal Workload & Delivery Velocity"}
              </h1>
            </div>
            <span className={`hidden md:inline text-xs truncate ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              • {activeProject ? `[${activeProject.prefix}] ${activeProject.name}` : "All Workspaces"}
            </span>
          </div>

          {/* Quick Metrics Bar */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 overflow-x-auto">
            {currentRole === "admin" && (
              <>
                <div className={`px-2.5 py-1 rounded-xl border text-center ${isDark ? "bg-[#1b1c26] border-white/10" : "bg-slate-100 border-slate-200"}`}>
                  <span className={`text-[9px] uppercase font-bold block ${isDark ? "text-slate-400" : "text-slate-500"}`}>Workspaces</span>
                  <span className={`text-xs font-black ${isDark ? "text-white" : "text-slate-900"}`}>{userRoleData.adminMetrics?.totalProjectsCount ?? projectProgress.length}</span>
                </div>
                <div className={`px-2.5 py-1 rounded-xl border text-center ${isDark ? "bg-[#1b1c26] border-white/10" : "bg-slate-100 border-slate-200"}`}>
                  <span className={`text-[9px] uppercase font-bold block ${isDark ? "text-slate-400" : "text-slate-500"}`}>Staff</span>
                  <span className={`text-xs font-black ${isDark ? "text-white" : "text-slate-900"}`}>{userRoleData.adminMetrics?.totalUsersCount ?? teamWorkload.length}</span>
                </div>
                <div className={`px-2.5 py-1 rounded-xl border text-center ${isDark ? "bg-[#1b1c26] border-white/10" : "bg-slate-100 border-slate-200"}`}>
                  <span className={`text-[9px] uppercase font-bold block ${isDark ? "text-slate-400" : "text-slate-500"}`}>Depts</span>
                  <span className={`text-xs font-black ${isDark ? "text-white" : "text-slate-900"}`}>{userRoleData.adminMetrics?.totalDepartmentsCount ?? departmentBreakdown.length}</span>
                </div>
                <div className={`px-2.5 py-1 rounded-xl border text-center ${isDark ? "bg-emerald-500/10 border-emerald-500/20" : "bg-emerald-50 border-emerald-200"}`}>
                  <span className="text-[9px] uppercase font-bold text-emerald-600 block">Done</span>
                  <span className="text-xs font-black text-emerald-600">{summary.completionRate}%</span>
                </div>
              </>
            )}

            {currentRole === "manager" && (
              <>
                <div className={`px-2.5 py-1 rounded-xl border text-center ${isDark ? "bg-[#1b1c26] border-white/10" : "bg-slate-100 border-slate-200"}`}>
                  <span className={`text-[9px] uppercase font-bold block ${isDark ? "text-slate-400" : "text-slate-500"}`}>Tickets</span>
                  <span className={`text-xs font-black ${isDark ? "text-white" : "text-slate-900"}`}>{summary.totalTasks}</span>
                </div>
                <div className={`px-2.5 py-1 rounded-xl border text-center ${isDark ? "bg-[#1b1c26] border-white/10" : "bg-slate-100 border-slate-200"}`}>
                  <span className={`text-[9px] uppercase font-bold block ${isDark ? "text-slate-400" : "text-slate-500"}`}>Unassigned</span>
                  <span className={`text-xs font-black ${isDark ? "text-amber-400" : "text-amber-600"}`}>
                    {userRoleData.managerMetrics?.unassignedTasksCount ?? 0}
                  </span>
                </div>
                <div className={`px-2.5 py-1 rounded-xl border text-center ${
                  (userRoleData.managerMetrics?.overloadedMembersCount || 0) > 0
                    ? isDark ? "bg-rose-500/15 border-rose-500/30 text-rose-400" : "bg-rose-50 border-rose-200 text-rose-700"
                    : isDark ? "bg-[#1b1c26] border-white/10" : "bg-slate-100 border-slate-200"
                }`}>
                  <span className="text-[9px] uppercase font-bold block">Overloaded</span>
                  <span className="text-xs font-black">{userRoleData.managerMetrics?.overloadedMembersCount ?? 0}</span>
                </div>
                <div className={`px-2.5 py-1 rounded-xl border text-center ${isDark ? "bg-indigo-500/10 border-indigo-500/20" : "bg-indigo-50 border-indigo-200"}`}>
                  <span className="text-[9px] uppercase font-bold text-indigo-500 block">Sprint</span>
                  <span className="text-xs font-black text-indigo-500">{summary.completionRate}%</span>
                </div>
              </>
            )}

            {currentRole === "employee" && (
              <>
                <div className={`px-2.5 py-1 rounded-xl border text-center ${isDark ? "bg-[#1b1c26] border-white/10" : "bg-slate-100 border-slate-200"}`}>
                  <span className={`text-[9px] uppercase font-bold block ${isDark ? "text-slate-400" : "text-slate-500"}`}>Assigned</span>
                  <span className={`text-xs font-black ${isDark ? "text-white" : "text-slate-900"}`}>{userRoleData.myMetrics?.totalTasks ?? 0}</span>
                </div>
                <div className={`px-2.5 py-1 rounded-xl border text-center ${isDark ? "bg-[#1b1c26] border-white/10" : "bg-slate-100 border-slate-200"}`}>
                  <span className={`text-[9px] uppercase font-bold block ${isDark ? "text-slate-400" : "text-slate-500"}`}>In Flight</span>
                  <span className={`text-xs font-black text-blue-500`}>{userRoleData.myMetrics?.inProgressTasks ?? 0}</span>
                </div>
                <div className={`px-2.5 py-1 rounded-xl border text-center ${isDark ? "bg-[#1b1c26] border-white/10" : "bg-slate-100 border-slate-200"}`}>
                  <span className={`text-[9px] uppercase font-bold block ${isDark ? "text-slate-400" : "text-slate-500"}`}>Logged</span>
                  <span className={`text-xs font-black ${isDark ? "text-amber-400" : "text-amber-600"}`}>
                    {userRoleData.myMetrics?.loggedHours ?? 0}h / {userRoleData.myMetrics?.estimatedHours ?? 0}h
                  </span>
                </div>
                <div className={`px-2.5 py-1 rounded-xl border text-center ${isDark ? "bg-emerald-500/10 border-emerald-500/20" : "bg-emerald-50 border-emerald-200"}`}>
                  <span className="text-[9px] uppercase font-bold text-emerald-600 block">Done</span>
                  <span className="text-xs font-black text-emerald-600">{userRoleData.myMetrics?.completionRate ?? 0}%</span>
                </div>
              </>
            )}

            <button
              onClick={loadOverview}
              className={`p-1.5 rounded-xl border transition-all cursor-pointer ${
                isDark
                  ? "bg-[#1b1c26] border-white/10 text-slate-300 hover:text-white hover:bg-white/10"
                  : "bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-200"
              }`}
              title="Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {/* ==============================================================
          2. ROW 1: Throughput (Chart), Calendar (Sprint), Velocity (Bars)
          ============================================================== */}
      <div className="lg:flex-1 lg:min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-2.5 sm:gap-3 xl:gap-3.5 items-stretch shrink-0 lg:shrink">
        {/* Card 1: Throughput & Velocity Curve (5 Cols) */}
        <div
          className={`lg:col-span-5 p-3.5 xl:p-4 rounded-2xl border flex flex-col justify-between overflow-hidden transition-all ${
            isDark
              ? "bg-[#14151c] border-white/10 shadow-lg"
              : "bg-white border-slate-200/90 shadow-xs"
          }`}
        >
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <div>
                <h3 className={`text-xs xl:text-sm font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                  Throughput & Delivery Curve
                </h3>
                <span className={`text-[10px] block ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  {currentRole === "employee" ? "Your contribution activity over 14 days" : "Sprint task actions & velocity"}
                </span>
              </div>
              <div
                className={`flex items-center p-0.5 rounded-full border text-[10px] font-medium ${
                  isDark ? "bg-[#1b1c26] border-white/5" : "bg-slate-100 border-slate-200"
                }`}
              >
                {["Today", "Week", "Month", "All"].map((period) => (
                  <button
                    key={period}
                    onClick={() => setTimeFilter(period)}
                    className={`px-2 py-0.5 rounded-full transition-all cursor-pointer ${
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

            {/* Metric Numbers */}
            <div className="flex items-baseline gap-4 mb-2">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className={`text-xl xl:text-2xl font-black tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                    {currentRole === "employee"
                      ? userRoleData.myMetrics?.totalTasks || summary.totalTasks
                      : summary.totalTasks}
                  </span>
                  <span className="text-[9px] font-bold bg-emerald-500/15 text-emerald-500 px-1.5 py-0.2 rounded-full border border-emerald-500/20">
                    ↗ {summary.completionRate}%
                  </span>
                </div>
                <span className={`text-[10px] font-medium block ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  {currentRole === "employee" ? "Active in queue" : "Sprint tickets"}
                </span>
              </div>

              <div>
                <div className="flex items-center gap-1.5">
                  <span className={`text-lg xl:text-xl font-extrabold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                    {currentRole === "employee"
                      ? `${userRoleData.myMetrics?.loggedHours || 0}h`
                      : `${summary.totalLoggedHours || 0}h`}
                  </span>
                  <span className="text-[9px] font-bold bg-indigo-500/15 text-indigo-400 px-1.5 py-0.2 rounded-full border border-indigo-500/20">
                    {summary.totalEstimatedHours ? `${summary.totalEstimatedHours}h est.` : "Effort"}
                  </span>
                </div>
                <span className={`text-[10px] font-medium block ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  Logged work effort
                </span>
              </div>
            </div>
          </div>

          {/* Glowing Wave Chart */}
          <div className="relative pt-1 w-full">
            <div
              className={`absolute top-0 right-1/4 z-10 flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[9px] shadow-md border ${
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
                {summary.totalLoggedHours}h
              </span>
            </div>

            <svg viewBox="0 0 390 100" className="w-full h-16 xl:h-20 2xl:h-24 overflow-visible">
              <defs>
                <linearGradient id="purpleGradMini" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#818cf8" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#818cf8" stopOpacity="0" />
                </linearGradient>
              </defs>

              <line
                x1={svgPathData.activeX}
                y1="5"
                x2={svgPathData.activeX}
                y2="90"
                stroke={isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)"}
                strokeDasharray="2 2"
              />

              <path d={svgPathData.areaD} fill="url(#purpleGradMini)" />
              <path
                d={svgPathData.pathD}
                fill="none"
                stroke="#818cf8"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d={svgPathData.amberD}
                fill="none"
                stroke="#f59e0b"
                strokeWidth="1.5"
                strokeLinecap="round"
                opacity="0.85"
              />

              <circle
                cx={svgPathData.activeX}
                cy={svgPathData.activeY}
                r="3.5"
                fill="#818cf8"
                stroke={isDark ? "#ffffff" : "#0f172a"}
                strokeWidth="1.5"
              />
              <circle
                cx={svgPathData.activeX}
                cy={Math.min(90, svgPathData.activeY + 12)}
                r="2.5"
                fill="#f59e0b"
                stroke={isDark ? "#ffffff" : "#0f172a"}
                strokeWidth="1"
              />
            </svg>

            <div className={`flex items-center justify-between text-[9px] font-mono pt-0.5 ${isDark ? "text-slate-500" : "text-slate-400"}`}>
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
                  <span className={`font-bold ${isDark ? "text-white" : "text-slate-900"}`}>{currentDayNumber}</span>
                  <span>25</span>
                  <span>30</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Card 2: Sprint Calendar / Schedule (3 Cols) */}
        <div
          className={`lg:col-span-3 p-3.5 xl:p-4 rounded-2xl border flex flex-col justify-between overflow-hidden transition-all ${
            isDark
              ? "bg-[#14151c] border-white/10 shadow-lg"
              : "bg-white border-slate-200/90 shadow-xs"
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <CalendarIcon className="w-3.5 h-3.5 text-indigo-400" />
                <span className={`text-xs font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
                  {currentMonthName} {currentYear}
                </span>
              </div>
              <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full border ${
                isDark ? "bg-indigo-500/15 border-indigo-500/30 text-indigo-300" : "bg-indigo-50 border-indigo-200 text-indigo-700"
              }`}>
                Active Sprint
              </span>
            </div>

            {/* Calendar Days Matrix */}
            <div className="grid grid-cols-7 gap-0.5 text-center text-[9px] font-mono">
              {["M", "T", "W", "T", "F", "S", "S"].map((d, idx) => (
                <div key={idx} className={`py-0.5 font-bold ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                  {d}
                </div>
              ))}

              {Array.from({ length: 12 }, (_, i) => i + 1).map((day) => (
                <div key={day} className={`py-0.5 font-medium ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  {day}
                </div>
              ))}

              {/* Active Sprint highlighted days */}
              <div
                className={`col-span-7 grid grid-cols-7 gap-0.5 p-0.5 rounded-xl border my-0.5 ${
                  isDark
                    ? "bg-indigo-500/10 border-indigo-500/20"
                    : "bg-indigo-50 border-indigo-200"
                }`}
              >
                {[13, 14, 15, 16, 17, 18, 19].map((day) => (
                  <div
                    key={day}
                    className={`py-0.5 rounded-lg font-bold transition-all ${
                      day === currentDayNumber
                        ? "bg-indigo-600 text-white shadow-xs"
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
                <div key={day} className={`py-0.5 ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                  {day}
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Card: Sprint Valuation / Personal Effort */}
          <div
            className={`mt-2 p-2.5 rounded-xl border flex items-center justify-between ${
              isDark
                ? "bg-gradient-to-r from-[#1c1d27] to-[#252636] border-white/10"
                : "bg-slate-50 border-slate-200"
            }`}
          >
            <div>
              <span className={`text-[9px] uppercase tracking-wider block font-semibold ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                {currentRole === "employee" ? "Logged Effort" : "Sprint Valuation"}
              </span>
              <span className={`text-base xl:text-lg font-black tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                {currentRole === "employee"
                  ? `${userRoleData.myMetrics?.loggedHours || 0} Hours`
                  : `$${Math.max(1200, (summary.totalLoggedHours || 12) * 75).toLocaleString()}`}
              </span>
              <span className={`text-[9px] block ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                {currentRole === "employee"
                  ? `${userRoleData.myMetrics?.doneTasks || 0} tasks resolved`
                  : `@ $75/hr billing`}
              </span>
            </div>
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center border shrink-0 ${
                isDark
                  ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/30"
                  : "bg-indigo-100 text-indigo-600 border-indigo-200"
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>

        {/* Card 3: Task Velocity & Bar Chart (4 Cols) */}
        <div
          className={`lg:col-span-4 p-3.5 xl:p-4 rounded-2xl border flex flex-col justify-between overflow-hidden transition-all ${
            isDark
              ? "bg-[#14151c] border-white/10 shadow-lg"
              : "bg-white border-slate-200/90 shadow-xs"
          }`}
        >
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <h3 className={`text-xs xl:text-sm font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                Weekly Burnup & Effort
              </h3>
              <div
                className={`flex items-center p-0.5 rounded-full border text-[10px] font-medium ${
                  isDark ? "bg-[#1b1c26] border-white/5" : "bg-slate-100 border-slate-200"
                }`}
              >
                {["Day", "Week", "Month"].map((period) => (
                  <button
                    key={period}
                    onClick={() => setInstallTimeFilter(period)}
                    className={`px-2 py-0.5 rounded-full transition-all cursor-pointer ${
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

            <div className="flex items-center justify-between mb-2">
              <div>
                <span className={`text-xl xl:text-2xl font-black tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                  {summary.totalTasks > 0 ? summary.totalTasks * 4 : 24}
                </span>
                <span className={`text-[10px] font-medium block ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  Story points this cycle
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <div
                  className={`flex items-center gap-1 px-2 py-1 rounded-xl border text-[10px] font-bold ${
                    isDark ? "bg-[#1b1c26] border-white/10 text-white" : "bg-slate-100 border-slate-200 text-slate-900"
                  }`}
                >
                  <span>💻</span>
                  <span>{summary.inProgressTasks + summary.doneTasks} Active</span>
                </div>
                <div
                  className={`flex items-center gap-1 px-2 py-1 rounded-xl border text-[10px] font-bold ${
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

          {/* Bar Chart */}
          <div className="space-y-1 pt-1">
            <div className="flex items-end justify-between gap-1.5 h-16 xl:h-20 2xl:h-24 px-1">
              {weeklyVelocity.map((v) => {
                const maxBarHours = Math.max(...weeklyVelocity.map((x) => x.hours), 4);
                const heightPercent = Math.max(18, Math.round((v.hours / maxBarHours) * 85));

                if (v.isToday) {
                  return (
                    <div key={v.day} className="flex-1 flex flex-col items-center gap-0.5 h-full justify-end relative">
                      <span className="absolute -top-2.5 text-[8px] font-bold bg-indigo-500 text-white px-1 rounded-sm shadow-xs">
                        {v.hours}h
                      </span>
                      <div
                        style={{ height: `${heightPercent}%` }}
                        className="w-full max-w-[22px] rounded-xl bg-indigo-500 shadow-md shadow-indigo-500/20"
                      />
                      <div className="w-full max-w-[22px] h-3 rounded-lg bg-amber-400 relative flex items-center justify-center">
                        <span className="text-[7px] font-black text-slate-950">{v.tasksCount}</span>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={v.day} className="flex-1 flex flex-col items-center gap-0.5 h-full justify-end">
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className={`w-full max-w-[22px] rounded-xl transition-all ${
                        isDark ? "bg-[#222330] hatched-bar" : "bg-slate-100 hatched-bar-light border border-slate-200"
                      }`}
                    />
                  </div>
                );
              })}
            </div>

            <div className={`flex items-center justify-between text-[9px] font-medium px-1 ${isDark ? "text-slate-500" : "text-slate-400"}`}>
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
          3. ROW 2: Top Tickets (List), Status Bubbles, Role-Specific Widget
          ============================================================== */}
      <div className="lg:flex-1 lg:min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-2.5 sm:gap-3 xl:gap-3.5 items-stretch shrink-0 lg:shrink">
        {/* Card 4: Top Priority Tickets (4 Cols) */}
        <div
          className={`lg:col-span-4 p-3.5 xl:p-4 rounded-2xl border flex flex-col justify-between overflow-hidden transition-all ${
            isDark
              ? "bg-[#14151c] border-white/10 shadow-lg"
              : "bg-white border-slate-200/90 shadow-xs"
          }`}
        >
          <div className="flex items-center justify-between mb-2 shrink-0">
            <h3 className={`text-xs xl:text-sm font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
              Top Priority Tickets
            </h3>
            <div className="relative">
              <select
                value={selectedTaskType}
                onChange={(e) => setSelectedTaskType(e.target.value)}
                className={`appearance-none text-[10px] font-semibold rounded-full pl-2.5 pr-6 py-0.5 border cursor-pointer focus:outline-none ${
                  isDark
                    ? "bg-[#1b1c26] text-slate-300 border-white/10"
                    : "bg-slate-100 text-slate-700 border-slate-200"
                }`}
              >
                <option value="All">All Priorities</option>
                <option value="High">High & Urgent</option>
                <option value="Urgent">Urgent Only</option>
              </select>
              <ChevronDown className="w-2.5 h-2.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          <div className="space-y-1.5 flex-1 min-h-0 overflow-y-auto pr-0.5">
            {filteredTickets.length > 0 ? (
              filteredTickets.slice(0, 3).map((item) => {
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
                    className={`p-2 rounded-xl border transition-all flex items-center justify-between gap-2.5 cursor-pointer group ${
                      isDark
                        ? "bg-[#1b1c26] border-white/5 hover:border-white/20"
                        : "bg-slate-50 border-slate-200 hover:border-indigo-300 shadow-xs"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-lg border flex items-center justify-center text-sm shrink-0 ${
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
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={`text-[8px] font-bold px-1.5 py-0.2 rounded-sm border capitalize ${tagBg}`}>
                            {item.priority}
                          </span>
                          <span className={`text-[9px] truncate ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                            {item.assigneeName} • {item.loggedHours}h / {item.estimatedHours}h
                          </span>
                        </div>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border shrink-0 capitalize ${
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
              <div className={`p-4 text-center text-xs italic ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                No active priority tickets
              </div>
            )}
          </div>
        </div>

        {/* Card 5: Status Distribution Bubbles (3 Cols) */}
        <div
          className={`lg:col-span-3 p-3.5 xl:p-4 rounded-2xl border flex flex-col justify-between overflow-hidden transition-all ${
            isDark
              ? "bg-[#14151c] border-white/10 shadow-lg"
              : "bg-white border-slate-200/90 shadow-xs"
          }`}
        >
          <div className="flex items-center justify-between mb-1 shrink-0">
            <div>
              <h3 className={`text-xs xl:text-sm font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                Status Distribution
              </h3>
              <span className={`text-[9px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                {currentRole === "employee" ? "Your workload breakdown" : "Sprint cycle completion"}
              </span>
            </div>
            <button
              className={`w-6 h-6 rounded-full border flex items-center justify-center transition-all cursor-pointer ${
                isDark
                  ? "bg-white/5 hover:bg-white/10 border-white/10 text-slate-300 hover:text-white"
                  : "bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700 hover:text-slate-900"
              }`}
            >
              <PieChart className="w-3 h-3" />
            </button>
          </div>

          {/* Compact Overlapping Circular Bubbles */}
          <div className="relative h-28 xl:h-32 2xl:h-36 flex items-center justify-center overflow-hidden">
            {/* In Progress */}
            <div className="absolute left-4 bottom-1 w-20 h-20 xl:w-22 xl:h-22 rounded-full bg-indigo-500 flex flex-col items-center justify-center text-white font-black shadow-lg shadow-indigo-500/25 z-10 transition-transform hover:scale-105">
              <span className="text-lg xl:text-xl font-black">{activeStatusBreakdown.inProgress.percentage}%</span>
              <span className="text-[8px] font-bold uppercase opacity-90">In Flight</span>
              <span className="text-[8px] opacity-75 font-mono">{activeStatusBreakdown.inProgress.count} t</span>
            </div>

            {/* Completed */}
            <div className="absolute right-4 bottom-2 w-16 h-16 xl:w-18 xl:h-18 rounded-full bg-amber-400 flex flex-col items-center justify-center text-slate-950 font-black shadow-md shadow-amber-500/25 z-20 transition-transform hover:scale-105">
              <span className="text-sm xl:text-base font-black">{activeStatusBreakdown.done.percentage}%</span>
              <span className="text-[7px] font-bold text-slate-900 uppercase">Done</span>
              <span className="text-[7px] opacity-75 font-mono">{activeStatusBreakdown.done.count} t</span>
            </div>

            {/* Review */}
            <div className="absolute top-1 right-14 w-12 h-12 xl:w-14 xl:h-14 rounded-full bg-sky-400 flex flex-col items-center justify-center text-slate-950 font-black shadow-sm shadow-sky-500/25 z-15 transition-transform hover:scale-105">
              <span className="text-xs xl:text-sm font-black">{activeStatusBreakdown.review.percentage}%</span>
              <span className="text-[7px] font-bold text-slate-900 uppercase">Rev</span>
            </div>

            {/* Backlog */}
            <div className="absolute top-4 right-3 w-8 h-8 rounded-full bg-emerald-400 flex flex-col items-center justify-center text-slate-950 text-[9px] font-black shadow-xs shadow-emerald-500/25 z-30 transition-transform hover:scale-105">
              <span>{activeStatusBreakdown.todo.percentage}%</span>
            </div>
          </div>
        </div>

        {/* Card 6: Dynamic Role Widget (5 Cols) */}
        <div
          className={`lg:col-span-5 p-3.5 xl:p-4 rounded-2xl border flex flex-col justify-between overflow-hidden transition-all ${
            isDark
              ? "bg-[#14151c] border-white/10 shadow-lg"
              : "bg-white border-slate-200/90 shadow-xs"
          }`}
        >
          {/* ================= ADMIN VIEW: Company Departments ================= */}
          {currentRole === "admin" && (
            <div className="flex flex-col h-full justify-between">
              <div className="flex items-center justify-between mb-2 shrink-0">
                <div>
                  <h3 className={`text-xs xl:text-sm font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                    Department Capacity
                  </h3>
                  <span className={`text-[9px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    Enterprise department output & effort
                  </span>
                </div>
                <div className="text-right">
                  <span className={`text-base xl:text-lg font-black tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                    {summary.totalLoggedHours || 0} hrs
                  </span>
                  <span className={`text-[9px] block -mt-0.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    Across teams
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-center flex-1 min-h-0">
                <div
                  className={`p-2 rounded-xl border flex items-center justify-center h-full min-h-[80px] ${
                    isDark ? "bg-[#1b1c26] border-white/5" : "bg-slate-50 border-slate-200"
                  }`}
                >
                  <div className="text-center space-y-1">
                    <Globe className={`w-6 h-6 mx-auto ${isDark ? "text-indigo-400/60" : "text-indigo-600/60"}`} />
                    <span className={`text-[9px] font-mono block ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                      Cross-Sync
                    </span>
                    <span className="text-[9px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.2 rounded-full border border-emerald-500/20">
                      🟢 All Nominal
                    </span>
                  </div>
                </div>

                <div className="space-y-1 flex-1 min-h-0 overflow-y-auto">
                  {departmentBreakdown.slice(0, 4).map((dept) => {
                    const icon =
                      dept.name.toLowerCase().includes("engineer") ? "💻" :
                      dept.name.toLowerCase().includes("operation") ? "⚙️" :
                      dept.name.toLowerCase().includes("market") ? "📈" : "👥";

                    return (
                      <div
                        key={dept.id}
                        className={`flex items-center justify-between p-1.5 rounded-lg transition-colors text-xs ${
                          isDark
                            ? "bg-white/5 hover:bg-white/10 text-slate-200"
                            : "bg-slate-100 hover:bg-slate-200 text-slate-800"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-xs">{icon}</span>
                          <span className="font-semibold truncate text-[11px]">{dept.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5 font-mono shrink-0">
                          <span className="text-[9px] opacity-75">{dept.taskCount}t</span>
                          <span className="font-bold text-[10px]">{dept.hoursLogged}h</span>
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
            <div className="flex flex-col h-full justify-between">
              <div className="flex items-center justify-between mb-2 shrink-0">
                <div>
                  <h3 className={`text-xs xl:text-sm font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                    Team Workload & Overload Flags
                  </h3>
                  <span className={`text-[9px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    Capacity monitoring (alert at 5+ open)
                  </span>
                </div>
                <div className="text-right">
                  <span className={`text-base xl:text-lg font-black tracking-tight ${
                    (userRoleData.managerMetrics?.overloadedMembersCount || 0) > 0 ? "text-rose-500" : "text-emerald-500"
                  }`}>
                    {userRoleData.managerMetrics?.overloadedMembersCount || 0}
                  </span>
                  <span className={`text-[9px] block -mt-0.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    Overloaded
                  </span>
                </div>
              </div>

              <div className="space-y-1.5 flex-1 min-h-0 overflow-y-auto pr-0.5">
                {teamWorkload.slice(0, 4).map((m) => (
                  <div
                    key={m.userId}
                    className={`flex items-center justify-between p-2 rounded-xl border transition-all text-xs ${
                      m.isOverloaded
                        ? isDark
                          ? "bg-rose-500/10 border-rose-500/30 text-rose-300"
                          : "bg-rose-50 border-rose-200 text-rose-800"
                        : isDark
                        ? "bg-[#1b1c26] border-white/5 text-slate-200"
                        : "bg-slate-50 border-slate-200 text-slate-800"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <img
                        src={m.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${m.name}`}
                        alt={m.name}
                        className="w-6 h-6 rounded-full object-cover shrink-0 border border-white/10"
                      />
                      <div className="min-w-0">
                        <span className="font-bold block truncate text-[11px]">{m.name}</span>
                        <span className="text-[9px] opacity-75 truncate block">
                          {m.jobTitle} • {m.departmentName}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold ${
                        m.isOverloaded
                          ? "bg-rose-500 text-white"
                          : isDark
                          ? "bg-white/10 text-slate-300"
                          : "bg-slate-200 text-slate-700"
                      }`}>
                        {m.openTasks} open
                      </span>
                      <span className="font-mono text-[9px] opacity-80">{m.hoursLogged}h</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ================= EMPLOYEE VIEW: Personal Deadlines ================= */}
          {currentRole === "employee" && (
            <div className="flex flex-col h-full justify-between">
              <div className="flex items-center justify-between mb-2 shrink-0">
                <div>
                  <h3 className={`text-xs xl:text-sm font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                    My Deliverables & Deadlines
                  </h3>
                  <span className={`text-[9px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    Your upcoming task deadlines and progress
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-base xl:text-lg font-black text-emerald-500">
                    {userRoleData.myMetrics?.doneTasks || 0} / {userRoleData.myMetrics?.totalTasks || 0}
                  </span>
                  <span className={`text-[9px] block -mt-0.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    Completed tasks
                  </span>
                </div>
              </div>

              <div className="space-y-1.5 flex-1 min-h-0 overflow-y-auto pr-0.5">
                {topPriorityTickets.length > 0 ? (
                  topPriorityTickets.slice(0, 3).map((t) => (
                    <div
                      key={t.id}
                      onClick={() => setSelectedTaskKeyOrId(t.key || t.id)}
                      className={`flex items-center justify-between p-2 rounded-xl border transition-all text-xs cursor-pointer group ${
                        isDark
                          ? "bg-[#1b1c26] border-white/5 hover:border-white/20 text-slate-200"
                          : "bg-slate-50 border-slate-200 hover:border-indigo-300 text-slate-800"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <CheckSquare className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        <div className="min-w-0">
                          <span className={`font-bold block truncate text-[11px] transition-colors ${
                            isDark ? "group-hover:text-indigo-300" : "group-hover:text-indigo-600"
                          }`}>
                            [{t.key}] {t.title}
                          </span>
                          <span className={`text-[9px] block ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                            Due: {t.dueDate ? new Date(t.dueDate).toLocaleDateString([], { month: "short", day: "numeric" }) : "Sprint end"}
                          </span>
                        </div>
                      </div>

                      <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold capitalize shrink-0 ${
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
                  <div className={`p-3 text-center text-xs italic ${isDark ? "text-slate-500" : "text-slate-400"}`}>
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
