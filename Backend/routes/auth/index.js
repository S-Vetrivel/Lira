const express = require("express");
const router = express.Router();
const passport = require("passport");
const jwt = require("jsonwebtoken");
// Import your existing Login controller
const { Login } = require("./login");

// ==============================================
// 1. EMAIL & PASSWORD LOGIN
// ==============================================
router.post("/login", Login);

// ==============================================
// 2. GOOGLE OAUTH ROUTES
// ==============================================

// A. Trigger Route: Sends user to Google
router.get(
  "/google",
  passport.authenticate("google", {
    session: false,
    scope: ["profile", "email"],
  })
);

// B. Callback Route: Google sends user back here
router.get(
  "/google/callback",
  passport.authenticate("google", {
    session: false,
    scope: ["profile", "email"],
    failureRedirect: "http://localhost:3000/login", // Send back to frontend on fail
  }),
  (req, res) => {
    // --------------------------------------------------
    // JWT GENERATION (Unifies Google with your Manual Login)
    // --------------------------------------------------

    // 1. Create Token
    const token = jwt.sign({ id: req.user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    // 2. Set Cookie Options
    const options = {
      expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    };

    // 3. Send Cookie & Redirect to Frontend
    res.cookie("token", token, options);

    // CRITICAL: Redirect to your React App (Dashboard or Home)
    res.redirect("http://localhost:3000/");
  }
);

// ==============================================
// 3. LOGOUT ROUTE
// ==============================================
router.get("/logout", (req, res) => {
  res.clearCookie("token");
  res.status(200).json({ message: "Logged out successfully" });
});

module.exports = router;
