import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useApp } from "../context/Appcontext";
import { loginUser, checkAuth, GOOGLE_AUTH_URL } from "../services/api";
import { isPendingOrRestricted } from "../components/auth/AuthGuards";
import LiraLogo from "../components/common/LiraLogo";
import {
  Kanban,
  Clock,
  ArrowRight,
  ArrowLeft,
  Eye,
  EyeOff,
  Building2,
  FileCheck2,
  Sun,
  Moon,
} from "lucide-react";
import toast from "react-hot-toast";

export default function Login() {
  const { user, setUser, theme, toggleTheme } = useApp();
  const isDark = theme === "dark";
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const intendedTarget =
    location.state?.from?.pathname &&
    !["/login", "/signup", "/landing", "/welcome"].includes(location.state.from.pathname)
      ? location.state.from.pathname
      : "/board";

  useEffect(() => {
    if (user) {
      if (isPendingOrRestricted(user)) {
        navigate("/join-request", { replace: true });
      } else {
        navigate(intendedTarget, { replace: true });
      }
    }
  }, [user, navigate, intendedTarget]);

  // Google OAuth callback token handler
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const error = params.get("error");

    if (error === "google_failed") {
      toast.error("Google sign-in was canceled or failed. Please try again.");
    }

    if (token) {
      localStorage.setItem("lira_token", token);
      checkAuth()
        .then((res) => {
          if (res.isAuthenticated) {
            setUser(res.user);
            toast.success("Successfully authenticated with Google!");
            if (isPendingOrRestricted(res.user)) {
              navigate("/join-request", { replace: true });
            } else {
              navigate("/board", { replace: true });
            }
          }
        })
        .catch(() => {
          toast.error("Failed to verify Google session");
        });
    }
  }, [navigate, setUser]);

  const handleGoogleRedirectLogin = () => {
    const returnUrl = window.location.origin;
    window.location.href = `${GOOGLE_AUTH_URL}?returnUrl=${encodeURIComponent(returnUrl)}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    const res = await loginUser(email, password);
    setLoading(false);

    if (res.success) {
      setUser(res.user);
      if (isPendingOrRestricted(res.user)) {
        navigate("/join-request", { replace: true });
      } else {
        navigate(intendedTarget, { replace: true });
      }
    }
  };

  const inputClass = `w-full border rounded-xl px-3.5 py-2.5 text-sm outline-none transition-colors ${
    isDark
      ? "bg-[#12131b] border-white/[0.1] text-white placeholder-slate-500 focus:border-indigo-500"
      : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:bg-white"
  }`;

  return (
    <div
      className={`min-h-screen w-full grid grid-cols-1 lg:grid-cols-12 transition-colors duration-150 ${
        isDark ? "bg-[#0c0d12] text-slate-100" : "bg-slate-50 text-slate-900"
      }`}
    >
      {/* Left Full-Height Editorial Panel */}
      <div
        className={`lg:col-span-7 flex flex-col justify-between p-6 sm:p-10 lg:p-14 border-b lg:border-b-0 lg:border-r ${
          isDark ? "bg-[#0f1017] border-white/[0.08]" : "bg-slate-100/70 border-slate-200"
        }`}
      >
        <div className="flex items-center justify-between gap-4">
          <Link to="/" className="inline-flex items-center">
            <LiraLogo size="md" showBadge isDark={isDark} />
          </Link>

          <div className="flex items-center gap-2">
            <Link
              to="/"
              className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
                isDark
                  ? "border-white/[0.08] text-slate-300 hover:bg-white/[0.05]"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
              }`}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Overview</span>
            </Link>
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className={`p-2 rounded-lg border transition-colors cursor-pointer ${
                isDark
                  ? "border-white/[0.08] text-slate-300 hover:bg-white/[0.05]"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
              }`}
            >
              {isDark ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        <div className="py-10 lg:py-0 space-y-8 max-w-2xl">
          <div className="space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-widest text-indigo-400">
              Enterprise Team Operations
            </p>
            <h1
              className={`text-3xl sm:text-4xl xl:text-5xl font-extrabold tracking-tight leading-[1.1] ${
                isDark ? "text-white" : "text-slate-950"
              }`}
            >
              Clear execution across boards, teams, and approvals.
            </h1>
            <p className={`text-sm sm:text-base leading-relaxed ${isDark ? "text-slate-400" : "text-slate-600"}`}>
              Keep sprints aligned, manage department staffing, review approvals in INR,
              and collaborate in dedicated project workspaces.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              {
                icon: Kanban,
                title: "Boards, Tables & Calendars",
                desc: "Plan sprints with inline editing and side-drawer details.",
              },
              {
                icon: Building2,
                title: "Department & Staff Controls",
                desc: "Assign leads, balance teams, and message colleagues directly.",
              },
              {
                icon: FileCheck2,
                title: "Multi-Stage INR Approvals",
                desc: "Track formal budgets and requisitions across sign-off stages.",
              },
              {
                icon: Clock,
                title: "Work Effort & Audit Trail",
                desc: "Log actual hours and inspect full operational history.",
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className={`p-4 rounded-2xl border space-y-1.5 ${
                    isDark
                      ? "bg-[#14151f] border-white/[0.07]"
                      : "bg-white border-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold">
                    <Icon className="w-4 h-4" />
                    <span className={isDark ? "text-white" : "text-slate-900"}>{item.title}</span>
                  </div>
                  <p className={`text-xs leading-relaxed ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                    {item.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className={`text-xs flex items-center justify-between ${isDark ? "text-slate-500" : "text-slate-500"}`}>
          <span>Role-protected workspace authentication</span>
          <Link to="/signup" className="text-indigo-400 hover:underline font-semibold">
            Request Team Access →
          </Link>
        </div>
      </div>

      {/* Right Full-Height Sign-In Panel */}
      <div
        className={`lg:col-span-5 flex flex-col justify-center p-6 sm:p-10 lg:p-14 ${
          isDark ? "bg-[#0c0d12]" : "bg-white"
        }`}
      >
        <div className="w-full max-w-md mx-auto space-y-6">
          <div className="space-y-1.5">
            <h2 className={`text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-slate-950"}`}>
              Sign in to Lira
            </h2>
            <p className={`text-xs sm:text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              Continue with your Google account or work email
            </p>
          </div>

          <button
            type="button"
            onClick={handleGoogleRedirectLogin}
            className={`w-full py-2.5 px-4 text-xs sm:text-sm font-semibold rounded-xl border transition-all flex items-center justify-center gap-3 cursor-pointer ${
              isDark
                ? "bg-white hover:bg-slate-200 text-slate-900 border-transparent"
                : "bg-slate-50 hover:bg-slate-100 text-slate-900 border-slate-200"
            }`}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Continue with Google</span>
          </button>

          <div className="relative flex items-center justify-center">
            <div className={`border-t w-full ${isDark ? "border-white/[0.08]" : "border-slate-200"}`} />
            <span
              className={`px-3 text-[10px] font-bold uppercase tracking-widest absolute ${
                isDark ? "bg-[#0c0d12] text-slate-500" : "bg-white text-slate-400"
              }`}
            >
              Or with work email
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={`text-xs font-semibold block mb-1.5 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                Work Email
              </label>
              <input
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                required
              />
            </div>

            <div>
              <label className={`text-xs font-semibold block mb-1.5 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${inputClass} pr-10`}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-2.5 text-xs sm:text-sm font-semibold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 ${
                isDark
                  ? "bg-white text-slate-950 hover:bg-slate-200"
                  : "bg-slate-900 text-white hover:bg-slate-800"
              }`}
            >
              <span>{loading ? "Signing In..." : "Sign In"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <p className={`text-center text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            New to the organization?{" "}
            <Link to="/signup" className="text-indigo-400 hover:underline font-semibold">
              Request to Join
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
