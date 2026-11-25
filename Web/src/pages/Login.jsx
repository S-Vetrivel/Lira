import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useApp } from "../context/Appcontext";
import { loginUser, checkAuth, GOOGLE_AUTH_URL } from "../services/api";
import {
  LogIn,
  Kanban,
  Clock,
  ArrowRight,
  Eye,
  EyeOff,
  Sparkles,
  BarChart2,
  Users,
} from "lucide-react";
import toast from "react-hot-toast";

export default function Login() {
  const { user, setUser } = useApp();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // If user is already authenticated, redirect immediately away from login
  useEffect(() => {
    if (user) {
      if (user.status === "pending_approval") {
        navigate("/join-request", { replace: true });
      } else {
        navigate("/", { replace: true });
      }
    }
  }, [user, navigate]);

  // 1. Detect Google Redirect Callback Query Parameters
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
            if (res.user.status === "pending_approval") {
              navigate("/join-request", { replace: true });
            } else {
              navigate("/", { replace: true });
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
      if (res.user.status === "pending_approval") {
        navigate("/join-request");
      } else {
        navigate("/");
      }
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#0c0d12] text-slate-100 flex items-center justify-center p-6 sm:p-10 select-none">
      <div className="w-full max-w-5xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-12">
        {/* Left Side: Clean Brand Presentation */}
        <div className="w-full lg:w-1/2 space-y-6 text-left">
          <div className="flex items-center gap-2">
            <span className="text-3xl font-black tracking-tight text-white flex items-center">
              lira
              <span className="w-2 h-2 rounded-full bg-purple-400 ml-1" />
            </span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20">
              Workspace
            </span>
          </div>

          <div className="space-y-3">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-tight">
              Modern Office & <br />
              <span className="bg-gradient-to-r from-purple-400 via-indigo-300 to-blue-400 bg-clip-text text-transparent">
                Task Management
              </span>
            </h1>
            <p className="text-sm sm:text-base text-slate-400 max-w-md leading-relaxed">
              Keep your team organized, prioritize urgent deliverables, log work effort, and monitor project velocity in one place.
            </p>
          </div>

          {/* Feature Badges */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="p-3.5 rounded-2xl bg-[#14151f] border border-white/5 space-y-1">
              <div className="flex items-center gap-2 text-purple-300 text-xs font-bold">
                <Kanban className="w-4 h-4" />
                <span>Interactive Board</span>
              </div>
              <p className="text-[11px] text-slate-400">Drag & drop cards across custom sprint columns</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#14151f] border border-white/5 space-y-1">
              <div className="flex items-center gap-2 text-blue-300 text-xs font-bold">
                <Sparkles className="w-4 h-4" />
                <span>AI Task Assistant</span>
              </div>
              <p className="text-[11px] text-slate-400">One-click task breakdown & checklist generation</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#14151f] border border-white/5 space-y-1">
              <div className="flex items-center gap-2 text-amber-300 text-xs font-bold">
                <Clock className="w-4 h-4" />
                <span>Work Logging</span>
              </div>
              <p className="text-[11px] text-slate-400">Compare actual hours logged against estimates</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#14151f] border border-white/5 space-y-1">
              <div className="flex items-center gap-2 text-emerald-300 text-xs font-bold">
                <BarChart2 className="w-4 h-4" />
                <span>Live Analytics</span>
              </div>
              <p className="text-[11px] text-slate-400">Visual workload balance and project completion</p>
            </div>
          </div>
        </div>

        {/* Right Side: Clean Glass Card */}
        <div className="w-full lg:w-[420px]">
          <div className="rounded-3xl bg-[#14151f] border border-white/10 p-6 sm:p-8 shadow-2xl space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Sign In</h2>
              <p className="text-xs text-slate-400 mt-1">Access your workspace with Google or email</p>
            </div>

            {/* Single Clean "Continue with Google" Button */}
            <div>
              <button
                type="button"
                onClick={handleGoogleRedirectLogin}
                className="w-full py-2.5 px-4 bg-white hover:bg-slate-100 text-slate-800 text-xs sm:text-sm font-semibold rounded-xl shadow-md transition-all flex items-center justify-center gap-3 cursor-pointer border border-slate-200 active:scale-[0.98]"
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
            </div>

            <div className="relative flex items-center justify-center">
              <div className="border-t border-white/10 w-full" />
              <span className="bg-[#14151f] px-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest absolute">
                Or with work email
              </span>
            </div>

            {/* Email & Password Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Work Email
                </label>
                <input
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#191a26] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-all font-medium"
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    Password
                  </label>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-[#191a26] border border-white/10 rounded-xl px-3.5 pr-10 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-all font-medium"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs sm:text-sm font-bold rounded-xl shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>{loading ? "Signing In..." : "Sign In"}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            <div className="text-center pt-1">
              <p className="text-xs text-slate-400">
                New to the team?{" "}
                <Link to="/signup" className="text-purple-400 hover:underline font-semibold">
                  Request to Join
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
