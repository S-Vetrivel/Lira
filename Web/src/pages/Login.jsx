import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useApp } from "../context/Appcontext";
import { loginUser, demoLoginUser, googleOneTapLogin, GOOGLE_AUTH_URL } from "../services/api";
import {
  LogIn,
  Zap,
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
  const [activeDemo, setActiveDemo] = useState(null);

  useEffect(() => {
    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (googleClientId && window.google) {
      try {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: async (response) => {
            if (response.credential) {
              const res = await googleOneTapLogin(response.credential);
              if (res.success) {
                setUser(res.user);
                navigate("/");
              }
            }
          },
        });
        const btnContainer = document.getElementById("google-signin-btn");
        if (btnContainer) {
          window.google.accounts.id.renderButton(btnContainer, {
            theme: "outline",
            size: "large",
            width: "100%",
            shape: "pill",
          });
        }
      } catch (e) {
        console.warn("Google One Tap error:", e);
      }
    }
  }, [navigate, setUser]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    const res = await loginUser(email, password);
    setLoading(false);

    if (res.success) {
      setUser(res.user);
      navigate("/");
    }
  };

  const handleFastDemo = async (role) => {
    setActiveDemo(role);
    setLoading(true);
    const res = await demoLoginUser(role);
    setLoading(false);
    setActiveDemo(null);
    if (res.success) {
      setUser(res.user);
      navigate("/");
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

          {/* Simple feature badges (Plain English) */}
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
              <p className="text-xs text-slate-400 mt-1">Select a demo role or enter your credentials</p>
            </div>

            {/* Fast 1-Click Role Switcher */}
            <div className="p-3 rounded-2xl bg-[#191a26] border border-white/10 space-y-2">
              <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>1-Click Fast Demo Login:</span>
              </span>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleFastDemo("admin")}
                  disabled={loading}
                  className={`py-2 px-2 rounded-xl text-xs font-bold transition-all border flex flex-col items-center gap-1 ${
                    activeDemo === "admin"
                      ? "bg-purple-600 text-white border-purple-500 scale-95"
                      : "bg-purple-950/40 text-purple-300 border-purple-500/30 hover:bg-purple-900/50"
                  }`}
                >
                  <span className="text-base">👑</span>
                  <span>Admin</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleFastDemo("manager")}
                  disabled={loading}
                  className={`py-2 px-2 rounded-xl text-xs font-bold transition-all border flex flex-col items-center gap-1 ${
                    activeDemo === "manager"
                      ? "bg-blue-600 text-white border-blue-500 scale-95"
                      : "bg-blue-950/40 text-blue-300 border-blue-500/30 hover:bg-blue-900/50"
                  }`}
                >
                  <span className="text-base">👔</span>
                  <span>Manager</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleFastDemo("employee")}
                  disabled={loading}
                  className={`py-2 px-2 rounded-xl text-xs font-bold transition-all border flex flex-col items-center gap-1 ${
                    activeDemo === "employee"
                      ? "bg-emerald-600 text-white border-emerald-500 scale-95"
                      : "bg-emerald-950/40 text-emerald-300 border-emerald-500/30 hover:bg-emerald-900/50"
                  }`}
                >
                  <span className="text-base">👨‍💻</span>
                  <span>Employee</span>
                </button>
              </div>
            </div>

            <div className="relative flex items-center justify-center">
              <div className="border-t border-white/10 w-full" />
              <span className="bg-[#14151f] px-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest absolute">
                Or with email
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
                  placeholder="admin@incuman.com"
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
                  <span className="text-[10px] text-slate-400 font-mono">
                    Default: password123
                  </span>
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
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
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

            <div className="text-center pt-2">
              <p className="text-xs text-slate-400">
                Don't have an account?{" "}
                <Link to="/signup" className="text-purple-400 hover:underline font-semibold">
                  Create Account
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
