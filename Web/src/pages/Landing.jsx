import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../context/Appcontext";
import LiraLogo from "../components/common/LiraLogo";
import { isPendingOrRestricted } from "../components/auth/AuthGuards";
import {
  ArrowRight,
  Kanban,
  Building2,
  FolderKanban,
  FileCheck2,
  ShieldCheck,
  Bell,
  MessageSquare,
  Paperclip,
  Sun,
  Moon,
  CheckCircle2,
  Users,
  IndianRupee,
  History,
} from "lucide-react";

const PREVIEW_TABS = [
  {
    id: "board",
    label: "Sprint Board",
    icon: Kanban,
    title: "Structured Kanban & Inline Grid",
    description:
      "Organize tasks with priorities, subtasks, time tracking, and right-side slide-over detail drawers.",
    rows: [
      { key: "OPS-15", title: "Ergonomic monitor arms & displays procurement", tag: "In Progress", badge: "Medium" },
      { key: "ENG-08", title: "Release quarterly permissions & staff sync", tag: "In Review", badge: "High" },
      { key: "ENG-12", title: "Finalize project documentation & shared specs", tag: "Completed", badge: "Standard" },
    ],
  },
  {
    id: "departments",
    label: "Departments",
    icon: Building2,
    title: "Department Staff & Role Management",
    description:
      "Group staff under department leads, reassign members cleanly, and message teams in one click.",
    rows: [
      { key: "ENG", title: "Engineering — Software, Infrastructure & QA", tag: "Lead Assigned", badge: "Dept Chat" },
      { key: "OPS", title: "Operations — Procurement & Office Systems", tag: "Active", badge: "Dept Chat" },
      { key: "HR", title: "Human Resources — Onboarding & Policy", tag: "Active", badge: "Dept Chat" },
    ],
  },
  {
    id: "approvals",
    label: "INR Approvals",
    icon: FileCheck2,
    title: "Multi-Stage Sign-Offs in INR",
    description:
      "Route budgets, vendor payments, and requisitions through trackable manager & finance stages.",
    rows: [
      { key: "REQ-42", title: "Annual cloud infrastructure budget — ₹1,50,000", tag: "Stage 1 Approved", badge: "Finance" },
      { key: "REQ-45", title: "Workstation hardware requisition — ₹78,500", tag: "Pending Review", badge: "Operations" },
      { key: "REQ-46", title: "Team offsite travel & logistics — ₹42,000", tag: "Submitted", badge: "Urgent" },
    ],
  },
  {
    id: "files",
    label: "Files & Audit",
    icon: Paperclip,
    title: "Project File Sharing & Audit Trails",
    description:
      "Share project deliverables inside dedicated workspaces and inspect every action through admin audit logs.",
    rows: [
      { key: "FILE", title: "Architecture_Specs_v3.pdf shared in Engineering", tag: "Team Access", badge: "Shared" },
      { key: "AUDIT", title: "Role & department assignment verified by Admin", tag: "Logged", badge: "Audit Trail" },
      { key: "CHAT", title: "Dedicated project channels & direct messaging", tag: "Real-Time", badge: "Channels" },
    ],
  },
];

const CAPABILITIES = [
  {
    icon: Kanban,
    title: "Boards, Tables & Calendars",
    desc: "Switch seamlessly between drag-and-drop Kanban boards, sortable tables, My Day focus views, and monthly deadline calendars.",
  },
  {
    icon: Users,
    title: "Department Staff Directory",
    desc: "Manage department leads, assign or move staff across teams, track availability (Available, Away, On Leave), and jump straight into DM.",
  },
  {
    icon: FolderKanban,
    title: "Project Workspaces & Shared Files",
    desc: "Every project includes scoped member rosters, persistent file sharing with download & cleanup controls, and a dedicated team chat room.",
  },
  {
    icon: IndianRupee,
    title: "Formal Approval Workflows",
    desc: "Submit budget, vendor, travel, and asset requests formatted cleanly in Indian Rupees (₹) with transparent stage-by-stage sign-off history.",
  },
  {
    icon: History,
    title: "Admin User & Audit Controls",
    desc: "Review pending join requests, inspect or deactivate member accounts, and audit timestamped workspace activity via detail drawers.",
  },
  {
    icon: Bell,
    title: "Unified Alerts & Messaging",
    desc: "Stay aligned with instant notifications for task assignments, comments, mentions, approvals, department changes, and shared files.",
  },
];

export default function Landing() {
  const { user, theme, toggleTheme } = useApp();
  const isDark = theme === "dark";
  const [activePreview, setActivePreview] = useState("board");

  const currentTab =
    PREVIEW_TABS.find((t) => t.id === activePreview) || PREVIEW_TABS[0];

  const isAuthenticatedActive = user && !isPendingOrRestricted(user);
  const isPending = user && isPendingOrRestricted(user);

  const surfaceBg = isDark ? "bg-[#0c0d12] text-slate-100" : "bg-slate-50 text-slate-900";
  const panelBg = isDark ? "bg-[#12131a] border-white/[0.08]" : "bg-white border-slate-200";
  const subtleText = isDark ? "text-slate-400" : "text-slate-600";

  return (
    <div className={`min-h-screen w-full flex flex-col transition-colors duration-150 ${surfaceBg}`}>
      {/* Full-Width Sticky Header */}
      <header
        className={`sticky top-0 z-40 w-full border-b backdrop-blur-md ${
          isDark
            ? "bg-[#0c0d12]/85 border-white/[0.08]"
            : "bg-white/85 border-slate-200"
        }`}
      >
        <div className="w-full px-6 sm:px-10 lg:px-16 h-16 flex items-center justify-between gap-4">
          <Link to="/" className="shrink-0">
            <LiraLogo size="md" showBadge isDark={isDark} />
          </Link>

          <nav className={`hidden md:flex items-center gap-7 text-xs font-semibold ${subtleText}`}>
            <a href="#capabilities" className="hover:text-indigo-400 transition-colors">
              Capabilities
            </a>
            <a href="#preview" className="hover:text-indigo-400 transition-colors">
              Workspace Modules
            </a>
            <a href="#onboarding" className="hover:text-indigo-400 transition-colors">
              Access & Governance
            </a>
          </nav>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                isDark
                  ? "bg-white/[0.04] border-white/[0.08] text-slate-300 hover:bg-white/[0.08]"
                  : "bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>

            {isAuthenticatedActive ? (
              <Link
                to="/board"
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                  isDark
                    ? "bg-white text-slate-950 hover:bg-slate-200"
                    : "bg-slate-900 text-white hover:bg-slate-800"
                }`}
              >
                <span>Open Workspace</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            ) : isPending ? (
              <Link
                to="/join-request"
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                  isDark
                    ? "bg-white text-slate-950 hover:bg-slate-200"
                    : "bg-slate-900 text-white hover:bg-slate-800"
                }`}
              >
                <span>View Application Status</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                    isDark
                      ? "border-white/[0.1] text-slate-200 hover:bg-white/[0.05]"
                      : "border-slate-200 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  Sign In
                </Link>
                <Link
                  to="/signup"
                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                    isDark
                      ? "bg-white text-slate-950 hover:bg-slate-200"
                      : "bg-slate-900 text-white hover:bg-slate-800"
                  }`}
                >
                  <span>Request Access</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Full-Page Content */}
      <main className="flex-1 w-full">
        {/* Hero Band */}
        <section className={`w-full border-b ${isDark ? "border-white/[0.06]" : "border-slate-200"}`}>
          <div className="w-full px-6 sm:px-10 lg:px-16 py-14 lg:py-20 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            {/* Hero Copy */}
            <div className="lg:col-span-6 space-y-6">
              <div
                className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-[11px] font-semibold ${
                  isDark
                    ? "bg-white/[0.04] border-white/[0.08] text-slate-300"
                    : "bg-white border-slate-200 text-slate-700"
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                <span>Unified Workspace & Operations Platform</span>
              </div>

              <h1
                className={`text-4xl sm:text-5xl xl:text-6xl font-extrabold tracking-tight leading-[1.08] ${
                  isDark ? "text-white" : "text-slate-950"
                }`}
              >
                Run teams, projects, and approvals in one clean workspace.
              </h1>

              <p className={`text-sm sm:text-base max-w-2xl leading-relaxed ${subtleText}`}>
                Lira brings sprint boards, department staffing, formal approval workflows,
                shared project files, direct messaging, and administrative audit trails
                together without visual clutter.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                {isAuthenticatedActive ? (
                  <Link
                    to="/board"
                    className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all ${
                      isDark
                        ? "bg-white text-slate-950 hover:bg-slate-200"
                        : "bg-slate-900 text-white hover:bg-slate-800"
                    }`}
                  >
                    <span>Go to Workspace Board</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                ) : (
                  <>
                    <Link
                      to="/login"
                      className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all ${
                        isDark
                          ? "bg-white text-slate-950 hover:bg-slate-200"
                          : "bg-slate-900 text-white hover:bg-slate-800"
                      }`}
                    >
                      <span>Sign In to Workspace</span>
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                    <Link
                      to="/signup"
                      className={`inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold border transition-colors ${
                        isDark
                          ? "bg-white/[0.03] border-white/[0.1] text-slate-200 hover:bg-white/[0.08]"
                          : "bg-white border-slate-200 text-slate-800 hover:bg-slate-100"
                      }`}
                    >
                      <span>Request Team Access</span>
                    </Link>
                  </>
                )}
              </div>

              <div className={`pt-4 border-t grid grid-cols-3 gap-4 max-w-lg ${isDark ? "border-white/[0.06]" : "border-slate-200"}`}>
                <div>
                  <p className={`text-xs font-bold ${isDark ? "text-white" : "text-slate-900"}`}>Side Drawers</p>
                  <p className={`text-[11px] mt-0.5 ${subtleText}`}>Inspect tasks & teams without losing context</p>
                </div>
                <div>
                  <p className={`text-xs font-bold ${isDark ? "text-white" : "text-slate-900"}`}>Role Protected</p>
                  <p className={`text-[11px] mt-0.5 ${subtleText}`}>Admin, Manager & Member access guards</p>
                </div>
                <div>
                  <p className={`text-xs font-bold ${isDark ? "text-white" : "text-slate-900"}`}>Real-Time</p>
                  <p className={`text-[11px] mt-0.5 ${subtleText}`}>Live channels, DMs & event notifications</p>
                </div>
              </div>
            </div>

            {/* Hero Interactive Workspace Preview */}
            <div id="preview" className="lg:col-span-6">
              <div className={`rounded-2xl border overflow-hidden shadow-2xl ${panelBg}`}>
                {/* Preview Chrome Bar */}
                <div
                  className={`px-4 py-3 border-b flex flex-wrap items-center justify-between gap-2 ${
                    isDark ? "border-white/[0.06] bg-[#161822]" : "border-slate-200 bg-slate-100/70"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    {PREVIEW_TABS.map((tab) => {
                      const Icon = tab.icon;
                      const active = activePreview === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setActivePreview(tab.id)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                            active
                              ? isDark
                                ? "bg-white text-slate-950"
                                : "bg-slate-900 text-white"
                              : isDark
                              ? "text-slate-400 hover:text-white hover:bg-white/[0.05]"
                              : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/70"
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          <span>{tab.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  <span className={`text-[10px] font-mono ${subtleText}`}>
                    Interactive Preview
                  </span>
                </div>

                {/* Preview Body */}
                <div className="p-5 sm:p-6 space-y-4">
                  <div>
                    <h2 className={`text-sm font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
                      {currentTab.title}
                    </h2>
                    <p className={`text-xs mt-1 ${subtleText}`}>
                      {currentTab.description}
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    {currentTab.rows.map((row) => (
                      <div
                        key={row.key}
                        className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 ${
                          isDark
                            ? "bg-[#0e0f15] border-white/[0.06]"
                            : "bg-slate-50 border-slate-200"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border shrink-0 ${
                              isDark
                                ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-300"
                                : "bg-indigo-50 border-indigo-200 text-indigo-700"
                            }`}
                          >
                            {row.key}
                          </span>
                          <span className="text-xs font-medium truncate">
                            {row.title}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                              isDark
                                ? "bg-white/[0.04] border-white/[0.08] text-slate-300"
                                : "bg-white border-slate-200 text-slate-600"
                            }`}
                          >
                            {row.tag}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Capabilities Grid */}
        <section id="capabilities" className="w-full px-6 sm:px-10 lg:px-16 py-16 space-y-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-widest text-indigo-400">
                Core Capabilities
              </p>
              <h2 className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${isDark ? "text-white" : "text-slate-950"}`}>
                Built for daily operational execution
              </h2>
            </div>
            <p className={`text-xs sm:text-sm max-w-md ${subtleText}`}>
              Every screen follows a uniform minimal layout with fast keyboard navigation,
              side-drawer editing, and strict permission boundaries.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {CAPABILITIES.map((cap) => {
              const Icon = cap.icon;
              return (
                <div
                  key={cap.title}
                  className={`p-6 rounded-2xl border space-y-3 transition-colors ${panelBg} ${
                    isDark ? "hover:border-white/[0.16]" : "hover:border-slate-300"
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-xl border flex items-center justify-center ${
                      isDark
                        ? "bg-white/[0.04] border-white/[0.08] text-indigo-400"
                        : "bg-indigo-50 border-indigo-200 text-indigo-600"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <h3 className={`text-sm font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
                    {cap.title}
                  </h3>
                  <p className={`text-xs leading-relaxed ${subtleText}`}>
                    {cap.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Onboarding & Access Flow */}
        <section
          id="onboarding"
          className={`w-full border-t px-6 sm:px-10 lg:px-16 py-16 ${
            isDark ? "border-white/[0.06] bg-[#0f1017]" : "border-slate-200 bg-white"
          }`}
        >
          <div className="space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-indigo-400">
                  Access & Security Guards
                </p>
                <h2 className={`text-2xl font-extrabold tracking-tight mt-1 ${isDark ? "text-white" : "text-slate-950"}`}>
                  Verified onboarding from request to active board
                </h2>
              </div>
              <Link
                to="/signup"
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold border transition-colors self-start ${
                  isDark
                    ? "bg-white text-slate-950 hover:bg-slate-200 border-transparent"
                    : "bg-slate-900 text-white hover:bg-slate-800 border-transparent"
                }`}
              >
                <span>Submit Join Request</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {[
                {
                  step: "01",
                  icon: ShieldCheck,
                  title: "Authenticate or Apply",
                  text: "Sign in with Google or work credentials, or submit a join request with your target department and trackable Public ID.",
                },
                {
                  step: "02",
                  icon: CheckCircle2,
                  title: "Admin Approval & Placement",
                  text: "Administrators approve pending applicants, assign departments and roles, and maintain full audit logs of access changes.",
                },
                {
                  step: "03",
                  icon: MessageSquare,
                  title: "Collaborate Immediately",
                  text: "Once approved, protected guards unlock project boards, shared files, direct messaging, and real-time notifications.",
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.step}
                    className={`p-5 rounded-2xl border space-y-2.5 ${
                      isDark ? "bg-[#12131a] border-white/[0.08]" : "bg-slate-50 border-slate-200"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-indigo-400">
                        STEP {item.step}
                      </span>
                      <Icon className="w-4 h-4 text-indigo-400" />
                    </div>
                    <h3 className={`text-sm font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
                      {item.title}
                    </h3>
                    <p className={`text-xs leading-relaxed ${subtleText}`}>{item.text}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      {/* Clean Full-Width Footer */}
      <footer
        className={`w-full border-t px-6 sm:px-10 lg:px-16 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs ${
          isDark ? "border-white/[0.08] text-slate-400" : "border-slate-200 text-slate-500"
        }`}
      >
        <LiraLogo size="sm" isDark={isDark} />
        <div className="flex items-center gap-6 font-medium">
          <Link to="/login" className="hover:text-indigo-400 transition-colors">
            Sign In
          </Link>
          <Link to="/signup" className="hover:text-indigo-400 transition-colors">
            Request Access
          </Link>
          {isAuthenticatedActive && (
            <Link to="/board" className="hover:text-indigo-400 transition-colors">
              Workspace Board
            </Link>
          )}
        </div>
      </footer>
    </div>
  );
}

