const express = require("express");
const router = express.Router();
const passport = require("passport");
const generateTokenAndSetCookie = require("../../utils/generateToken");
const { protect } = require("../../middleware/authMiddleware");
const { Login, Signup, Logout, Me, resetPassword } = require("./controllers");

// ==============================================
// 1. MANUAL AUTH ROUTES
// ==============================================
router.post("/signup", Signup);
router.post("/login", Login);
router.get("/logout", Logout);
router.get("/me", protect, Me);
router.post("/reset-password", resetPassword);

// ==============================================
// 2. GOOGLE OAUTH ROUTES
// ==============================================

// A. Trigger Route
router.get(
  "/google",
  passport.authenticate("google", {
    session: false,
    scope: ["profile", "email"],
  })
);

// B. Callback Route
router.get(
  "/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: `${process.env.CLIENT_URL}/login`, // Redirect to frontend login on fail
  }),
  (req, res) => {
    // req.user is populated by Passport strategy

    // 1. Use Utility to Set Cookie
    generateTokenAndSetCookie(res, req.user._id);

    // 2. Redirect to Frontend (Dashboard/Home)
    const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
    res.redirect(clientUrl);
  }
);

module.exports = router;
