import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useApp } from "../context/Appcontext";
import { signUpUser } from "../services/api";
import { UserPlus, ArrowRight } from "lucide-react";
import toast from "react-hot-toast";

export default function Signup() {
  const { setUser } = useApp();
  const navigate = useNavigate();

  const [fullname, setFullname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState("employee");
  const [departmentName, setDepartmentName] = useState("Engineering");
  const [jobTitle, setJobTitle] = useState("");
  const [loading, setLoading] = useState(false);

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
      role,
      departmentName,
      jobTitle,
    });
    setLoading(false);

    if (res.success) {
      setUser(res.user);
      navigate("/");
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#0c0d12] text-slate-100 flex items-center justify-center p-6 select-none">
      <div className="w-full max-w-md rounded-3xl bg-[#14151f] border border-white/10 p-6 sm:p-8 shadow-2xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <span className="text-2xl font-black tracking-tight text-white flex items-center">
              lira
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 ml-0.5" />
            </span>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            Create Staff Account
          </h1>
          <p className="text-xs text-slate-400">
            Join your team workspace and access sprint deliverables
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Full Name *
              </label>
              <input
                type="text"
                placeholder="Rahul Sharma"
                value={fullname}
                onChange={(e) => setFullname(e.target.value)}
                className="w-full bg-[#191a26] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Work Email *
              </label>
              <input
                type="email"
                placeholder="rahul@incuman.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#191a26] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full bg-[#191a26] border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-semibold focus:outline-none"
              >
                <option value="employee" className="bg-[#191a26]">👨‍💻 Employee</option>
                <option value="manager" className="bg-[#191a26]">👔 Manager / Lead</option>
                <option value="admin" className="bg-[#191a26]">👑 Admin</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Department
              </label>
              <select
                value={departmentName}
                onChange={(e) => setDepartmentName(e.target.value)}
                className="w-full bg-[#191a26] border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-semibold focus:outline-none"
              >
                <option value="Engineering" className="bg-[#191a26]">Engineering</option>
                <option value="Operations" className="bg-[#191a26]">Operations</option>
                <option value="Marketing" className="bg-[#191a26]">Marketing</option>
                <option value="HR" className="bg-[#191a26]">Human Resources</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Job Title
            </label>
            <input
              type="text"
              placeholder="e.g. Senior Frontend Engineer"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              className="w-full bg-[#191a26] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Password *
              </label>
              <input
                type="password"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#191a26] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Confirm *
              </label>
              <input
                type="password"
                placeholder="••••••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-[#191a26] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs sm:text-sm font-bold rounded-xl shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2 mt-2 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>{loading ? "Registering..." : "Create Account"}</span>
          </button>
        </form>

        <div className="text-center text-xs text-slate-400">
          <span>Already registered? </span>
          <Link to="/login" className="text-purple-400 hover:underline font-bold">
            Sign In here
          </Link>
        </div>
      </div>
    </div>
  );
}
