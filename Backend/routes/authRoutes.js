const express = require("express");
const router = express.Router();
const passport = require("passport");
const { OAuth2Client } = require("google-auth-library");
const generateTokenAndSetCookie = require("../utils/generateToken");
const { protect } = require("../middleware/authMiddleware");
const {
  Login,
  Signup,
  Logout,
  Me,
  DemoLogin,
  resetPassword,
} = require("../controllers/authControllers");
const { findOrCreateGoogleUser } = require("../services/authService");

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// 1. Manual Auth Routes
router.post("/signup", Signup);
router.post("/login", Login);
router.get("/logout", Logout);
router.get("/me", protect(), Me);
router.post("/demo-login", DemoLogin);
router.post("/reset-password", resetPassword);

// 2. Google OAuth Routes (Standard Redirect)
router.get("/google", (req, res, next) => {
  const returnUrl =
    req.query.returnUrl ||
    req.headers.referer ||
    process.env.FRONTEND_URL ||
    "http://localhost:5173";

  const state = Buffer.from(JSON.stringify({ returnUrl })).toString("base64");

  passport.authenticate("google", {
    session: false,
    scope: ["profile", "email"],
    state,
  })(req, res, next);
});

router.get(
  "/google/callback",
  (req, res, next) => {
    let failUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    if (req.query.state) {
      try {
        const parsed = JSON.parse(Buffer.from(req.query.state, "base64").toString("utf-8"));
        if (parsed.returnUrl) failUrl = parsed.returnUrl;
      } catch (e) {}
    }
    const cleanFail = failUrl.split("?")[0].replace(/\/$/, "");

    passport.authenticate("google", {
      session: false,
      failureRedirect: `${cleanFail}/login?error=google_failed`,
    })(req, res, next);
  },
  (req, res) => {
    const token = generateTokenAndSetCookie(res, req.user._id);

    let returnUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    if (req.query.state) {
      try {
        const parsed = JSON.parse(Buffer.from(req.query.state, "base64").toString("utf-8"));
        if (parsed.returnUrl) returnUrl = parsed.returnUrl;
      } catch (e) {}
    }

    const cleanBase = returnUrl.split("?")[0].replace(/\/$/, "");
    const isPending = req.user?.status === "pending_approval";
    const targetPath = isPending ? "/join-request" : "/";
    const targetUrl = `${cleanBase}${targetPath}`;
    res.redirect(`${targetUrl}?token=${token}&google_auth=success`);
  }
);

// 3. Google One Tap Route
router.post("/google/onetap", async (req, res) => {
  const { token } = req.body;

  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const user = await findOrCreateGoogleUser(payload);
    const jwtToken = generateTokenAndSetCookie(res, user._id);

    res.status(200).json({
      success: true,
      token: jwtToken,
      user: {
        _id: user._id,
        id: user._id,
        email: user.email,
        fullname: user.fullname,
        role: user.role,
        departmentName: user.departmentName || "General",
        jobTitle: user.jobTitle,
        avatar: user.avatar || user.profilePicture,
      },
      message: "Google One Tap Login Successful",
    });
  } catch (error) {
    console.error("One Tap Error:", error);
    res.status(401).json({ success: false, message: "Invalid Google Token" });
  }
});

module.exports = router;
