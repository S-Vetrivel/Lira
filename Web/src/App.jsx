import { Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
import { Toaster } from "react-hot-toast";
import { useApp } from "./context/Appcontext";
import { ModalProvider } from "./context/ModalContext";
import AppUpdaterModal from "./components/common/AppUpdaterModal";
import { initAppUpdater } from "./services/appUpdater";
import { MainLayout } from "./components/layout/MainLayout";
import {
  ProtectedRoute,
  PublicOnlyRoute,
  JoinRequestGuard,
  ModuleRoute,
  getFirstAllowedRoute,
  AuthLoadingScreen,
  isPendingOrRestricted,
} from "./components/auth/AuthGuards";

// PAGES
import Landing from "./pages/Landing";
import Board from "./pages/Board";
import TableView from "./pages/TableView";
import CalendarView from "./pages/CalendarView";
import Requests from "./pages/Requests";
import MyWork from "./pages/MyWork";
import Analytics from "./pages/Analytics";
import Team from "./pages/Team";
import Projects from "./pages/Projects";
import Roles from "./pages/Roles";
import AuditLogs from "./pages/AuditLogs";
import BroadcastConsole from "./pages/BroadcastConsole";
import Profile from "./pages/Profile";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import JoinRequestStatus from "./pages/JoinRequestStatus";
import { RouteSeoSync } from "./utils/routeSeo";

/**
 * Root `/` entry guard:
 * - Shows public Lira Landing page to unauthenticated visitors
 * - Routes pending/declined applicants to `/join-request`
 * - Renders the main Workspace Dashboard (Overview) for approved authenticated members
 */
function HomeEntry() {
  const { user, isValidating, isSuperAdmin, hasModule } = useApp();

  if (isValidating) {
    return <AuthLoadingScreen />;
  }

  if (!user) {
    return <Landing />;
  }

  if (isPendingOrRestricted(user)) {
    return <Navigate to="/join-request" replace />;
  }

  if (!isSuperAdmin && !hasModule("dashboard")) {
    const fallback = getFirstAllowedRoute({ isSuperAdmin, hasModule });
    return <Navigate to={fallback} replace />;
  }

  return (
    <MainLayout>
      <Analytics />
    </MainLayout>
  );
}

function App() {
  useEffect(() => {
    initAppUpdater();
  }, []);

  return (
    <ModalProvider>
      <RouteSeoSync />
      <AppUpdaterModal />
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: "#18181b",
            color: "#fafafa",
            borderRadius: "0.875rem",
            border: "1px solid rgba(255,255,255,0.12)",
            fontSize: "0.875rem",
          },
          success: {
            duration: 3500,
            iconTheme: {
              primary: "#e4e4e7",
              secondary: "#18181b",
            },
          },
        }}
      />

      <Routes>
        {/* Adaptive Root Entry (Landing when logged out, Dashboard when active) */}
        <Route path="/" element={<HomeEntry />} />

        {/* Dedicated Public Overview / Marketing Routes */}
        <Route path="/welcome" element={<Landing />} />
        <Route path="/landing" element={<Landing />} />

        {/* Public-Only Auth Routes (Redirects away if already authenticated) */}
        <Route element={<PublicOnlyRoute />}>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
        </Route>

        {/* Join Request Tracking Guard */}
        <Route element={<JoinRequestGuard />}>
          <Route path="/join-request" element={<JoinRequestStatus />} />
        </Route>

        {/* Authenticated Workspace Routes (Must be active approved member + Module RBAC) */}
        <Route element={<ProtectedRoute />}>
          <Route element={<MainLayout />}>
            <Route element={<ModuleRoute moduleKeys={["dashboard"]} />}>
              <Route path="/dashboard" element={<Analytics />} />
              <Route path="/analytics" element={<Analytics />} />
            </Route>
            <Route element={<ModuleRoute moduleKeys={["board"]} />}>
              <Route path="/board" element={<Board />} />
              <Route path="/table" element={<TableView />} />
              <Route path="/calendar" element={<CalendarView />} />
            </Route>
            <Route element={<ModuleRoute moduleKeys={["requests"]} />}>
              <Route path="/requests" element={<Requests />} />
            </Route>
            <Route element={<ModuleRoute moduleKeys={["tasks"]} />}>
              <Route path="/my-work" element={<MyWork />} />
            </Route>
            <Route element={<ModuleRoute moduleKeys={["team"]} />}>
              <Route path="/team" element={<Team />} />
            </Route>
            <Route element={<ModuleRoute moduleKeys={["projects", "departments"]} />}>
              <Route path="/projects" element={<Projects />} />
            </Route>
            <Route element={<ModuleRoute moduleKeys={["rbac"]} />}>
              <Route path="/roles" element={<Roles />} />
            </Route>
            <Route element={<ModuleRoute moduleKeys={["audit"]} />}>
              <Route path="/audit" element={<AuditLogs />} />
            </Route>
            <Route element={<ModuleRoute moduleKeys={["broadcast"]} />}>
              <Route path="/broadcast" element={<BroadcastConsole />} />
            </Route>
            <Route path="/profile" element={<Profile />} />
          </Route>
        </Route>

        {/* Catch-all Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ModalProvider>
  );
}

export default App;
