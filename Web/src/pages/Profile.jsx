import React, { useState, useRef } from "react";
import { useApp } from "../context/Appcontext";
import { updateProfileInfo, uploadProfileImage } from "../services/api";
import UserAvatar from "../components/common/UserAvatar";
import {
  Camera,
  User,
  Phone,
  Briefcase,
  Mail,
  Building2,
  Lock,
  Save,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  FileText,
} from "lucide-react";
import toast from "react-hot-toast";

export default function Profile() {
  const { user, setUser, theme } = useApp();
  const isDark = theme === "dark";

  const [fullname, setFullname] = useState(user?.fullname || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [jobTitle, setJobTitle] = useState(user?.jobTitle || "");
  const [bio, setBio] = useState(user?.bio || "");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const fileInputRef = useRef(null);

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file (PNG, JPG, WEBP)");
      return;
    }

    setUploadingPhoto(true);
    const res = await uploadProfileImage(file);
    setUploadingPhoto(false);

    if (res.success && res.user) {
      setUser(res.user);
    } else if (!res.success) {
      toast.error(res.message || "Failed to upload photo");
    }
    e.target.value = "";
  };

  const handleSaveDetails = async (e) => {
    e.preventDefault();
    if (!fullname.trim()) {
      toast.error("Full name is required");
      return;
    }

    if (newPassword && newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setSavingProfile(true);
    const payload = {
      fullname: fullname.trim(),
      phone: phone.trim(),
      jobTitle: jobTitle.trim(),
      bio: bio.trim(),
    };
    if (newPassword.trim()) {
      payload.password = newPassword.trim();
    }

    const res = await updateProfileInfo(payload);
    setSavingProfile(false);

    if (res.success && res.user) {
      setUser(res.user);
      setNewPassword("");
      setConfirmPassword("");
    } else if (!res.success) {
      toast.error(res.message || "Failed to update profile");
    }
  };

  return (
    <div
      className={`flex-1 w-full h-full min-h-0 overflow-y-auto p-5 sm:p-7 transition-colors duration-150 ${
        isDark ? "bg-[#0c0d12] text-slate-100" : "bg-slate-50 text-slate-900"
      }`}
    >
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div
          className={`flex flex-wrap items-center justify-between gap-4 pb-4 border-b ${
            isDark ? "border-white/10" : "border-slate-200"
          }`}
        >
          <div>
            <h1 className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
              Profile & Account Settings
            </h1>
            <p className={`text-xs sm:text-sm mt-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              Manage your profile photo, personal information, and password.
            </p>
          </div>
          {user?.publicId && (
            <span
              className={`font-mono text-xs font-bold px-3 py-1.5 rounded-full border ${
                isDark
                  ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-300"
                  : "bg-indigo-50 border-indigo-200 text-indigo-700"
              }`}
            >
              {user.publicId}
            </span>
          )}
        </div>

        {/* Profile Photo & Identity Card */}
        <div
          className={`p-6 rounded-3xl border flex flex-col sm:flex-row items-center gap-6 ${
            isDark ? "bg-[#14151c] border-white/10" : "bg-white border-slate-200 shadow-xs"
          }`}
        >
          <div className="relative group shrink-0">
            <UserAvatar
              user={user}
              className="w-24 h-24 rounded-3xl border-2 border-indigo-500/40 shadow-lg"
              textClass="text-2xl"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingPhoto}
              className="absolute -bottom-2 -right-2 w-9 h-9 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shadow-lg border-2 border-[#14151c] transition-transform hover:scale-105 cursor-pointer"
              title="Upload custom profile photo"
            >
              {uploadingPhoto ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Camera className="w-4 h-4" />
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={handlePhotoUpload}
              className="hidden"
            />
          </div>

          <div className="flex-1 text-center sm:text-left space-y-2 min-w-0">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h2 className={`text-xl font-bold truncate ${isDark ? "text-white" : "text-slate-900"}`}>
                {user?.fullname}
              </h2>
              <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/25">
                {user?.role}
              </span>
            </div>

            <div className={`flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              <span className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-indigo-400" />
                {user?.email}
              </span>
              <span className="flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                {user?.departmentName || "General"}
              </span>
              <span className="flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-amber-400" />
                {user?.jobTitle || "Staff"}
              </span>
            </div>

            <div className="pt-2 flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto}
                className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-2 ${
                  isDark
                    ? "bg-white/5 hover:bg-white/10 border-white/10 text-white"
                    : "bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-900"
                }`}
              >
                <Camera className="w-3.5 h-3.5 text-indigo-400" />
                <span>{uploadingPhoto ? "Uploading..." : "Upload Custom Photo"}</span>
              </button>
              <span className="text-[11px] text-slate-400">JPG, PNG or WEBP up to 5 MB</span>
            </div>
          </div>
        </div>

        {/* Editable Personal & Security Form */}
        <form
          onSubmit={handleSaveDetails}
          className={`p-6 rounded-3xl border space-y-6 ${
            isDark ? "bg-[#14151c] border-white/10" : "bg-white border-slate-200 shadow-xs"
          }`}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={`text-xs font-bold flex items-center gap-1.5 mb-1.5 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                <User className="w-3.5 h-3.5 text-indigo-400" />
                <span>Full Name *</span>
              </label>
              <input
                type="text"
                required
                value={fullname}
                onChange={(e) => setFullname(e.target.value)}
                placeholder="Your full name"
                className={`w-full rounded-xl px-3.5 py-2.5 text-xs sm:text-sm border focus:outline-none focus:border-indigo-500 ${
                  isDark
                    ? "bg-[#191a24] border-white/10 text-white placeholder-slate-500"
                    : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400"
                }`}
              />
            </div>

            <div>
              <label className={`text-xs font-bold flex items-center gap-1.5 mb-1.5 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                <Briefcase className="w-3.5 h-3.5 text-indigo-400" />
                <span>Job Title</span>
              </label>
              <input
                type="text"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="e.g. Senior Product Engineer"
                className={`w-full rounded-xl px-3.5 py-2.5 text-xs sm:text-sm border focus:outline-none focus:border-indigo-500 ${
                  isDark
                    ? "bg-[#191a24] border-white/10 text-white placeholder-slate-500"
                    : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400"
                }`}
              />
            </div>

            <div>
              <label className={`text-xs font-bold flex items-center gap-1.5 mb-1.5 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                <Phone className="w-3.5 h-3.5 text-emerald-400" />
                <span>Mobile Number (+91 India)</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-slate-400">
                  +91
                </span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="9876543210"
                  maxLength={13}
                  className={`w-full rounded-xl pl-12 pr-3.5 py-2.5 text-xs sm:text-sm border focus:outline-none focus:border-indigo-500 font-mono ${
                    isDark
                      ? "bg-[#191a24] border-white/10 text-white placeholder-slate-500"
                      : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400"
                  }`}
                />
              </div>
            </div>

            <div>
              <label className={`text-xs font-bold flex items-center gap-1.5 mb-1.5 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span>Work Email</span>
              </label>
              <input
                type="email"
                value={user?.email || ""}
                disabled
                className={`w-full rounded-xl px-3.5 py-2.5 text-xs sm:text-sm border opacity-60 cursor-not-allowed ${
                  isDark
                    ? "bg-[#12131b] border-white/10 text-slate-400"
                    : "bg-slate-100 border-slate-200 text-slate-500"
                }`}
              />
            </div>
          </div>

          <div>
            <label className={`text-xs font-bold flex items-center gap-1.5 mb-1.5 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
              <FileText className="w-3.5 h-3.5 text-indigo-400" />
              <span>About / Bio</span>
            </label>
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Short description of your role or focus areas..."
              className={`w-full rounded-xl p-3.5 text-xs sm:text-sm border focus:outline-none focus:border-indigo-500 resize-none ${
                isDark
                  ? "bg-[#191a24] border-white/10 text-white placeholder-slate-500"
                  : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400"
              }`}
            />
          </div>

          {/* Optional Password Update */}
          <div className={`pt-5 border-t space-y-4 ${isDark ? "border-white/10" : "border-slate-200"}`}>
            <h3 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span>Change Password (Optional)</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New password (min 6 chars)"
                  className={`w-full rounded-xl px-3.5 pr-10 py-2.5 text-xs sm:text-sm border focus:outline-none focus:border-indigo-500 ${
                    isDark
                      ? "bg-[#191a24] border-white/10 text-white placeholder-slate-500"
                      : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-400 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className={`w-full rounded-xl px-3.5 py-2.5 text-xs sm:text-sm border focus:outline-none focus:border-indigo-500 ${
                    isDark
                      ? "bg-[#191a24] border-white/10 text-white placeholder-slate-500"
                      : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400"
                  }`}
                />
              </div>
            </div>
          </div>

          <div className={`pt-4 border-t flex items-center justify-end gap-3 ${isDark ? "border-white/10" : "border-slate-200"}`}>
            <button
              type="submit"
              disabled={savingProfile}
              className={`px-6 py-2.5 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 cursor-pointer transition-all ${
                isDark ? "bg-white text-slate-950 hover:bg-slate-200" : "bg-slate-900 text-white hover:bg-slate-800"
              }`}
            >
              {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{savingProfile ? "Saving..." : "Save Profile Changes"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
