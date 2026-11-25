import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../context/Appcontext";
import LiraLogo from "../components/common/LiraLogo";
import { isPendingOrRestricted } from "../components/auth/AuthGuards";
import { getGlassTokens } from "../styles/glassTheme";
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
  const g = getGlassTokens(isDark);
  const [activePreview, setActivePreview] = useState("board");

  const currentTab =
    PREVIEW_TABS.find((t) => t.id === activePreview) || PREVIEW_TABS[0];

  const isAuthenticatedActive = user && !isPendingOrRestricted(user);
  const isPending = user && isPendingOrRestricted(user);

  const surfaceBg = g.canvas;
  const panelBg = g.card;
  const glowPanelBg = g.cardGlow;
  const subtleText = g.muted;

  return (
    <div className={`min-h-screen w-full flex flex-col relative overflow-x-hidden transition-colors duration-150 ${surfaceBg}`}>
      {/* Ambient Neutral Gray Glass Mist */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div
          className={`absolute -top-36 -left-24 w-[580px] h-[580px] rounded-full blur-3xl ${
            isDark ? "bg-zinc-300/[0.06]" : "bg-slate-400/20"
          }`}
        />
        <div
          className={`absolute top-1/3 right-[-120px] w-[500px] h-[500px] rounded-full blur-3xl ${
            isDark ? "bg-zinc-400/[0.05]" : "bg-slate-300/25"
          }`}
        />
      </div>

      {/* Full-Width Sticky Header */}
      <header className={`sticky top-0 z-40 w-full border-b ${g.header}`}>
        <div className="w-full px-6 sm:px-10 lg:px-16 h-[68px] flex items-center justify-between gap-4">
          <Link to="/" className="shrink-0">
            <LiraLogo size="md" showBadge isDark={isDark} />
          </Link>

          <nav className={`hidden md:flex items-center gap-7 text-xs font-semibold ${subtleText}`}>
            <a href="#capabilities" className={`transition-colors ${isDark ? "hover:text-white" : "hover:text-slate-950"}`}>
              Capabilities
            </a>
            <a href="#preview" className={`transition-colors ${isDark ? "hover:text-white" : "hover:text-slate-950"}`}>
              Workspace Modules
            </a>
            <a href="#onboarding" className={`transition-colors ${isDark ? "hover:text-white" : "hover:text-slate-950"}`}>
              Access & Governance
            </a>
          </nav>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-colors cursor-pointer ${g.iconBtn}`}
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4" />}
            </button>

            {isAuthenticatedActive ? (
              <Link
                to="/"
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold ${g.btnPrimary}`}
              >
                <span>Open Dashboard</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            ) : isPending ? (
              <Link
                to="/join-request"
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold ${g.btnPrimary}`}
              >
                <span>View Application Status</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-colors ${g.btnSecondary}`}
                >
                  Sign In
                </Link>
                <Link
                  to="/signup"
                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold ${g.btnPrimary}`}
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
      <main className="flex-1 w-full relative z-10">
        {/* Hero Band */}
        <section className={`w-full border-b ${g.border}`}>
          <div className="w-full px-6 sm:px-10 lg:px-16 py-14 lg:py-20 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            {/* Hero Copy */}
            <div className="lg:col-span-6 space-y-6">
              <div
                className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border backdrop-blur-md text-[11px] font-semibold ${g.badge}`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>Unified Workspace & Operations Platform</span>
              </div>

              <h1
                className={`text-4xl sm:text-5xl xl:text-6xl font-extrabold tracking-tight leading-[1.08] ${g.heading}`}
              >
                Run teams, projects, and{" "}
                <span className={`bg-gradient-to-r bg-clip-text text-transparent ${isDark ? "from-white via-zinc-300 to-zinc-500" : "from-zinc-950 via-zinc-600 to-zinc-400"}`}>
                  approvals
                </span>{" "}
                in one glass workspace.
              </h1>

              <p className={`text-sm sm:text-base max-w-2xl leading-relaxed ${subtleText}`}>
                Lira brings sprint boards, department staffing, formal approval workflows,
                shared project files, direct messaging, and administrative audit trails
                together cleanly.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                {isAuthenticatedActive ? (
                  <Link
                    to="/"
                    className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold ${g.btnPrimary}`}
                  >
                    <span>Go to Dashboard Home</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                ) : (
                  <>
                    <Link
                      to="/login"
                      className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold ${g.btnPrimary}`}
                    >
                      <span>Sign In to Workspace</span>
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                    <Link
                      to="/signup"
                      className={`inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold border transition-colors ${g.btnSecondary}`}
                    >
                      <span>Request Team Access</span>
                    </Link>
                  </>
                )}
              </div>

              <div className={`pt-4 border-t grid grid-cols-3 gap-4 max-w-lg ${g.border}`}>
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
              <div className={`rounded-2xl overflow-hidden ${glowPanelBg}`}>
                {/* Preview Chrome Bar */}
                <div
                  className={`px-4 py-3 border-b flex flex-wrap items-center justify-between gap-2 backdrop-blur-xl ${g.subHeader}`}
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
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                            active ? g.pillActive : g.pillInactive
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
                    <h2 className={`text-sm font-bold ${g.heading}`}>
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
                        className={`p-3.5 rounded-xl border backdrop-blur-md flex items-center justify-between gap-3 ${g.subtleSurface}`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border shrink-0 ${g.badge}`}
                          >
                            {row.key}
                          </span>
                          <span className="text-xs font-medium truncate">
                            {row.title}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${g.badge}`}
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
              <p className={`text-[11px] font-bold uppercase tracking-widest ${g.muted}`}>
                Core Capabilities
              </p>
              <h2 className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${g.heading}`}>
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
                  className="p-6 rounded-2xl lira-glass space-y-3"
                >
                  <div
                    className={`w-9 h-9 rounded-xl border flex items-center justify-center ${g.badge}`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <h3 className={`text-sm font-bold ${g.heading}`}>
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
          className={`w-full border-t px-6 sm:px-10 lg:px-16 py-16 ${g.border}`}
        >
          <div className="space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className={`text-[11px] font-bold uppercase tracking-widest ${g.muted}`}>
                  Access & Security Guards
                </p>
                <h2 className={`text-2xl font-extrabold tracking-tight mt-1 ${g.heading}`}>
                  Verified onboarding from request to active board
                </h2>
              </div>
              <Link
                to="/signup"
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold self-start ${g.btnPrimary}`}
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
                    className="p-5 rounded-2xl lira-glass-glow space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className={`font-mono text-xs font-bold ${g.accentIcon}`}>
                        STEP {item.step}
                      </span>
                      <Icon className={`w-4 h-4 ${g.accentIcon}`} />
                    </div>
                    <h3 className={`text-sm font-bold ${g.heading}`}>
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
        className={`relative z-10 w-full border-t px-6 sm:px-10 lg:px-16 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs ${g.header}`}
      >
        <LiraLogo size="sm" isDark={isDark} />
        <div className="flex items-center gap-6 font-medium">
          <Link to="/login" className="hover:underline transition-colors">
            Sign In
          </Link>
          <Link to="/signup" className="hover:underline transition-colors">
            Request Access
          </Link>
          {isAuthenticatedActive && (
            <Link to="/" className="hover:underline transition-colors">
              Dashboard Home
            </Link>
          )}
        </div>
      </footer>
    </div>
  );
}

