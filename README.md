# Lira — In-House Office, Task Management & Real-Time Collaboration Platform

Lira is an enterprise-grade, in-house office and task management workspace built on the MERN stack (**MongoDB**, **Express 5**, **React 19 + Vite**, **Node.js**) with **Socket.IO WebSockets**, **Redis Pub/Sub**, **MinIO Object Storage**, **Google OAuth 2.0**, and **10 Unified BullMQ Background Workers**.

---

## 🏗️ Architecture & Core Components

```
                ┌──────────────────────────────────────────────┐
                │        Browser Client (React 19 + Vite)      │
                │            http://localhost:5173             │
                └──────────────────────┬───────────────────────┘
                                       │ (HTTP REST /v3 + Socket.IO WS)
                                       ▼
                ┌──────────────────────────────────────────────┐
                │          Backend API Server (Port 4000)      │
                │       Express 5 + Passport + Socket.IO       │
                └──────────────────────┬───────────────────────┘
                                       │ Socket.IO Redis Adapter
                                       ▼
                ┌──────────────────────────────────────────────┐
                │          Redis Server (Port 6379)            │
                │           Pub/Sub + BullMQ Queues            │
                └──────────────────────┬───────────────────────┘
                                       │
                                       ▼
        ┌─────────────────────────────────────────────────────────────┐
        │           10 Unified BullMQ Background Workers              │
        │                    (Backend/workers/index.js)               │
        ├─────────────────────────────────────────────────────────────┤
        │ ⚡ 1. websocketWorker        -> Real-time WS broadcasts     │
        │ 🔔 2. notificationWorker     -> In-app & push notifications │
        │ 📝 3. activityWorker         -> Uneditable audit logging    │
        │ 📊 4. taskMetricsWorker      -> Velocity & effort metrics   │
        │ 🧠 5. aiWorker               -> Google Gemini AI breakdown  │
        │ 📁 6. fileSharingWorker      -> Storage & file verification │
        │ ⏰ 7. routineSchedulerWorker -> Recurring tasks & deadlines │
        │ 🖼️  8. mediaWorker            -> Sharp WebP & MinIO pipeline │
        │ 📦 9. orderWorker            -> Commerce & order processing │
        │ 📧 10. emailWorker           -> Custom SMTP offline &       │
        │                                 approval email alerts       │
        └──────────────────────┬───────────────────────┬──────────────┘
                               │                       │
                               ▼                       ▼
              ┌─────────────────────────┐   ┌─────────────────────────┐
              │  MongoDB (Port 27017)   │   │   MinIO S3 (Port 9000)  │
              │     Database: sass      │   │     Bucket: icuman      │
              └─────────────────────────┘   └─────────────────────────┘
```

---

## ✨ Features & Capabilities

### 1. Executive & Team Dashboard (`/`)
- **Full-Width, Zero-Scroll Landscape Layout**: Automatically fits all KPIs, throughput curves, monthly deadline calendar, sprint valuation, weekly burnup, priority focus queue, status distribution, and department capacity in a single landscape viewport without outer page scrolling.
- **Role-Adaptive Views**: Adapts metrics for **Admin (Executive)**, **Manager (Lead)**, and **Employee (Contributor)**.

### 2. Kanban Drag-and-Drop Board (`/board`), Grid (`/table`), & Calendar (`/calendar`)
- **4-Stage Kanban**: *To Do*, *In Progress*, *In Review*, and *Done* with live WebSocket synchronization across all connected clients.
- **Quick Filters**: *My Tasks*, *Due Today*, *Overdue*, plus assignee & priority filters.
- **Slide-Over Task Drawer**:
  - Inline Assignee, Status, Priority, Due Date, and Estimated Hours editing.
  - Effort **Work Logs** with progress bar tracking.
  - **Subtasks Checklist**, file **Attachments** (streamed via MinIO), threaded **Comments** with `@mentions`, and an uneditable **Activity Audit Feed**.

### 3. AI Task Assistant (Google Gemini)
- Click **AI Breakdown** when creating a task to auto-generate descriptions, subtasks, priority suggestions, and hour estimates using `GOOGLE_AI_API_KEY`.

### 4. Multi-Stage Requests & Approval Workflows (`/requests`)
- Submit operational/procurement requests (`REQ-101`, etc.) with multi-stage sign-offs (Department Review -> Final Sign-off).
- Approved requests automatically create linked Kanban tasks.
- Triggers real-time WebSocket updates, in-app notifications, and **SMTP approval emails**.

### 5. WebSocket-Based E2EE Office Chat & File Sharing
- **Real-Time WebSocket Messaging**: Send and receive messages directly over Socket.IO (`chat:send` / `chat:message`) with typing indicators, online presence tracking, and REST fallback.
- **Client-Side AES-256-GCM Encryption**: Messages are encrypted in the browser before transmission.
- **Department Channels & Direct Messages**: Switch between `#operations`, `#engineering`, `#people-culture`, `#finance`, or 1-on-1 DMs with searchable team directory and Public IDs (`EMP-XXXX`).
- **Smart Alert Dots & Unread Badges**: Header chat and notification alert dots only appear when unread messages or notifications are actually received, and clear automatically when read.
- **Local Peer Discovery & Chunked File Hub**: Direct WebRTC peer signaling and chunked file uploads backed by MinIO.

### 6. Custom SMTP Email Worker (`emailWorker.js`)
- Powered by BullMQ (`email-notification-queue`) and `nodemailer`:
  - **Offline Chat Alerts**: Automatically emails a user if they receive a direct message while offline.
  - **Task & Request Approvals**: Sends email notifications to approvers when a request is submitted or a task moves to *In Review*, and emails the requester when approved or declined.
  - **Task Assignments**: Notifies assignees via email when assigned a new task.
- **Optional / Bring-Your-Own SMTP**: If `SMTP_HOST`, `SMTP_USER`, and `SMTP_PASS` are not set in `Backend/.env`, the worker skips sending gracefully without errors.

### 7. Authentication, Join Requests & Auth Guards
- **Google OAuth 2.0** (`Continue with Google`) and Email/Password authentication (`/v3/auth/*`).
- **Join Request Workflow (`/join-request`)**: New workspace applicants enter a `pending_approval` queue with real-time admin notifications & Web Push alerts until approved.
- **Strict Route Guards**: `ProtectedRoute`, `PublicOnlyRoute`, and `JoinRequestGuard` enforce session and approval state cleanly.

### 8. Team Directory (`/team`), My Day (`/my-work`), & Workspaces (`/projects`)
- Manage staff roles, departments, public employee IDs, personal daily queues, and workspace projects (`OPS`, `ENG`, etc.).
- Global Spotlight Command Palette (`⌘K` / `Ctrl+K`) for instant navigation and task search.

---

## ⚙️ Environment Configuration (`Backend/.env`)

```env
PORT=4000
MONGO_DB=mongodb://127.0.0.1:27017/sass
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:4000

# Google OAuth 2.0
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:4000/v3/auth/google/callback

# Unified Redis (BullMQ & Socket.IO)
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_URL=redis://127.0.0.1:6379

# MinIO Object Storage
MINIO_ENDPOINT=127.0.0.1
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=admin
MINIO_SECRET_KEY=password123
MINIO_BUCKET_NAME=icuman
USE_MINIO=true

# Custom SMTP (Optional - leave commented to disable email dispatch)
# SMTP_HOST=smtp.yourprovider.com
# SMTP_PORT=587
# SMTP_SECURE=false
# SMTP_USER=your-smtp-user@domain.com
# SMTP_PASS=your-smtp-password
# SMTP_FROM="Lira Workspace" <your-smtp-user@domain.com>
```

---

## 🚀 Usage & Running Locally

### 1. Start Backing Services (MongoDB, Redis, MinIO)
```bash
./start-mongo.sh
./start-redis.sh
# Ensure MinIO is running on port 9000
```

### 2. Start Backend API & Unified Workers (Port `4000`)
```bash
cd Backend
npm install
npm run dev
```
- API Base URL: `http://localhost:4000/v3`
- Health Check (MongoDB, MinIO & all 10 BullMQ queues): `GET http://localhost:4000/v3/health`

### 3. Start Frontend (Port `5173`)
```bash
cd Web
npm install
npm run dev
```
- Open `http://localhost:5173` in your browser.
