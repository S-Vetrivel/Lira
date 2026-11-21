import React from "react";
import { NavLink } from "react-router-dom";
import { useApp } from "../../context/Appcontext";
import {
  Kanban,
  CheckSquare,
  BarChart3,
  Users,
  FolderTree,
  Zap,
  Layers,
  ArrowUpRight,
  Table,
  Calendar,
  FileCheck2,
} from "lucide-react";

export default function Sidebar() {
  const { user, activeProject, handleDemoLogin } = useApp();

  const navItems = [
    {
      to: "/",
      label: "Kanban Board",
      icon: Kanban,
      roles: ["admin", "manager", "employee"],
    },
    {
      to: "/table",
      label: "Grid / Spreadsheet",
      icon: Table,
      roles: ["admin", "manager", "employee"],
    },
    {
      to: "/calendar",
      label: "Schedule & Deadlines",
      icon: Calendar,
      roles: ["admin", "manager", "employee"],
    },
    {
      to: "/requests",
      label: "Requests & Sign-Offs",
      icon: FileCheck2,
      roles: ["admin", "manager", "employee"],
    },
    {
      to: "/my-work",
      label: "My Day Cockpit",
      icon: CheckSquare,
      roles: ["admin", "manager", "employee"],
    },
    {
      to: "/analytics",
      label: "Workload Overview",
      icon: BarChart3,
      roles: ["admin", "manager"],
      badge: user?.role === "employee" ? "Lead only" : null,
    },
    {
      to: "/team",
      label: "Team Directory",
      icon: Users,
      roles: ["admin", "manager", "employee"],
    },
    {
      to: "/projects",
      label: "Projects & Teams",
      icon: FolderTree,
      roles: ["admin", "manager", "employee"],
    },
  ];

  return (
    <aside className="w-64 bg-slate-950 text-slate-300 flex flex-col justify-between shrink-0 border-r border-slate-800/80 z-20 hidden md:flex">
      {/* Top Navigation */}
      <div className="p-4 space-y-6">
        {/* Workspace Context Card */}
        <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold text-xs shrink-0">
              {activeProject?.prefix || "ENG"}
            </div>
            <div className="min-w-0">
              <h4 className="text-xs font-bold text-white tracking-wide truncate">
                {activeProject?.name || "Lira Workspace"}
              </h4>
              <span className="text-[10px] text-slate-400 block font-mono">
                {activeProject?.prefix ? `${activeProject.prefix}-SEQ` : "Incuman Core"}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation list */}
        <nav className="space-y-1.5">
          <div className="px-3 py-1 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">
            Workspace Views
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isRestricted = !item.roles.includes(user?.role);

            if (isRestricted) return null;

            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all group ${
                    isActive
                      ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25"
                      : "text-slate-400 hover:text-white hover:bg-slate-900"
                  }`
                }
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </div>
                {item.badge ? (
                  <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono">
                    {item.badge}
                  </span>
                ) : (
                  <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Bottom: Fast Demo Role Switcher */}
      <div className="p-4 border-t border-slate-900 bg-slate-950/80 space-y-2.5">
        <div className="flex items-center justify-between text-[11px] font-bold text-slate-400">
          <span className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Fast Role Switch:</span>
          </span>
          <span className="text-[10px] uppercase font-mono text-blue-400">{user?.role}</span>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          <button
            onClick={() => handleDemoLogin("admin")}
            className={`py-2 px-1.5 rounded-xl text-[11px] font-extrabold transition-all border text-center cursor-pointer ${
              user?.role === "admin"
                ? "bg-purple-600 text-white border-purple-500 shadow-sm"
                : "bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800"
            }`}
            title="Switch to Admin Alex Vance"
          >
            👑 Admin
          </button>

          <button
            onClick={() => handleDemoLogin("manager")}
            className={`py-2 px-1.5 rounded-xl text-[11px] font-extrabold transition-all border text-center cursor-pointer ${
              user?.role === "manager"
                ? "bg-blue-600 text-white border-blue-500 shadow-sm"
                : "bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800"
            }`}
            title="Switch to Manager Sarah Connor"
          >
            👔 Lead
          </button>

          <button
            onClick={() => handleDemoLogin("employee")}
            className={`py-2 px-1.5 rounded-xl text-[11px] font-extrabold transition-all border text-center cursor-pointer ${
              user?.role === "employee"
                ? "bg-emerald-600 text-white border-emerald-500 shadow-sm"
                : "bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800"
            }`}
            title="Switch to Employee Rahul Sharma"
          >
            👨‍💻 Dev
          </button>
        </div>
      </div>
    </aside>
  );
}
