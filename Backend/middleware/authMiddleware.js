const jwt = require("jsonwebtoken");
const User = require("../models/userModal"); // Check spelling: userModal vs userModel
const generateTokenAndSetCookie = require("../utils/generateToken"); // <--- Import this

const protect = async (req, res, next) => {
  try {
    // 1. Read token from cookie
    const token = req.cookies.token;

    if (!token) {
      return res.status(401).json({ message: "Not authorized, no token" });
    }

    // 2. Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 3. Find user
    req.user = await User.findById(decoded.id).select("-password");

    if (!req.user) {
      return res.status(401).json({ message: "User not found" });
    }

    // ============================================================
    // 4. ROLLING SESSION / AUTO-REFRESH
    // ============================================================
    // Logic: If the token expires in < 7 days, give them a fresh 7 days.

    const nowInSeconds = Math.floor(Date.now() / 1000);
    const sevenDaysInSeconds = 7 * 24 * 60 * 60;
    const timeRemaining = decoded.exp - nowInSeconds;

    // Optional: You can set a threshold (e.g., only refresh if < 6 days left)
    // to prevent refreshing on literally every click.
    // But per your request (<= 7 days), we refresh if it's valid.
    if (timeRemaining < sevenDaysInSeconds) {
      generateTokenAndSetCookie(res, req.user._id);
      // console.log("♻️ Token refreshed for rolling session");
    }

    next();
  } catch (error) {
    console.error("Auth Middleware Error:", error.message);
    res.status(401).json({ message: "Not authorized, invalid token" });
  }
};

module.exports = { protect };
