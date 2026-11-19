const jwt = require("jsonwebtoken");
const User = require("../models/userModel");
const generateTokenAndSetCookie = require("../utils/generateToken");

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

    if (user.isActive === false) {
      return res.status(403).json({ success: false, message: "Your account is deactivated. Contact an administrator." });
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
