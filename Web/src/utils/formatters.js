/**
 * Indian locale & formatting utilities + consistent user name helpers
 */

export function formatINR(amount, { decimals = 0 } = {}) {
  const num = Number(amount) || 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

export function formatNumberIN(value) {
  return new Intl.NumberFormat("en-IN").format(Number(value) || 0);
}

export function formatDateIN(dateInput, options = { day: "2-digit", month: "short", year: "numeric" }) {
  if (!dateInput) return "";
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-IN", options);
}

export function formatTimeIN(dateInput) {
  if (!dateInput) return "";
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function getDisplayName(userObj, fallback = "Unknown") {
  if (!userObj) return fallback;
  if (typeof userObj === "string") return userObj;
  return userObj.fullname || userObj.name || userObj.email || fallback;
}

export function getInitials(userObj) {
  const name = getDisplayName(userObj, "U");
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function formatFileSize(bytes = 0) {
  const size = Number(bytes) || 0;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

export function getDownloadUrl(url) {
  if (!url) return "#";
  if (url.startsWith("/v3/files/download/")) {
    const token = localStorage.getItem("lira_token");
    if (token && !url.includes("token=")) {
      return `${url}?token=${encodeURIComponent(token)}`;
    }
  }
  return url;
}

