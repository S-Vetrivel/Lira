import React from "react";
import KanbanBoard from "../components/kanban/KanbanBoard";
import { useApp } from "../context/Appcontext";

export default function Board() {
  const { setSelectedTaskKeyOrId } = useApp();

  return (
    <div className="flex-1 overflow-hidden">
      <KanbanBoard onSelectTask={(task) => setSelectedTaskKeyOrId(task.key || task._id)} />
    </div>
  );
}
