import React from "react";
import { Outlet, Navigate } from "react-router-dom";
import { useApp } from "../../context/Appcontext";
import Header from "./Header";
import TaskDrawer from "../task/TaskDrawer";
import CreateTaskModal from "../task/CreateTaskModal";
import CommandPalette from "../search/CommandPalette";

export function MainLayout() {
  const {
    user,
    isValidating,
    selectedTaskKeyOrId,
    setSelectedTaskKeyOrId,
    isCreateTaskModalOpen,
    setIsCreateTaskModalOpen,
    isCommandPaletteOpen,
    setIsCommandPaletteOpen,
    refreshProjects,
    theme,
  } = useApp();

  const isDark = theme === "dark";

  if (isValidating) {
    return (
      <div className={`h-screen w-screen flex items-center justify-center ${
        isDark ? "bg-[#0c0d12] text-white" : "bg-slate-50 text-slate-900"
      }`}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white font-black text-xl shadow-xl shadow-purple-500/20 animate-pulse">
            L
          </div>
          <p className="text-xs text-slate-400 font-medium">Loading workspace...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div
      className={`h-screen w-screen flex flex-col overflow-hidden font-sans selection:bg-purple-600 selection:text-white transition-colors duration-150 ${
        isDark
          ? "bg-[#0c0d12] text-slate-100"
          : "bg-slate-50 text-slate-900"
      }`}
    >
      {/* 100% Full-Width Top Navigation Bar */}
      <Header />

      {/* 100% Full-Width & Full-Height Content Area (Zero Gaps, Zero Overflows) */}
      <main className="flex-1 w-full min-h-0 flex flex-col overflow-hidden">
        <Outlet />
      </main>

      {/* Slide-over Task Detail Drawer */}
      {selectedTaskKeyOrId && (
        <TaskDrawer
          taskKeyOrId={selectedTaskKeyOrId}
          onClose={() => setSelectedTaskKeyOrId(null)}
          onTaskUpdated={() => refreshProjects()}
        />
      )}

      {/* Global Create Task Modal */}
      <CreateTaskModal
        isOpen={isCreateTaskModalOpen}
        onClose={() => setIsCreateTaskModalOpen(false)}
        onCreated={() => refreshProjects()}
      />

      {/* Global Raycast/Linear Spotlight Command Palette */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
      />
    </div>
  );
}
