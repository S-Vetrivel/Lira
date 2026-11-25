import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useApp } from "../../context/Appcontext";

/**
 * Loading screen shown while verifying auth session with backend
 */
function AuthLoadingScreen() {
  const { theme } = useApp();
  const isDark = theme === "dark";

  return (
    <div
      className={`h-screen w-screen flex items-center justify-center ${
        isDark ? "bg-[#0c0d12] text-white" : "bg-slate-50 text-slate-900"
      }`}
    >
      <div className="flex flex-col items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white font-black text-2xl shadow-xl shadow-purple-500/25 animate-pulse">
          L
        </div>
        <p className="text-xs text-slate-400 font-medium">Authenticating workspace...</p>
      </div>
    </div>
  );
}

/**
 * Protected Route:
 * - Only accessible by authenticated, active workspace members.
 * - Redirects guests to /login.
 * - Redirects candidates with pending approval to /join-request.
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

  if (user.status === "pending_approval") {
    return <Navigate to="/join-request" replace />;
  }

  return <Outlet />;
}

/**
 * Public Only Route:
 * - For /login and /signup.
 * - If user is already logged in and active, redirects to /.
 * - If user is pending approval, redirects to /join-request.
 */
export function PublicOnlyRoute() {
  const { user, isValidating } = useApp();

  if (isValidating) {
    return <AuthLoadingScreen />;
  }

  if (user) {
    if (user.status === "pending_approval") {
      return <Navigate to="/join-request" replace />;
    }
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

/**
 * Join Request Guard:
 * - For /join-request.
 * - Must be authenticated.
 * - If active member visits /join-request, redirects to / workspace.
 */
export function JoinRequestGuard() {
  const { user, isValidating } = useApp();

  if (isValidating) {
    return <AuthLoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.status === "active") {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

