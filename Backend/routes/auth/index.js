const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
  res.json({
    message: "Auth area — access granted",
    admin: req.user.fullname,
    role: req.user.role,
  });
});

module.exports = router;
