// src/components/profile/ProfileHeader.jsx
import React from "react";
import { motion } from "framer-motion";
import { Camera, LogOut } from "lucide-react";
import GoogleIcon from "../GoogleIcon";

export default function ProfileHeader({
  user,
  theme,
  onLogoutClick,
  memberSince,
  email,
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col md:flex-row items-center md:items-end gap-8 mb-16"
    >
      {/* Avatar Section */}
      <div className="relative group cursor-pointer">
        <div
          className="w-32 h-32 rounded-full overflow-hidden border-4 transition-transform group-hover:scale-105"
          style={{ borderColor: theme.card?.bg || "rgba(255,255,255,0.1)" }}
        >
          <img
            src={user?.profilePicture}
            alt="Profile"
            className="w-full h-full object-cover"
          />
        </div>
        <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
          <Camera size={20} />
        </div>
      </div>

      {/* Info Section */}
      <div className="text-center md:text-left flex-1">
        <h1 className="text-4xl font-black uppercase tracking-tight">
          {user?.fullname || "User Name"}
        </h1>
        <div className="flex items-center justify-center md:justify-start gap-2 mt-2">
          <p className="opacity-60 font-mono text-sm">{user?.email}</p>
          {user?.googleId && (
            <div title="Linked via Google">
              <GoogleIcon />
            </div>
          )}
        </div>
        {(user?.id || user?.createdAt) && (
          <p className="text-xs opacity-40 mt-2 font-mono">
            {user?.id && <>ID: {user.id}</>}

            {user?.id && user?.createdAt && " • "}

            {user?.createdAt && (
              <>
                Member Since{" "}
                {new Date(user.createdAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </>
            )}
          </p>
        )}
      </div>

      {/* Logout Button */}
      <button
        onClick={onLogoutClick}
        className="flex items-center gap-2 px-6 py-3 rounded-full border hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/50 transition-all text-sm font-bold uppercase tracking-wider group"
        style={{
          borderColor: theme.navbar?.border || "rgba(150,150,150,0.2)",
        }}
      >
        <LogOut
          size={16}
          className="group-hover:-translate-x-1 transition-transform"
        />{" "}
        Sign Out
      </button>
    </motion.div>
  );
}
