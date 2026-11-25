import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useApp } from "../context/Appcontext";
import { signUpUser, GOOGLE_AUTH_URL } from "../services/api";
import { isPendingOrRestricted } from "../components/auth/AuthGuards";
import LiraLogo from "../components/common/LiraLogo";
import { UserPlus, ArrowLeft, ShieldCheck, CheckCircle2, Sun, Moon } from "lucide-react";
import { getGlassTokens } from "../styles/glassTheme";
import toast from "react-hot-toast";

export default function Signup() {
  const { user, setUser, theme, toggleTheme } = useApp();
  const isDark = theme === "dark";
  const g = getGlassTokens(isDark);
  const navigate = useNavigate();

  const [fullname, setFullname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [departmentName, setDepartmentName] = useState("Engineering");
  const [jobTitle, setJobTitle] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      if (isPendingOrRestricted(user)) {
        navigate("/join-request", { replace: true });
      } else {
        navigate("/", { replace: true });
      }
    }
  }, [user, navigate]);

  const handleGoogleRedirect = () => {
    const returnUrl = window.location.origin;
    window.location.href = `${GOOGLE_AUTH_URL}?returnUrl=${encodeURIComponent(returnUrl)}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!fullname || !email || !password) return;

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setLoading(true);
    const res = await signUpUser({
      fullname,
      email,
      password,
      confirmPassword,
      role: "employee",
      departmentName,
      jobTitle,
      reason,
    });
    setLoading(false);

    if (res.success) {
      setUser(res.user);
      if (isPendingOrRestricted(res.user)) {
        navigate("/join-request", { replace: true });
      } else {
        navigate("/", { replace: true });
      }
    }
  };

  const inputClass = `w-full border rounded-xl px-3.5 py-2.5 text-xs sm:text-sm outline-none transition-colors ${g.input}`;

  return (
    <div
      className={`min-h-screen w-full grid grid-cols-1 lg:grid-cols-12 relative overflow-x-hidden transition-colors duration-150 ${g.canvas}`}
    >
      {/* Left Full-Height Information Column */}
      <div
        className={`lg:col-span-6 flex flex-col justify-between p-6 sm:p-10 lg:p-14 border-b lg:border-b-0 lg:border-r backdrop-blur-2xl ${
          isDark ? "bg-white/[0.02] border-white/[0.08]" : "bg-white/45 border-slate-900/[0.08]"
        }`}
      >
        <div className="flex items-center justify-between gap-4">
          <Link to="/">
            <LiraLogo size="md" showBadge isDark={isDark} />
          </Link>

          <div className="flex items-center gap-2">
            <Link
              to="/"
              className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${g.btnSecondary}`}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Overview</span>
            </Link>
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className={`p-2 rounded-lg transition-colors cursor-pointer ${g.iconBtn}`}
            >
              {isDark ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-slate-700" />}
            </button>
          </div>
        </div>

        <div className="py-10 lg:py-0 space-y-6 max-w-xl">
          <div className="space-y-3">
            <p className={`text-[11px] font-bold uppercase tracking-widest ${g.muted}`}>
              Verified Member Onboarding
            </p>
            <h1 className={`text-3xl sm:text-4xl font-extrabold tracking-tight leading-[1.12] ${g.heading}`}>
              Request access to your organization workspace.
            </h1>
            <p className={`text-sm leading-relaxed ${isDark ? "text-zinc-300/80" : "text-slate-600"}`}>
              Every new request receives a trackable Public Applicant ID (EMP-XXXX)
              so managers and administrators can verify your department and activate your seat cleanly.
            </p>
          </div>

          <div className="space-y-3">
            {[
              "Select your department and role title upfront",
              "Receive real-time alerts when an administrator approves your request",
              "Unlock assigned boards, shared project files, and direct team chat",
            ].map((point) => (
              <div key={point} className="flex items-start gap-2.5 text-xs sm:text-sm p-3 rounded-xl lira-glass">
                <CheckCircle2 className={`w-4 h-4 shrink-0 mt-0.5 ${g.accentIcon}`} />
                <span className={isDark ? "text-zinc-200" : "text-slate-700"}>{point}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={`flex items-center gap-2 text-xs ${g.muted}`}>
          <ShieldCheck className={`w-4 h-4 ${g.accentIcon}`} />
          <span>Protected by administrator approval & workspace access guards</span>
        </div>
      </div>

      {/* Right Full-Height Registration Form */}
      <div
        className={`lg:col-span-6 flex flex-col justify-center p-6 sm:p-10 lg:p-14 backdrop-blur-2xl ${
          isDark ? "bg-black/35" : "bg-white/60"
        }`}
      >
        <div className="w-full max-w-lg mx-auto p-6 sm:p-8 rounded-3xl lira-glass-glow space-y-5">
          <div>
            <h2 className={`text-2xl font-bold tracking-tight ${g.heading}`}>
              Request to Join
            </h2>
            <p className={`text-xs sm:text-sm mt-1 ${g.muted}`}>
              Apply with Google or fill in your work profile below
            </p>
          </div>

          <button
            type="button"
            onClick={handleGoogleRedirect}
            className={`w-full py-2.5 px-4 text-xs sm:text-sm font-semibold rounded-xl border transition-all flex items-center justify-center gap-3 cursor-pointer ${isDark
                ? "bg-white hover:bg-zinc-200 text-zinc-900 border-transparent"
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
            <div className={`border-t w-full ${g.border}`} />
            <span
              className={`px-3 text-[10px] font-bold uppercase tracking-widest absolute rounded-full ${isDark ? "bg-[#191b22] text-zinc-400" : "bg-white text-slate-400"
                }`}
            >
              Or with work email
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className={`text-xs font-semibold block mb-1.5 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                  Full Name *
                </label>
                <input
                  type="text"
                  placeholder="Rahul Sharma"
                  value={fullname}
                  onChange={(e) => setFullname(e.target.value)}
                  className={inputClass}
                  required
                />
              </div>

              <div>
                <label className={`text-xs font-semibold block mb-1.5 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                  Work Email *
                </label>
                <input
                  type="email"
                  placeholder="rahul@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className={`text-xs font-semibold block mb-1.5 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                  Target Department
                </label>
                <select
                  value={departmentName}
                  onChange={(e) => setDepartmentName(e.target.value)}
                  className={inputClass}
                >
                  <option value="Engineering">Engineering</option>
                  <option value="Operations">Operations</option>
                  <option value="Marketing">Marketing</option>
                  <option value="HR">Human Resources</option>
                  <option value="Product">Product & Design</option>
                </select>
              </div>

              <div>
                <label className={`text-xs font-semibold block mb-1.5 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                  Job Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Senior Frontend Engineer"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label className={`text-xs font-semibold block mb-1.5 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                Note for Admins (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Working on the sprint deliverables"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className={inputClass}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className={`text-xs font-semibold block mb-1.5 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                  Password *
                </label>
                <input
                  type="password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                  required
                />
              </div>

              <div>
                <label className={`text-xs font-semibold block mb-1.5 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                  Confirm *
                </label>
                <input
                  type="password"
                  placeholder="••••••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={inputClass}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 text-xs sm:text-sm font-semibold rounded-xl lira-btn-primary flex items-center justify-center gap-2 mt-2 cursor-pointer disabled:opacity-60"
            >
              <UserPlus className="w-4 h-4" />
              <span>{loading ? "Submitting Application..." : "Submit Join Request"}</span>
            </button>
          </form>

          <p className={`text-center text-xs ${g.muted}`}>
            Already registered?{" "}
            <Link to="/login" className={`${g.heading} hover:underline font-semibold`}>
              Sign In here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
