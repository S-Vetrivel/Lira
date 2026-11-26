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
import { getGlassTokens } from "../styles/glassTheme";

export default function JoinRequestStatus() {
  const { user, setUser, theme } = useApp();
  const navigate = useNavigate();
  const isDark = theme === "dark";
  const g = getGlassTokens(isDark);

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
            navigate("/", { replace: true });
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
        toast.success("You are approved! Entering workspace...", { id: "join-approved" });
        navigate("/", { replace: true });
      } else {
        toast("Application is still under review by workspace admins", {
          id: "join-status-review",
          icon: "⏳",
        });
      }
    }
  };

  const handleEnablePush = async () => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setPushEnabled(true);
      toast("Browser push unavailable on this device — live WebSocket & email alerts active.", {
        id: "push-fallback",
        icon: "🔔",
      });
      return;
    }

    if (
      !window.isSecureContext &&
      window.location.hostname !== "localhost" &&
      window.location.hostname !== "127.0.0.1"
    ) {
      setPushEnabled(true);
      toast("HTTPS is required for browser push — live WebSocket & email alerts active.", {
        id: "push-https-fallback",
        icon: "🔔",
      });
      return;
    }

    if (Notification.permission === "denied") {
      toast.error(
        "Browser notifications are blocked in Site Settings. Enable them in browser settings, or keep this tab open for live WebSocket alerts.",
        { id: "push-denied" }
      );
      return;
    }

    try {
      const permission =
        Notification.permission === "granted"
          ? "granted"
          : await Notification.requestPermission();

      if (permission !== "granted") {
        toast.error(
          "Notification permission was not granted. Live WebSocket & email alerts remain active.",
          { id: "push-denied" }
        );
        return;
      }

      const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        setPushEnabled(true);
        toast.success("In-app live alerts enabled!", { id: "push-enabled" });
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
        toast.success("Push notifications enabled! You'll be alerted immediately upon approval.", {
          id: "push-enabled",
        });
      }
    } catch (err) {
      console.error("Push enable error:", err);
      toast.error(`Push subscription error: ${err.message}`, { id: "push-error" });
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
      className={`min-h-screen w-full px-6 sm:px-10 lg:px-16 py-8 lira-canvas-bg select-none ${
        isDark ? "text-slate-100" : "text-slate-800"
      }`}
    >
      <div className="w-full max-w-5xl mx-auto space-y-6">
        {/* Header Branding */}
        <div className="flex items-center justify-between">
          <LiraLogo size="md" showBadge isDark={isDark} />

          <button
            onClick={handleLogout}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${g.btnSecondary}`}
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>

        {/* Status Hero Card */}
        <div className="rounded-3xl p-6 sm:p-8 lira-glass-glow space-y-6">
          {/* Top Banner Status */}
          <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b ${g.border}`}>
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
              <h1 className={`text-xl sm:text-2xl font-black tracking-tight ${g.heading}`}>
                {isRejected ? "Join Request Declined" : "Join Request Under Review"}
              </h1>
              <p className={`text-xs ${g.muted}`}>
                {isRejected
                  ? "Your application was reviewed by a workspace administrator."
                  : "Your application to join Lira Workspace is awaiting Admin approval."}
              </p>
            </div>

            {/* Public ID Pill */}
            <div className={`p-3 rounded-2xl border flex flex-col items-start sm:items-end gap-1 ${g.subtleSurface}`}>
              <span className={`text-[10px] font-bold uppercase tracking-widest ${g.muted}`}>
                Public Applicant ID
              </span>
              <button
                type="button"
                onClick={handleCopyPublicId}
                className={`flex items-center gap-2 px-3 py-1 rounded-lg border text-xs font-mono font-bold transition-all cursor-pointer ${g.badge}`}
                title="Click to copy Public ID"
              >
                <span>{publicId}</span>
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Candidate Profile Details */}
          <div className={`flex items-center gap-4 p-4 rounded-2xl border ${g.subtleSurface}`}>
            <UserAvatar
              user={user}
              className="w-12 h-12 rounded-2xl border border-white/15"
              textClass="text-base"
            />
            <div className="flex-1 min-w-0">
              <h2 className={`text-sm font-bold truncate ${g.heading}`}>{user?.fullname}</h2>
              <p className={`text-xs truncate ${g.muted}`}>{user?.email}</p>
              <div className={`flex items-center gap-2 mt-1 text-[11px] font-semibold ${g.accentIcon}`}>
                <span className="flex items-center gap-1">
                  <Building className={`w-3 h-3 ${g.muted}`} />
                  <span>{user?.joinRequest?.requestedDepartmentName || user?.departmentName || "Engineering"}</span>
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Briefcase className={`w-3 h-3 ${g.muted}`} />
                  <span>{user?.joinRequest?.requestedJobTitle || user?.jobTitle || "Team Member"}</span>
                </span>
              </div>
            </div>

            <button
              onClick={() => setIsEditing(!isEditing)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${g.btnSecondary}`}
            >
              {isEditing ? "Close" : "Edit Info"}
            </button>
          </div>

          {/* Edit Request Form (Optional Update) */}
          {isEditing && (
            <form onSubmit={handleSubmitDetails} className={`p-4 rounded-2xl border space-y-3 ${g.subtleSurface}`}>
              <h3 className={`text-xs font-bold ${g.heading}`}>Update Join Details:</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={`text-[11px] font-semibold block mb-1 ${g.muted}`}>Target Department</label>
                  <select
                    value={departmentName}
                    onChange={(e) => setDepartmentName(e.target.value)}
                    className={`w-full border rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none ${g.input}`}
                  >
                    <option value="Engineering">Engineering</option>
                    <option value="Operations">Operations</option>
                    <option value="Marketing">Marketing</option>
                    <option value="HR">Human Resources</option>
                    <option value="Product">Product & Design</option>
                  </select>
                </div>

                <div>
                  <label className={`text-[11px] font-semibold block mb-1 ${g.muted}`}>Job Title</label>
                  <input
                    type="text"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none ${g.input}`}
                    placeholder="e.g. Senior Frontend Engineer"
                  />
                </div>
              </div>

              <div>
                <label className={`text-[11px] font-semibold block mb-1 ${g.muted}`}>Note to Admin</label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none ${g.input}`}
                  placeholder="e.g. Working on the sprint deliverables under Rahul"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold ${g.muted}`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={`px-4 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer ${g.btnPrimary}`}
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
                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                  : g.btnSecondary
              }`}
            >
              <Bell className="w-4 h-4" />
              <span>{pushEnabled ? "Push Alerts Active ✓" : "Enable Push Alerts"}</span>
            </button>

            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={checking}
              className={`w-full sm:w-1/2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-2 cursor-pointer ${g.btnSecondary}`}
            >
              <RefreshCw className={`w-4 h-4 ${checking ? "animate-spin" : ""}`} />
              <span>{checking ? "Checking..." : "Check Status Now"}</span>
            </button>
          </div>
        </div>

        {/* Informative Footer Card */}
        <div className={`p-4 rounded-2xl border flex items-center gap-3 text-xs ${g.subtleSurface} ${g.muted}`}>
          <ShieldCheck className={`w-5 h-5 shrink-0 ${g.accentIcon}`} />
          <p>
            You can bookmark this page or keep it open. As soon as an Admin approves your public ID{" "}
            <span className={`font-mono font-bold ${g.heading}`}>{publicId}</span>, this tab will automatically transition into the workspace.
          </p>
        </div>
      </div>
    </div>
  );
}

