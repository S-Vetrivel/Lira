import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useApp } from "../../context/Appcontext";
import LiraLogo from "../common/LiraLogo";

/**
 * Helper to distinguish unapproved / deactivated users from active approved members
 * (approved members may set availability status to "active", "away", or "on_leave").
 */
export function isPendingOrRestricted(user) {
  if (!user) return false;
  return (
    user.isActive === false ||
    user.status === "pending_approval" ||
    user.status === "rejected"
  );
}

/**
 * Loading screen shown while verifying auth session with backend.
 */
export function AuthLoadingScreen() {
  const { theme } = useApp();
  const isDark = theme === "dark";

  return (
    <div
      className={`h-screen w-screen flex items-center justify-center lira-canvas-bg ${
        isDark ? "text-white" : "text-slate-900"
      }`}
    >
      <div className="flex flex-col items-center gap-4">
        <div className="animate-pulse">
          <LiraLogo size="lg" isDark={isDark} showBadge />
        </div>
        <p className={`text-xs font-medium ${isDark ? "text-slate-400" : "text-slate-500"}`}>
          Verifying workspace session...
        </p>
      </div>
    </div>
  );
}

/**
 * Protected Route:
 * - Only accessible by authenticated, approved workspace members.
 * - Redirects guests to /login preserving target URL for post-login return.
 * - Redirects pending/rejected/deactivated users to /join-request.
 */
export function ProtectedRoute() {
  const { user, isValidating } = useApp();
  const location = useLocation();

  if (isValidating) {
    return <AuthLoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (isPendingOrRestricted(user)) {
    return <Navigate to="/join-request" replace />;
  }

  return <Outlet />;
}

/**
 * Public Only Route (/login, /signup):
 * - Redirects authenticated active members to their intended page or /board.
 * - Redirects pending/rejected users to /join-request.
 */
export function PublicOnlyRoute() {
  const { user, isValidating } = useApp();
  const location = useLocation();

  if (isValidating) {
    return <AuthLoadingScreen />;
  }

  if (user) {
    if (isPendingOrRestricted(user)) {
      return <Navigate to="/join-request" replace />;
    }
    const returnTo = location.state?.from?.pathname;
    const safeTarget =
      returnTo && !["/login", "/signup", "/landing", "/welcome"].includes(returnTo)
        ? returnTo
        : "/";
    return <Navigate to={safeTarget} replace />;
  }

  return <Outlet />;
}

/**
 * Join Request Guard (/join-request):
 * - Accessible to authenticated users waiting for admin review or declined.
 * - Redirects approved users (regardless of Active / Away / On Leave) to /.
 */
export function JoinRequestGuard() {
  const { user, isValidating } = useApp();

  if (isValidating) {
    return <AuthLoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!isPendingOrRestricted(user)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

/**
 * Role-Based Route Guard:
 * - Restricts routes to specific workspace roles (e.g. ["admin", "manager"]).
 */
export function RoleRoute({ allowedRoles = [] }) {
  const { user, isValidating } = useApp();

  if (isValidating) {
    return <AuthLoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (isPendingOrRestricted(user)) {
    return <Navigate to="/join-request" replace />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

const MODULE_FALLBACK_ORDER = [
  { moduleKey: "dashboard", path: "/dashboard" },
  { moduleKey: "board", path: "/board" },
  { moduleKey: "tasks", path: "/my-work" },
  { moduleKey: "requests", path: "/requests" },
  { moduleKey: "projects", path: "/projects" },
  { moduleKey: "departments", path: "/projects" },
  { moduleKey: "team", path: "/team" },
  { moduleKey: "rbac", path: "/roles" },
  { moduleKey: "audit", path: "/audit" },
];

export function getFirstAllowedRoute({ isSuperAdmin, hasModule }) {
  if (isSuperAdmin) return "/dashboard";
  if (typeof hasModule === "function") {
    const match = MODULE_FALLBACK_ORDER.find((entry) => hasModule(entry.moduleKey));
    if (match) return match.path;
  }
  return "/profile";
}

/**
 * Dynamic Module Route Guard:
 * - Only renders routes if `isSuperAdmin` or user holds at least one module in `moduleKeys`.
 * - Redirects unauthorized roles cleanly to their first permitted module route (or `/profile`).
 */
export function ModuleRoute({ moduleKeys = [] }) {
  const { user, isValidating, isSuperAdmin, hasModule } = useApp();

  if (isValidating) {
    return <AuthLoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (isPendingOrRestricted(user)) {
    return <Navigate to="/join-request" replace />;
  }

  const allowed =
    isSuperAdmin ||
    moduleKeys.length === 0 ||
    moduleKeys.some((k) => hasModule(k));

  if (!allowed) {
    const fallback = getFirstAllowedRoute({ isSuperAdmin, hasModule });
    return <Navigate to={fallback} replace />;
  }

  return <Outlet />;
}
