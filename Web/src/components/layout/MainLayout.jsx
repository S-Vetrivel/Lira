import React from "react";
import { Outlet, Navigate, useLocation, useOutlet } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useApp } from "../../context/Appcontext";
import Header from "./Header";
import TaskDrawer from "../task/TaskDrawer";
import CreateTaskModal from "../task/CreateTaskModal";
import CommandPalette from "../search/CommandPalette";
import OfficeChatDrawer from "../chat/OfficeChatDrawer";
import JoinRequestStatus from "../../pages/JoinRequestStatus";
import { AuthLoadingScreen, isPendingOrRestricted } from "../auth/AuthGuards";

export function MainLayout({ children }) {
  const location = useLocation();
  const currentOutlet = useOutlet();
  const {
    user,
    isValidating,
    selectedTaskKeyOrId,
    setSelectedTaskKeyOrId,
    isCreateTaskModalOpen,
    setIsCreateTaskModalOpen,
    isCommandPaletteOpen,
    setIsCommandPaletteOpen,
    isChatOpen,
    setIsChatOpen,
    refreshProjects,
    theme,
  } = useApp();

  const isDark = theme === "dark";

  if (isValidating) {
    return <AuthLoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (isPendingOrRestricted(user)) {
    return <JoinRequestStatus />;
  }

  return (
    <div
      className={`h-screen w-screen flex flex-col overflow-hidden font-sans selection:bg-zinc-700 selection:text-white lira-canvas-bg relative transition-colors duration-150 ${
        isDark ? "text-zinc-100" : "text-slate-900"
      }`}
    >
      {/* Subtle Neutral Charcoal/Silver Ambient Mist behind frosted cards */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div
          className={`absolute -top-32 -left-24 w-[520px] h-[520px] rounded-full blur-3xl ${
            isDark ? "bg-zinc-300/[0.06]" : "bg-slate-400/20"
          }`}
        />
        <div
          className={`absolute -bottom-40 right-[-60px] w-[520px] h-[520px] rounded-full blur-3xl ${
            isDark ? "bg-zinc-400/[0.05]" : "bg-slate-300/25"
          }`}
        />
      </div>

      {/* 100% Full-Width Top Navigation Bar */}
      <Header />

      {/* 100% Full-Width & Full-Height Content Area */}
      <main className="flex-1 w-full min-h-0 flex flex-col overflow-hidden relative z-10">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 7, scale: 0.997 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.997 }}
            transition={{
              duration: 0.16,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="flex-1 w-full h-full min-h-0 flex flex-col overflow-hidden"
          >
            {children ?? currentOutlet}
          </motion.div>
        </AnimatePresence>
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

      {/* Slide-over E2EE Office Chat & File Sharing Drawer (Top-level stacking context) */}
      <OfficeChatDrawer isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
    </div>
  );
}
