const jwt = require("jsonwebtoken");
const User = require("../models/userModel");
const {
  isSuperAdminUser,
  resolveUserAccess,
  hasWildcardPermission,
} = require("../utils/roles");

/**
 * Modular Authentication & Dynamic RBAC Guard Middleware.
 *
 * Accepts:
 * - No args (`protect()`): Requires authenticated, active workspace member.
 * - Permission slug string (`protect("tasks.create")`): Checks resolved user permissions + wildcard support.
 * - Array of roles and/or permission slugs (`protect(["tasks.approve", "admin"])`): Grants if user matches any.
 *
 * Hardcoded `superadmin` always bypasses all permission and role checks automatically.
 */
const protect = (requiredAccess = []) => async (req, res, next) => {
  try {
    let token = req.cookies?.token;

    if (!token && req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({ success: false, message: "Not authorized, no token provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "default_jwt_secret_dev");
    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return res.status(401).json({ success: false, message: "User not found or account removed" });
    }

    const isSelfStatusRoute =
      req.path === "/me" ||
      req.path.includes("/join-request") ||
      req.path.includes("/notifications/subscribe") ||
      req.path.includes("/logout");

    if (user.status === "pending_approval" && !isSelfStatusRoute) {
      return res.status(403).json({
        success: false,
        code: "PENDING_APPROVAL",
        message: "Your application to join this workspace is awaiting admin approval.",
        publicId: user.publicId,
        status: user.status,
      });
    }

    if (user.status === "rejected") {
      return res.status(403).json({
        success: false,
        code: "APPLICATION_REJECTED",
        message: `Your application to join this workspace was declined: "${user.joinRequest?.rejectionReason || "Please contact administrator"}"`,
      });
    }

    if (user.isActive === false && user.status !== "pending_approval") {
      return res.status(403).json({
        success: false,
        code: "ACCOUNT_DEACTIVATED",
        message: "Your account is deactivated. Contact an administrator.",
      });
    }

    const access = await resolveUserAccess(user);
    user.role = access.role;
    user.modules = access.modules;
    user.permissions = access.permissions;
    user.isSuperAdmin = access.isSuperAdmin;
    user.roleDisplayName = access.roleDisplayName;

    // Superadmin has every module and action by default
    if (access.isSuperAdmin || isSuperAdminUser(user)) {
      req.user = user;
      return next();
    }

    const requirements = Array.isArray(requiredAccess)
      ? requiredAccess.filter(Boolean)
      : requiredAccess
      ? [requiredAccess]
      : [];

    if (requirements.length > 0) {
      const authorized = requirements.some((reqItem) => {
        if (reqItem.includes(".") || reqItem.includes("*") || reqItem.includes(":")) {
          return hasWildcardPermission(access.permissions, reqItem);
        }
        return access.role === reqItem.toLowerCase();
      });

      if (!authorized) {
        return res.status(403).json({
          success: false,
          code: "PERMISSION_DENIED",
          message: `Access denied. Requires: ${requirements.join(" or ")}`,
        });
      }
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("Auth Middleware Error:", error.message);
    res.status(401).json({ success: false, message: "Not authorized, invalid or expired session" });
  }
};

/**
 * Superadmin-Only Guard: Only the hardcoded `superadmin` role passes this gate.
 */
const requireSuperAdmin = async (req, res, next) => {
  return protect()(req, res, () => {
    if (!req.user?.isSuperAdmin && !isSuperAdminUser(req.user)) {
      return res.status(403).json({
        success: false,
        code: "SUPERADMIN_REQUIRED",
        message: "Restricted to Superadmin only.",
      });
    }
    return next();
  });
};

const authorize = (...rolesOrPerms) => protect(rolesOrPerms);

module.exports = { protect, authorize, requireSuperAdmin };
