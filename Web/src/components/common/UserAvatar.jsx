import React, { useState, useEffect } from "react";
import { getDisplayName, getInitials } from "../../utils/formatters";

const AVATAR_COLORS = [
  "from-blue-600 to-indigo-600",
  "from-indigo-600 to-purple-600",
  "from-emerald-600 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-pink-600",
];

function getColorClass(name = "") {
  let sum = 0;
  for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}

export default function UserAvatar({
  user,
  name,
  src,
  className = "w-8 h-8 rounded-full",
  textClass = "text-xs",
}) {
  const [imgError, setImgError] = useState(false);

  const displayName = name || getDisplayName(user, "User");
  const rawSrc = src || user?.avatar || user?.profilePicture || "";
  const isCartoonFallback = rawSrc.includes("dicebear.com");

  useEffect(() => {
    setImgError(false);
  }, [rawSrc]);

  const validSrc = rawSrc && !isCartoonFallback && !imgError ? rawSrc : null;

  if (validSrc) {
    return (
      <img
        src={validSrc}
        alt={displayName}
        title={displayName}
        referrerPolicy="no-referrer"
        onError={() => setImgError(true)}
        className={`${className} object-cover shrink-0`}
      />
    );
  }

  return (
    <div
      title={displayName}
      className={`${className} bg-gradient-to-br ${getColorClass(
        displayName
      )} text-white font-bold flex items-center justify-center shrink-0 select-none ${textClass}`}
    >
      {getInitials(displayName)}
    </div>
  );
}
