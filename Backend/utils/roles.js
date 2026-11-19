const isSuperAdminEmail = (email) => {
  if (!email) return false;
  const list = (process.env.SUPERADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const normalized = email.trim().toLowerCase();
  
  if (list.includes(normalized)) return true;
  if (process.env.DEFAULT_SUPERADMIN_EMAIL && normalized === process.env.DEFAULT_SUPERADMIN_EMAIL.trim().toLowerCase()) {
    return true;
  }

  return list.some((item) => {
    if (item.includes("*")) {
      const regex = new RegExp("^" + item.replace(/\*/g, ".*") + "$");
      return regex.test(normalized);
    }
    return false;
  });
};

module.exports = { isSuperAdminEmail };
