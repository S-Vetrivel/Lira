// src/components/profile/ProfileSidebar.jsx
import React from "react";
import { ChevronRight } from "lucide-react";

export default function ProfileSidebar({
  tabs,
  activeTabId,
  onTabChange,
  theme,
}) {
  return (
    <nav className="flex lg:flex-col gap-2 overflow-x-auto pb-4 lg:pb-0 hide-scrollbar sticky top-32">
      {tabs.map((tab) => {
        const isActive = activeTabId === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex items-center gap-3 px-5 py-4 rounded-xl transition-all whitespace-nowrap group ${
              isActive
                ? "bg-current text-white dark:text-black font-bold shadow-lg"
                : "hover:bg-black/5 dark:hover:bg-white/5 opacity-60 hover:opacity-100"
            }`}
            style={{
              backgroundColor: isActive ? theme.text : "transparent",
              color: isActive ? theme.bg : theme.text,
            }}
          >
            <tab.icon size={18} strokeWidth={2} />
            <span className="tracking-wide text-sm">{tab.label}</span>
            {isActive && (
              <ChevronRight size={16} className="ml-auto hidden lg:block" />
            )}
          </button>
        );
      })}
    </nav>
  );
}
