import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { useApp } from "./context/Appcontext";
import { MainLayout } from "./components/layout/MainLayout";
import {
  ProtectedRoute,
  PublicOnlyRoute,
  JoinRequestGuard,
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
import Profile from "./pages/Profile";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import JoinRequestStatus from "./pages/JoinRequestStatus";

/**
 * Root `/` entry guard:
 * - Shows public Lira Landing page to unauthenticated visitors
 * - Routes pending/declined applicants to `/join-request`
 * - Renders the main Workspace Dashboard (Overview) for approved authenticated members
 */
function HomeEntry() {
  const { user, isValidating } = useApp();

  if (isValidating) {
    return <AuthLoadingScreen />;
  }

  if (!user) {
    return <Landing />;
  }

  if (isPendingOrRestricted(user)) {
    return <Navigate to="/join-request" replace />;
  }

  return (
    <MainLayout>
      <Analytics />
    </MainLayout>
  );
}

function App() {
  return (
    <>
      <Toaster
        position="bottom-right"
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

        {/* Authenticated Workspace Routes (Must be active approved member) */}
        <Route element={<ProtectedRoute />}>
          <Route element={<MainLayout />}>
            <Route path="/dashboard" element={<Analytics />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/board" element={<Board />} />
            <Route path="/table" element={<TableView />} />
            <Route path="/calendar" element={<CalendarView />} />
            <Route path="/requests" element={<Requests />} />
            <Route path="/my-work" element={<MyWork />} />
            <Route path="/team" element={<Team />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/roles" element={<Roles />} />
            <Route path="/profile" element={<Profile />} />
          </Route>
        </Route>

        {/* Catch-all Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default App;
