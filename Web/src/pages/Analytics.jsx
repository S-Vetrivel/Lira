import React, { useState, useEffect } from "react";
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
} from "lucide-react";

export default function Analytics() {
  const { setSelectedTaskKeyOrId, theme } = useApp();
  const isDark = theme === "dark";

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState("Month");
  const [installTimeFilter, setInstallTimeFilter] = useState("Week");
  const [selectedTaskType, setSelectedTaskType] = useState("All");

  const loadOverview = async () => {
    setLoading(true);
    const res = await getManagerOverview();
    if (res.success) {
      setData(res);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadOverview();
  }, []);

  const { summary, teamWorkload = [], projectProgress = [], overdueTasks = [] } = data || {};

  return (
    <div
      className={`flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 w-full max-w-[1540px] mx-auto transition-colors duration-150 ${
        isDark ? "text-slate-100" : "text-slate-800"
      }`}
    >
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
              <h3
                className={`text-base font-bold tracking-tight ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                Throughput & Velocity
              </h3>
              <div
                className={`flex items-center p-0.5 rounded-full border text-[11px] font-medium ${
                  isDark
                    ? "bg-[#1b1c26] border-white/5"
                    : "bg-slate-100 border-slate-200"
                }`}
              >
                {["Today", "Week", "Month", "Range"].map((period) => (
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

            {/* Metric Numbers */}
            <div className="flex items-baseline gap-6 mb-6">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-3xl sm:text-4xl font-black tracking-tight ${
                      isDark ? "text-white" : "text-slate-900"
                    }`}
                  >
                    {summary?.totalTasks ? (summary.totalTasks * 13240).toLocaleString() : "79,675"}
                  </span>
                  <span className="text-[10px] font-bold bg-emerald-500/15 text-emerald-500 px-2 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-0.5">
                    ↗ 2.4%
                  </span>
                </div>
                <span className={`text-xs font-medium mt-1 block ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  Actions this month
                </span>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${
                      isDark ? "text-white" : "text-slate-900"
                    }`}
                  >
                    {summary?.totalTasks ? summary.totalTasks * 52 : "312"}
                  </span>
                  <span className="text-[10px] font-bold bg-emerald-500/15 text-emerald-500 px-2 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-0.5">
                    ↗ 4.7%
                  </span>
                </div>
                <span className={`text-xs font-medium mt-1 block ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  Story points closed
                </span>
              </div>
            </div>
          </div>

          {/* Glowing Wave Chart */}
          <div className="relative pt-4 w-full">
            {/* Tooltip Tag */}
            <div
              className={`absolute top-0 right-1/3 z-10 flex items-center gap-2 rounded-full px-3 py-1 text-[10px] shadow-lg border ${
                isDark
                  ? "bg-[#222330] border-white/10 text-white"
                  : "bg-white border-slate-200 text-slate-800"
              }`}
            >
              <span className="flex items-center gap-1 text-purple-400 font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                2,894
              </span>
              <span className={isDark ? "text-slate-500" : "text-slate-400"}>•</span>
              <span className="flex items-center gap-1 text-amber-500 font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                287
              </span>
            </div>

            {/* SVG Chart */}
            <svg viewBox="0 0 400 130" className="w-full h-32 sm:h-36 overflow-visible">
              <defs>
                <linearGradient id="purpleGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#818cf8" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#818cf8" stopOpacity="0" />
                </linearGradient>
              </defs>

              <line
                x1="240"
                y1="10"
                x2="240"
                y2="110"
                stroke={isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)"}
                strokeDasharray="3 3"
              />

              {/* Purple Area & Path */}
              <path
                d="M 10,80 Q 50,40 100,75 T 180,95 T 240,40 T 320,60 T 390,70 L 390,120 L 10,120 Z"
                fill="url(#purpleGrad)"
              />
              <path
                d="M 10,80 Q 50,40 100,75 T 180,95 T 240,40 T 320,60 T 390,70"
                fill="none"
                stroke="#818cf8"
                strokeWidth="2.5"
                strokeLinecap="round"
              />

              {/* Yellow/Amber Curve */}
              <path
                d="M 10,95 Q 50,65 100,90 T 180,105 T 240,55 T 320,75 T 390,85"
                fill="none"
                stroke="#f59e0b"
                strokeWidth="2"
                strokeLinecap="round"
              />

              {/* Markers */}
              <circle cx="240" cy="40" r="4.5" fill="#818cf8" stroke={isDark ? "#ffffff" : "#0f172a"} strokeWidth="2" />
              <circle cx="240" cy="55" r="3.5" fill="#f59e0b" stroke={isDark ? "#ffffff" : "#0f172a"} strokeWidth="1.5" />
            </svg>

            {/* X-Axis labels */}
            <div className={`flex items-center justify-between text-[10px] font-mono pt-1 ${isDark ? "text-slate-500" : "text-slate-400"}`}>
              <span>1</span>
              <span>4</span>
              <span>8</span>
              <span>12</span>
              <span>16</span>
              <span className={`font-bold ${isDark ? "text-white" : "text-slate-900"}`}>20</span>
              <span>24</span>
              <span>28</span>
              <span>31</span>
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
            {/* Header: Month dropdown & circular arrow button */}
            <div className="flex items-center justify-between mb-4">
              <button
                className={`flex items-center gap-1.5 text-xs font-bold transition-colors ${
                  isDark ? "text-white hover:text-indigo-400" : "text-slate-900 hover:text-indigo-600"
                }`}
              >
                <span>Current Sprint</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>
              <button
                className={`w-7 h-7 rounded-full border flex items-center justify-center transition-all cursor-pointer ${
                  isDark
                    ? "bg-white/5 hover:bg-white/10 border-white/10 text-slate-300 hover:text-white"
                    : "bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700 hover:text-slate-900"
                }`}
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Calendar Days Matrix */}
            <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] font-mono">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((day) => (
                <div key={day} className={`py-1.5 font-medium ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  {day}
                </div>
              ))}

              {/* Active Sprint highlighted days */}
              <div
                className={`col-span-7 grid grid-cols-7 gap-1.5 p-1 rounded-2xl border my-1 ${
                  isDark
                    ? "bg-indigo-500/10 border-indigo-500/20"
                    : "bg-indigo-50 border-indigo-200"
                }`}
              >
                {[13, 14, 15, 16, 17, 18, 19].map((day) => (
                  <div
                    key={day}
                    className={`py-1.5 rounded-xl font-bold transition-all ${
                      day === 16
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

              {[20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31].map((day) => (
                <div key={day} className={`py-1.5 ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                  {day}
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Card: Total Sprint Valuation */}
          <div
            className={`mt-4 p-4 rounded-2xl border flex items-center justify-between ${
              isDark
                ? "bg-gradient-to-r from-[#1c1d27] to-[#252636] border-white/10"
                : "bg-slate-50 border-slate-200"
            }`}
          >
            <div>
              <span className={`text-[10px] uppercase tracking-wider block font-semibold ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                Sprint Effort Value
              </span>
              <span
                className={`text-2xl font-black tracking-tight ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                $18,434
              </span>
            </div>
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
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
              <h3
                className={`text-base font-bold tracking-tight ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                Effort & Velocity
              </h3>
              <div
                className={`flex items-center p-0.5 rounded-full border text-[11px] font-medium ${
                  isDark
                    ? "bg-[#1b1c26] border-white/5"
                    : "bg-slate-100 border-slate-200"
                }`}
              >
                {["Today", "Week", "Month", "Range"].map((period) => (
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

            {/* Metric + splits */}
            <div className="flex items-center justify-between mb-5">
              <div>
                <span
                  className={`text-3xl sm:text-4xl font-black tracking-tight ${
                    isDark ? "text-white" : "text-slate-900"
                  }`}
                >
                  4,365
                </span>
                <span className={`text-xs font-medium block mt-0.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  Points this sprint
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl border text-xs font-bold ${
                    isDark
                      ? "bg-[#1b1c26] border-white/10 text-white"
                      : "bg-slate-100 border-slate-200 text-slate-900"
                  }`}
                >
                  <span>💻</span>
                  <span>2,876</span>
                </div>
                <div
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl border text-xs font-bold ${
                    isDark
                      ? "bg-[#1b1c26] border-white/10 text-amber-300"
                      : "bg-amber-50 border-amber-200 text-amber-800"
                  }`}
                >
                  <span>⚙️</span>
                  <span>1,489</span>
                </div>
              </div>
            </div>
          </div>

          {/* Hatched Pill Bar Chart */}
          <div className="space-y-2 pt-2">
            <div className="flex items-end justify-between gap-2 h-36 px-1">
              {[
                { day: "Mon", h: "h-20" },
                { day: "Tue", h: "h-24" },
                { day: "Wed", h: "h-16" },
                { day: "Thu", h: "h-22" },
              ].map((b) => (
                <div key={b.day} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                  <div
                    className={`w-full max-w-[28px] ${b.h} rounded-2xl ${
                      isDark ? "bg-[#222330] hatched-bar" : "bg-slate-100 hatched-bar-light border border-slate-200"
                    }`}
                  />
                </div>
              ))}

              {/* Friday (ACTIVE HIGHLIGHT) */}
              <div className="flex-1 flex flex-col items-center gap-1 h-full justify-end relative">
                <span className="absolute -top-3 text-[10px] font-bold bg-indigo-500 text-white px-1.5 py-0.5 rounded-md shadow-md">
                  562
                </span>
                <div className="w-full max-w-[28px] h-20 rounded-2xl bg-indigo-500 shadow-lg shadow-indigo-500/20" />
                <div className="w-full max-w-[28px] h-10 rounded-2xl bg-amber-400 shadow-lg shadow-amber-500/20 relative">
                  <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[9px] font-extrabold text-slate-950">
                    286
                  </span>
                </div>
              </div>

              {[
                { day: "Sat", h: "h-20" },
                { day: "Sun", h: "h-14" },
              ].map((b) => (
                <div key={b.day} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                  <div
                    className={`w-full max-w-[28px] ${b.h} rounded-2xl ${
                      isDark ? "bg-[#222330] hatched-bar" : "bg-slate-100 hatched-bar-light border border-slate-200"
                    }`}
                  />
                </div>
              ))}
            </div>

            {/* X-axis days */}
            <div className={`flex items-center justify-between text-[10px] font-medium px-1 ${isDark ? "text-slate-500" : "text-slate-400"}`}>
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span className={`font-bold ${isDark ? "text-white" : "text-slate-900"}`}>Fri</span>
              <span>Sat</span>
              <span>Sun</span>
            </div>
          </div>
        </div>
      </div>

      {/* ==============================================================
          ROW 2: Top Tickets (List), Priority Bubbles, Global Reach
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
              <h3
                className={`text-base font-bold tracking-tight ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
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
                  <option value="All">All Sprints</option>
                  <option value="High">Urgent Only</option>
                </select>
                <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div className="space-y-3">
              {[
                {
                  id: "ENG-101",
                  title: "User Auth & Security Flow",
                  tag: "Security",
                  effort: "20 pts • 4h",
                  count: "39k",
                  img: "🔐",
                  tagBg: isDark ? "bg-amber-500/20 text-amber-300 border-amber-500/30" : "bg-amber-50 text-amber-700 border-amber-200",
                },
                {
                  id: "OPS-15",
                  title: "Workstation Asset Deployment",
                  tag: "Hardware",
                  effort: "15 pts • 6h",
                  count: "31k",
                  img: "🖥️",
                  tagBg: isDark ? "bg-purple-500/20 text-purple-300 border-purple-500/30" : "bg-purple-50 text-purple-700 border-purple-200",
                },
                {
                  id: "ENG-104",
                  title: "Real-Time Updates Worker",
                  tag: "Core",
                  effort: "12 pts • 2h",
                  count: "27k",
                  img: "⚡",
                  tagBg: isDark ? "bg-blue-500/20 text-blue-300 border-blue-500/30" : "bg-blue-50 text-blue-700 border-blue-200",
                },
              ].map((item) => (
                <div
                  key={item.id}
                  onClick={() => setSelectedTaskKeyOrId(item.id)}
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
                      {item.img}
                    </div>
                    <div className="min-w-0">
                      <h4
                        className={`text-xs font-bold truncate transition-colors ${
                          isDark ? "text-white group-hover:text-indigo-300" : "text-slate-900 group-hover:text-indigo-600"
                        }`}
                      >
                        {item.title}
                      </h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[9px] font-bold px-2 py-0.2 rounded-md border ${item.tagBg}`}>
                          {item.tag}
                        </span>
                        <span className={`text-[10px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>{item.effort}</span>
                      </div>
                    </div>
                  </div>

                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-xl border shrink-0 ${
                      isDark
                        ? "text-slate-300 bg-white/5 border-white/5"
                        : "text-slate-700 bg-white border-slate-200"
                    }`}
                  >
                    {item.count}
                  </span>
                </div>
              ))}
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
              <h3
                className={`text-base font-bold tracking-tight ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                Task Status Breakdown
              </h3>
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

            {/* Overlapping Circular Bubbles */}
            <div className="relative h-52 flex items-center justify-center overflow-hidden">
              {/* Lilac/Indigo Circle (46%) */}
              <div className="absolute left-6 bottom-2 w-28 h-28 rounded-full bg-indigo-500 flex flex-col items-center justify-center text-white font-black shadow-2xl shadow-indigo-500/25 z-10 transition-transform hover:scale-105">
                <span className="text-2xl font-black">46%</span>
                <span className="text-[9px] font-bold uppercase opacity-90">In Progress</span>
              </div>

              {/* Amber Circle (32%) */}
              <div className="absolute right-4 bottom-4 w-24 h-24 rounded-full bg-amber-400 flex flex-col items-center justify-center text-slate-950 font-black shadow-xl shadow-amber-500/25 z-20 transition-transform hover:scale-105">
                <span className="text-xl font-black">32%</span>
                <span className="text-[8px] font-bold text-slate-900 uppercase">Completed</span>
              </div>

              {/* Cyan Circle (18%) */}
              <div className="absolute top-2 right-16 w-20 h-20 rounded-full bg-sky-400 flex flex-col items-center justify-center text-slate-950 font-black shadow-lg shadow-sky-500/25 z-15 transition-transform hover:scale-105">
                <span className="text-lg font-black">18%</span>
                <span className="text-[8px] font-bold text-slate-900 uppercase">In Review</span>
              </div>

              {/* Mint Circle (4%) */}
              <div className="absolute top-10 right-4 w-9 h-9 rounded-full bg-emerald-400 flex items-center justify-center text-slate-950 text-[10px] font-black shadow-md shadow-emerald-500/25 z-30 transition-transform hover:scale-105">
                4%
              </div>
            </div>
          </div>
        </div>

        {/* 6. Company Reach & Regional Hubs (5 Cols) */}
        <div
          className={`lg:col-span-5 p-6 flex flex-col justify-between rounded-3xl border transition-all ${
            isDark
              ? "bg-[#14151c] border-white/10 shadow-2xl"
              : "bg-white border-slate-200/90 shadow-sm"
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3
                className={`text-base font-bold tracking-tight ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                Department Workload
              </h3>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span
                    className={`text-xl sm:text-2xl font-black tracking-tight ${
                      isDark ? "text-white" : "text-slate-900"
                    }`}
                  >
                    231,841
                  </span>
                  <span className={`text-[10px] block -mt-0.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    Hours logged across teams
                  </span>
                </div>
                <button
                  className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all cursor-pointer ${
                    isDark
                      ? "bg-white/5 hover:bg-white/10 border-white/10 text-slate-300 hover:text-white"
                      : "bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700 hover:text-slate-900"
                  }`}
                >
                  <ArrowUpRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Department List & Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
              <div
                className={`relative p-3 rounded-2xl border flex items-center justify-center min-h-[140px] ${
                  isDark ? "bg-[#1b1c26] border-white/5" : "bg-slate-50 border-slate-200"
                }`}
              >
                <div className="text-center space-y-2">
                  <Globe className={`w-12 h-12 mx-auto animate-pulse ${isDark ? "text-indigo-400/40" : "text-indigo-600/40"}`} />
                  <span className={`text-[10px] font-mono block ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    Global Department Sync
                  </span>
                  <span className="text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                    🟢 Live Collaboration
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                {[
                  { flag: "💻", name: "Engineering", val: "43,987" },
                  { flag: "🎨", name: "Design & UX", val: "32,648" },
                  { flag: "📈", name: "Marketing", val: "26,563" },
                  { flag: "⚙️", name: "Operations", val: "21,514" },
                ].map((row) => (
                  <div
                    key={row.name}
                    className={`flex items-center justify-between p-2 rounded-xl transition-colors text-xs ${
                      isDark
                        ? "bg-white/5 hover:bg-white/10 text-slate-200"
                        : "bg-slate-100 hover:bg-slate-200 text-slate-800"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span>{row.flag}</span>
                      <span className="font-semibold">{row.name}</span>
                    </div>
                    <span className="font-mono font-bold">{row.val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
