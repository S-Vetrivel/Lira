import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../context/Appcontext";
import {
  Search,
  X,
  Plus,
  Moon,
  Sun,
  Kanban,
  BarChart2,
  CheckSquare,
  Users,
  FolderTree,
  ArrowRight,
  Sparkles,
  Command,
  CornerDownLeft,
  FileText,
  UserCheck,
  ShieldAlert,
  Sliders,
} from "lucide-react";

export default function CommandPalette({ isOpen, onClose }) {
  const navigate = useNavigate();
  const {
    theme,
    toggleTheme,
    projects,
    activeProject,
    setActiveProject,
    teamMembers,
    setIsCreateTaskModalOpen,
    setSelectedTaskKeyOrId,
  } = useApp();

  const isDark = theme === "dark";
  const [query, setQuery] = useState("");
  const [filterType, setFilterType] = useState("all"); // 'all', 'actions', 'projects', 'team'
  const [selectedIndex, setSelectedIndex] = useState(0);

  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Global keyboard shortcuts (Cmd+K, Ctrl+K, Escape)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (isOpen) onClose();
      }
      if (e.key === "Escape" && isOpen) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Build searchable items
  const allItems = useMemo(() => {
    const items = [];

    // 1. Actions & Navigation
    items.push(
      {
        id: "action-new-task",
        category: "actions",
        title: "Create New Task",
        subtitle: "Open task creation dialog",
        icon: Plus,
        shortcut: "N",
        badge: "Action",
        action: () => {
          onClose();
          setIsCreateTaskModalOpen(true);
        },
      },
      {
        id: "action-toggle-theme",
        category: "actions",
        title: isDark ? "Switch to Light Theme" : "Switch to Dark Theme",
        subtitle: isDark ? "Activate crisp white dashboard layout" : "Activate obsidian luxury dark layout",
        icon: isDark ? Sun : Moon,
        shortcut: "T",
        badge: "Theme",
        action: () => {
          toggleTheme();
          onClose();
        },
      },
      {
        id: "nav-board",
        category: "actions",
        title: "Go to Sprint Board",
        subtitle: "Task board with drag-and-drop columns",
        icon: Kanban,
        shortcut: "G B",
        badge: "Navigate",
        action: () => {
          navigate("/");
          onClose();
        },
      },
      {
        id: "nav-analytics",
        category: "actions",
        title: "Go to Analytics & Velocity",
        subtitle: "Role-based executive, lead, or personal metrics",
        icon: BarChart2,
        shortcut: "G A",
        badge: "Navigate",
        action: () => {
          navigate("/analytics");
          onClose();
        },
      },
      {
        id: "nav-my-work",
        category: "actions",
        title: "Go to My Work Hub",
        subtitle: "Your assigned tasks, due today, and overdue alerts",
        icon: CheckSquare,
        shortcut: "G W",
        badge: "Navigate",
        action: () => {
          navigate("/my-work");
          onClose();
        },
      },
      {
        id: "nav-team",
        category: "actions",
        title: "Go to Team Directory",
        subtitle: "Staff personnel, departments, and workload meters",
        icon: Users,
        shortcut: "G T",
        badge: "Navigate",
        action: () => {
          navigate("/team");
          onClose();
        },
      },
      {
        id: "nav-projects",
        category: "actions",
        title: "Go to Workspaces & Projects",
        subtitle: "All team boards, project sequences, and departments",
        icon: FolderTree,
        shortcut: "G P",
        badge: "Navigate",
        action: () => {
          navigate("/projects");
          onClose();
        },
      }
    );

    // 3. Projects
    projects.forEach((p) => {
      items.push({
        id: `project-${p._id}`,
        category: "projects",
        title: `[${p.prefix}] ${p.name}`,
        subtitle: p.description || "Project Workspace",
        icon: FolderTree,
        badge: p.prefix,
        action: () => {
          setActiveProject(p);
          navigate("/");
          onClose();
        },
      });
    });

    // 4. Team Members
    teamMembers.forEach((m) => {
      items.push({
        id: `team-${m._id}`,
        category: "team",
        title: m.fullname,
        subtitle: `${m.jobTitle || "Member"} • ${m.departmentName || "General"} (${m.email})`,
        avatar: m.avatar,
        badge: m.role?.toUpperCase(),
        action: () => {
          navigate("/team");
          onClose();
        },
      });
    });

    return items;
  }, [
    projects,
    teamMembers,
    isDark,
    toggleTheme,
    navigate,
    onClose,
    setIsCreateTaskModalOpen,
    setActiveProject,
  ]);

  // Filter items based on query and filter tab
  const filteredItems = useMemo(() => {
    let result = allItems;

    if (filterType !== "all") {
      result = result.filter((item) => item.category === filterType);
    }

    if (query.trim()) {
      const q = query.toLowerCase().trim();
      result = result.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.subtitle?.toLowerCase().includes(q) ||
          item.badge?.toLowerCase().includes(q)
      );
    }

    return result;
  }, [allItems, filterType, query]);

  // Keyboard navigation within list
  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredItems.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev <= 0 ? Math.max(0, filteredItems.length - 1) : prev - 1
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        filteredItems[selectedIndex].action();
      } else if (query.trim()) {
        setSelectedTaskKeyOrId(query.trim());
        onClose();
      }
    }
  };

  // Auto-scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.children[selectedIndex];
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 overflow-hidden">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/70 backdrop-blur-md transition-opacity animate-in fade-in duration-150"
      />

      {/* Spotlight Command Modal */}
      <div
        className={`relative w-full max-w-2xl rounded-3xl shadow-2xl border overflow-hidden z-10 animate-in zoom-in-95 duration-150 flex flex-col max-h-[80vh] ${
          isDark
            ? "bg-[#13141d]/95 backdrop-blur-2xl border-white/10 text-white"
            : "bg-white/95 backdrop-blur-2xl border-slate-200 text-slate-900"
        }`}
      >
        {/* Search Input Bar */}
        <div
          className={`flex items-center gap-3 px-5 py-4 border-b shrink-0 ${
            isDark ? "border-white/10 bg-[#181926]/60" : "border-slate-200 bg-slate-50/80"
          }`}
        >
          <Search className={`w-5 h-5 shrink-0 ${isDark ? "text-indigo-400" : "text-indigo-600"}`} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search tasks, projects, people, or commands... (e.g. ENG-101, New Task, Rahul)"
            className={`flex-1 bg-transparent border-none text-sm font-medium focus:outline-none placeholder:text-xs ${
              isDark ? "text-white placeholder-slate-500" : "text-slate-900 placeholder-slate-400"
            }`}
          />
          {query ? (
            <button
              onClick={() => setQuery("")}
              className={`p-1 rounded-lg ${isDark ? "text-slate-400 hover:text-white" : "text-slate-400 hover:text-slate-700"}`}
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <div className="flex items-center gap-1.5 shrink-0">
              <span
                className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md border ${
                  isDark
                    ? "bg-white/5 border-white/10 text-slate-400"
                    : "bg-slate-200/60 border-slate-300 text-slate-600"
                }`}
              >
                ESC to close
              </span>
            </div>
          )}
        </div>

        {/* Category Tabs */}
        <div
          className={`flex items-center gap-1.5 px-5 py-2.5 border-b text-xs overflow-x-auto shrink-0 select-none ${
            isDark ? "border-white/10 bg-[#161722]/40" : "border-slate-100 bg-slate-50/50"
          }`}
        >
          {[
            { id: "all", label: "All" },
            { id: "actions", label: "Actions" },
            { id: "projects", label: "Projects" },
            { id: "team", label: "Team" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setFilterType(tab.id);
                setSelectedIndex(0);
              }}
              className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer ${
                filterType === tab.id
                  ? isDark
                    ? "bg-white text-slate-950 font-bold shadow-xs"
                    : "bg-slate-900 text-white font-bold shadow-xs"
                  : isDark
                  ? "text-slate-400 hover:text-white"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Results List */}
        <div ref={listRef} className="flex-1 overflow-y-auto p-2.5 space-y-1 min-h-[180px]">
          {filteredItems.map((item, idx) => {
            const isSelected = idx === selectedIndex;
            const Icon = item.icon || FileText;

            return (
              <div
                key={item.id}
                onClick={() => item.action()}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`flex items-center justify-between p-3 rounded-2xl cursor-pointer transition-all border ${
                  isSelected
                    ? isDark
                      ? "bg-indigo-600/20 border-indigo-500/40 text-white shadow-sm"
                      : "bg-indigo-50 border-indigo-200 text-indigo-950 shadow-xs"
                    : isDark
                    ? "border-transparent text-slate-300 hover:bg-white/5"
                    : "border-transparent text-slate-700 hover:bg-slate-100"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {item.avatar ? (
                    <img
                      src={item.avatar}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="w-8 h-8 rounded-full object-cover shrink-0 border border-white/10"
                    />
                  ) : (
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
                        isSelected
                          ? "bg-indigo-600 text-white border-indigo-500"
                          : isDark
                          ? "bg-white/5 border-white/10 text-indigo-400"
                          : "bg-white border-slate-200 text-indigo-600"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                  )}

                  <div className="min-w-0">
                    <p
                      className={`text-xs font-bold truncate ${
                        isSelected
                          ? isDark
                            ? "text-white"
                            : "text-indigo-950"
                          : isDark
                          ? "text-slate-200"
                          : "text-slate-900"
                      }`}
                    >
                      {item.title}
                    </p>
                    {item.subtitle && (
                      <p
                        className={`text-[11px] truncate ${
                          isDark ? "text-slate-400" : "text-slate-500"
                        }`}
                      >
                        {item.subtitle}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 ml-3">
                  {item.badge && (
                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                        isDark
                          ? "bg-white/5 border-white/10 text-slate-400"
                          : "bg-slate-100 border-slate-200 text-slate-600"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                  {item.shortcut && (
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-md border hidden sm:inline-block ${
                        isDark
                          ? "bg-white/5 border-white/10 text-slate-400"
                          : "bg-slate-100 border-slate-200 text-slate-600"
                      }`}
                    >
                      {item.shortcut}
                    </span>
                  )}
                  <CornerDownLeft
                    className={`w-3.5 h-3.5 transition-opacity ${
                      isSelected ? "opacity-100 text-indigo-500" : "opacity-0"
                    }`}
                  />
                </div>
              </div>
            );
          })}

          {filteredItems.length === 0 && (
            <div className="py-12 text-center space-y-2">
              <Search className="w-8 h-8 mx-auto text-slate-500/50" />
              <p className={`text-xs font-semibold ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                No matching results for "{query}"
              </p>
              <p className="text-[11px] text-slate-500">
                Press Enter to look up ticket key directly or type another query.
              </p>
            </div>
          )}
        </div>

        {/* Footer Navigation Bar */}
        <div
          className={`px-5 py-2.5 border-t flex items-center justify-between text-[11px] shrink-0 select-none ${
            isDark ? "border-white/10 bg-[#161722]/60 text-slate-400" : "border-slate-200 bg-slate-50 text-slate-500"
          }`}
        >
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className={`px-1.5 py-0.5 rounded border text-[10px] font-mono ${isDark ? "bg-white/5 border-white/10 text-slate-300" : "bg-white border-slate-200 text-slate-700"}`}>
                ↑
              </kbd>
              <kbd className={`px-1.5 py-0.5 rounded border text-[10px] font-mono ${isDark ? "bg-white/5 border-white/10 text-slate-300" : "bg-white border-slate-200 text-slate-700"}`}>
                ↓
              </kbd>
              <span className="hidden sm:inline">Navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className={`px-1.5 py-0.5 rounded border text-[10px] font-mono ${isDark ? "bg-white/5 border-white/10 text-slate-300" : "bg-white border-slate-200 text-slate-700"}`}>
                ↵
              </kbd>
              <span className="hidden sm:inline">Select</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden sm:inline">Quick Search</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          </div>
        </div>
      </div>
    </div>
  );
}
