# Lira — In-House Jira-Style Office & Task Management Web App

Lira is a high-performance in-house office and task management web application built on the MERN stack with **Node.js Cluster mode**, **Redis Pub/Sub**, and **BullMQ queue-based WebSocket updates**.

---

## 🏗️ Architecture & Core Components

```
                ┌──────────────────────────────────────────────┐
                │        Browser Client (React 19 + Vite)      │
                │        http://localhost:5173                 │
                └──────────────────────┬───────────────────────┘
                                       │ (HTTP REST + WebSockets)
                                       ▼
                ┌──────────────────────────────────────────────┐
                │          Node.js Cluster Master              │
                │              (cluster.js)                    │
                └──────────┬────────────────────────┬──────────┘
                           │                        │
             ┌─────────────▼────────────┐┌──────────▼─────────────┐
             │ Node API Worker #1       ││ Node API Worker #2       │
             │ Express 5 + Socket.IO    ││ Express 5 + Socket.IO    │
             │ Port: 5000               ││ Port: 5000               │
             └─────────────┬────────────┘└──────────┬─────────────┘
                           │                        │
                           └───────────┬────────────┘
                                       │ Socket.IO Redis Adapter
                                       ▼
                      ┌─────────────────────────────────┐
                      │    Redis Server (Port: 6379)    │
                      │     Pub/Sub + BullMQ Queues     │
                      └────────────────┬────────────────┘
                                       │
                                       ▼
        ┌─────────────────────────────────────────────────────────────┐
        │            5 Dedicated BullMQ Background Workers            │
        │                       (workers/index.js)                    │
        ├─────────────────────────────────────────────────────────────┤
        │ ⚡ 1. websocketWorker     -> Dispatches WS events via Redis │
        │ 🔔 2. notificationWorker  -> Persists notifications & alerts│
        │ 📝 3. activityWorker      -> Async uneditable audit logging │
        │ 📊 4. taskMetricsWorker   -> Computes project velocities    │
        │ 🧠 5. aiWorker            -> Async Google Gemini 1.5 Flash  │
        └─────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
                      ┌─────────────────────────────────┐
                      │   MongoDB Server (Port: 27017)  │
                      │       Database: sass            │
                      └─────────────────────────────────┘
```

---

## 🔑 Demo Accounts (Pre-Seeded)

Test all three role tiers instantly using the **1-Click Demo Login** buttons on the login screen or via credentials:

| Role | Name | Email | Password | Permissions |
| :--- | :--- | :--- | :--- | :--- |
| **Admin** | Alex Vance | `admin@incuman.com` | `5fJn1aPsaNmn3ei7YnxNW7c9X0su4ZBl` | Full control, user accounts, departments, delete anything |
| **Manager** | Sarah Connor | `sarah@incuman.com` | `password123` | Create projects, assign tasks, manager overview, reports |
| **Employee** | Rahul Sharma | `rahul@incuman.com` | `password123` | Kanban drag-and-drop, My Work, comments, work logs |

---

## ✨ Features Built

1. **Kanban Drag-and-Drop Workspace (`/`)**:
   - 4 Columns: *To Do*, *In Progress*, *In Review*, *Done*.
   - Dragging cards updates MongoDB and queues real-time WebSocket events across all cluster nodes.
   - Quick Filters: *"Only My Tasks"*, *"Due Today"*, *"Overdue"*, filter by team member, priority, and task type.
2. **Slide-Over Task Drawer**:
   - Inline editing for Assignee, Status, Priority, Due Date, and Estimated Hours.
   - **Work Log**: Log effort (`"Worked 2.5 hours today"`) with real-time progress bar.
   - **Subtasks Checklist**: Add, toggle done/undone, delete.
   - **Attachments**: Drag-and-drop file upload with download previews.
   - **Discussion & Comments**: Threaded discussion with `@mention` autocomplete and instant notifications.
   - **Activity Audit Feed**: Uneditable timeline of every single change.
3. **AI Task Assistant (Google Gemini 1.5 Flash)**:
   - Click ✨ **"AI Breakdown (Gemini)"** when creating a task to automatically draft description, subtasks checklist, suggested priority, and estimated hours using `GOOGLE_AI_API_KEY`.
4. **"My Work" Personal Dashboard (`/my-work`)**:
   - Personal task queue categorized into *Overdue*, *Due Today*, *Upcoming*, and *Recently Completed*.
5. **Manager Overview & Analytics (`/analytics`)**:
   - **Team Workload Bar Chart**: Detect overloaded team members (flagged at 5+ tasks).
   - **Project Completion Velocity**: Progress % breakdown.
   - **Company-Wide Overdue Alerts**: Immediate delayed task list.
6. **Staff Directory (`/team`)**:
   - All employees, departments, job titles, active status, and open task count.
   - Admin account creation & deactivation modal.
7. **Projects & Workspaces (`/projects`)**:
   - Auto-generated project sequence keys (`ENG-101`, `OPS-15`).

---

## 🚀 Running the Services

### 1. Start MongoDB
```bash
./start-mongo.sh
```

### 2. Start Redis
```bash
./start-redis.sh
```

### 3. Start Backend in Cluster Mode with BullMQ Workers
```bash
cd Backend
CLUSTER_WORKERS=2 node cluster.js
```

### 4. Start Frontend
```bash
cd Web
npm run dev
```

Visit the application at: **`http://localhost:5173`**
