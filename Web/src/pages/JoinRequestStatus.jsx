import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/Appcontext";
import {
  getJoinRequestStatus,
  submitJoinRequest,
  registerPushSubscription,
  logoutUser,
  checkAuth,
} from "../services/api";
import { initSocketClient } from "../services/socket";
import {
  Clock,
  CheckCircle,
  Copy,
  Check,
  Bell,
  Building,
  Briefcase,
  LogOut,
  Send,
  ShieldCheck,
  Sparkles,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import toast from "react-hot-toast";
import UserAvatar from "../components/common/UserAvatar";
import LiraLogo from "../components/common/LiraLogo";

export default function JoinRequestStatus() {
  const { user, setUser, theme } = useApp();
  const navigate = useNavigate();
  const isDark = theme === "dark";

  const [copied, setCopied] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [checking, setChecking] = useState(false);

  // Edit fields
  const [departmentName, setDepartmentName] = useState(
    user?.joinRequest?.requestedDepartmentName || user?.departmentName || "Engineering"
  );
  const [jobTitle, setJobTitle] = useState(
    user?.joinRequest?.requestedJobTitle || user?.jobTitle || "Team Member"
  );
  const [reason, setReason] = useState(user?.joinRequest?.reason || "");

  // Real-time WebSocket connection to listen for approval
  useEffect(() => {
    if (!user?._id) return;

    const socket = initSocketClient(user._id);

    const handleApproval = (data) => {
      console.log("🔔 [JoinRequest] Approval received via WebSocket:", data);
      toast.success("🎉 Congratulations! Your request to join the workspace has been approved!");

      // Refresh auth state
      checkAuth().then((res) => {
        if (res.isAuthenticated) {
          setUser(res.user);
          setTimeout(() => {
            navigate("/board", { replace: true });
          }, 1200);
        }
      });
    };

    const handleRejection = (data) => {
      toast.error(`Application status updated: ${data.reason || "Declined"}`);
      checkAuth().then((res) => {
        if (res.user) setUser(res.user);
      });
    };

    socket.on("user:approved", handleApproval);
    socket.on("user:rejected", handleRejection);
    if (user.publicId) {
      socket.on(`join-request:${user.publicId}:approved`, handleApproval);
    }

    return () => {
      socket.off("user:approved", handleApproval);
      socket.off("user:rejected", handleRejection);
      if (user.publicId) {
        socket.off(`join-request:${user.publicId}:approved`, handleApproval);
      }
    };
  }, [user?._id, user?.publicId, navigate, setUser]);

  const handleCopyPublicId = () => {
    if (!user?.publicId) return;
    navigator.clipboard.writeText(user.publicId);
    setCopied(true);
    toast.success(`Copied Public ID: ${user.publicId}`);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleManualRefresh = async () => {
    setChecking(true);
    const res = await checkAuth();
    setChecking(false);
    if (res.isAuthenticated) {
      setUser(res.user);
      if (res.user.status === "active" && res.user.isActive) {
        toast.success("You are approved! Entering workspace...");
        navigate("/board", { replace: true });
      } else {
        toast("Application is still under review by workspace admins", { icon: "⏳" });
      }
    }
  };

  const handleEnablePush = async () => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      toast.error("Browser push notifications are not supported in this browser");
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error("Notification permission denied");
        return;
      }

      const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        toast.error("VAPID public key not configured");
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      // Convert VAPID key to Uint8Array
      const padding = "=".repeat((4 - (vapidKey.length % 4)) % 4);
      const base64 = (vapidKey + padding).replace(/-/g, "+").replace(/_/g, "/");
      const rawData = window.atob(base64);
      const outputArray = new Uint8Array(rawData.length);
      for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: outputArray,
      });

      const res = await registerPushSubscription(subscription);
      if (res.success) {
        setPushEnabled(true);
        toast.success("Push notifications enabled! You'll be alerted immediately upon approval.");
      }
    } catch (err) {
      console.error("Push enable error:", err);
      toast.error(`Push subscription error: ${err.message}`);
    }
  };

  const handleSubmitDetails = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    const res = await submitJoinRequest({
      departmentName,
      jobTitle,
      reason,
    });
    setSubmitting(false);

    if (res.success) {
      setUser(res.user);
      setIsEditing(false);
    }
  };

  const handleLogout = async () => {
    await logoutUser();
    setUser(null);
    navigate("/login");
  };

  const publicId = user?.publicId || `EMP-${user?._id?.slice(-4).toUpperCase() || "PENDING"}`;
  const isRejected = user?.status === "rejected";

  return (
    <div
      className={`min-h-screen w-full px-6 sm:px-10 lg:px-16 py-8 select-none ${
        isDark ? "bg-[#0c0d12] text-slate-100" : "bg-slate-50 text-slate-800"
      }`}
    >
      <div className="w-full max-w-5xl mx-auto space-y-6">
        {/* Header Branding */}
        <div className="flex items-center justify-between">
          <LiraLogo size="md" showBadge isDark={isDark} />

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>

        {/* Status Hero Card */}
        <div
          className={`rounded-3xl p-6 sm:p-8 shadow-2xl border space-y-6 ${
            isDark ? "bg-[#14151f] border-white/10" : "bg-white border-slate-200"
          }`}
        >
          {/* Top Banner Status */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                    isRejected
                      ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                      : "bg-amber-500/10 text-amber-300 border border-amber-500/20"
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isRejected ? "bg-rose-400" : "bg-amber-400 animate-ping"
                    }`}
                  />
                  <span>{isRejected ? "Application Declined" : "Under Review"}</span>
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                {isRejected ? "Join Request Declined" : "Join Request Under Review"}
              </h1>
              <p className="text-xs text-slate-400">
                {isRejected
                  ? "Your application was reviewed by a workspace administrator."
                  : "Your application to join Lira Workspace is awaiting Admin approval."}
              </p>
            </div>

            {/* Public ID Pill */}
            <div className="p-3 rounded-2xl bg-[#191a26] border border-white/10 flex flex-col items-start sm:items-end gap-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Public Applicant ID
              </span>
              <button
                type="button"
                onClick={handleCopyPublicId}
                className="flex items-center gap-2 px-3 py-1 rounded-lg bg-purple-950/40 border border-purple-500/30 text-purple-300 hover:bg-purple-900/50 text-xs font-mono font-bold transition-all cursor-pointer"
                title="Click to copy Public ID"
              >
                <span>{publicId}</span>
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Candidate Profile Details */}
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-[#191a26] border border-white/10">
            <UserAvatar
              user={user}
              className="w-12 h-12 rounded-2xl border border-purple-500/30"
              textClass="text-base"
            />
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-bold text-white truncate">{user?.fullname}</h2>
              <p className="text-xs text-slate-400 truncate">{user?.email}</p>
              <div className="flex items-center gap-2 mt-1 text-[11px] text-purple-300 font-semibold">
                <span className="flex items-center gap-1">
                  <Building className="w-3 h-3 text-slate-400" />
                  <span>{user?.joinRequest?.requestedDepartmentName || user?.departmentName || "Engineering"}</span>
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Briefcase className="w-3 h-3 text-slate-400" />
                  <span>{user?.joinRequest?.requestedJobTitle || user?.jobTitle || "Team Member"}</span>
                </span>
              </div>
            </div>

            <button
              onClick={() => setIsEditing(!isEditing)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold text-purple-300 hover:text-white bg-purple-500/10 border border-purple-500/20 hover:bg-purple-500/20 transition-all cursor-pointer"
            >
              {isEditing ? "Close" : "Edit Info"}
            </button>
          </div>

          {/* Edit Request Form (Optional Update) */}
          {isEditing && (
            <form onSubmit={handleSubmitDetails} className="p-4 rounded-2xl bg-[#191a26] border border-white/10 space-y-3">
              <h3 className="text-xs font-bold text-white">Update Join Details:</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">Target Department</label>
                  <select
                    value={departmentName}
                    onChange={(e) => setDepartmentName(e.target.value)}
                    className="w-full bg-[#14151f] border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-semibold focus:outline-none"
                  >
                    <option value="Engineering" className="bg-[#14151f]">Engineering</option>
                    <option value="Operations" className="bg-[#14151f]">Operations</option>
                    <option value="Marketing" className="bg-[#14151f]">Marketing</option>
                    <option value="HR" className="bg-[#14151f]">Human Resources</option>
                    <option value="Product" className="bg-[#14151f]">Product & Design</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">Job Title</label>
                  <input
                    type="text"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    className="w-full bg-[#14151f] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                    placeholder="e.g. Senior Frontend Engineer"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">Note to Admin</label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full bg-[#14151f] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  placeholder="e.g. Working on the sprint deliverables under Rahul"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white flex items-center gap-1.5 cursor-pointer shadow-lg shadow-purple-500/20"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{submitting ? "Saving..." : "Update Request"}</span>
                </button>
              </div>
            </form>
          )}

          {/* Workflow Stepper */}
          <div className="space-y-3 pt-2">
            <span className="text-xs font-bold text-slate-300">Approval Timeline:</span>

            <div className="space-y-3">
              {/* Step 1 */}
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center text-xs mt-0.5">
                  <Check className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Account Verified</h4>
                  <p className="text-[11px] text-slate-400">Signed in as {user?.email}</p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center text-xs mt-0.5">
                  <Check className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Join Request Dispatched</h4>
                  <p className="text-[11px] text-slate-400">
                    Registered as applicant {publicId}. Notifications pushed to workspace administrators.
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex items-start gap-3">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs mt-0.5 ${
                    isRejected
                      ? "bg-rose-500/20 border border-rose-500/40 text-rose-400"
                      : "bg-amber-500/20 border border-amber-500/40 text-amber-300 animate-pulse"
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">
                    {isRejected ? "Access Declined" : "Workspace Admin Review (In Progress)"}
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    {isRejected
                      ? user?.joinRequest?.rejectionReason || "Application was rejected by workspace administrator."
                      : "Workspace administrators have been notified. This screen will unlock automatically once approved."}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Action Row: Enable Push & Manual Refresh */}
          <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
            <button
              type="button"
              onClick={handleEnablePush}
              disabled={pushEnabled}
              className={`w-full sm:w-1/2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-2 cursor-pointer ${
                pushEnabled
                  ? "bg-emerald-950/40 text-emerald-300 border-emerald-500/30"
                  : "bg-[#191a26] text-purple-300 border-purple-500/30 hover:bg-purple-900/40"
              }`}
            >
              <Bell className="w-4 h-4" />
              <span>{pushEnabled ? "Push Alerts Active ✓" : "Enable Push Alerts"}</span>
            </button>

            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={checking}
              className="w-full sm:w-1/2 py-2.5 px-4 rounded-xl text-xs font-bold bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${checking ? "animate-spin" : ""}`} />
              <span>{checking ? "Checking..." : "Check Status Now"}</span>
            </button>
          </div>
        </div>

        {/* Informative Footer Card */}
        <div className="p-4 rounded-2xl bg-[#14151f] border border-white/5 flex items-center gap-3 text-xs text-slate-400">
          <ShieldCheck className="w-5 h-5 text-purple-400 shrink-0" />
          <p>
            You can bookmark this page or keep it open. As soon as an Admin approves your public ID{" "}
            <span className="font-mono text-purple-300 font-bold">{publicId}</span>, this tab will automatically transition into the workspace.
          </p>
        </div>
      </div>
    </div>
  );
}

