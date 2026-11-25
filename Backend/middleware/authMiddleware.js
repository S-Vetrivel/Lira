const jwt = require("jsonwebtoken");
const User = require("../models/userModel");

const protect = (allowedRoles = []) => async (req, res, next) => {
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

    // Allow user to check self state and submit join-team onboarding even if pending
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

    // Role checks if specified
    if (allowedRoles.length > 0) {
      if (!allowedRoles.includes(user.role) && user.role !== "admin") {
        return res.status(403).json({
          success: false,
          message: `Access denied. Requires one of: ${allowedRoles.join(", ")}`,
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

const authorize = (...roles) => protect(roles);

module.exports = { protect, authorize };
