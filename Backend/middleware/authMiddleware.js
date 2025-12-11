const jwt = require("jsonwebtoken");
const User = require("../models/User");

const protect = async (req, res, next) => {
  let token;

  // Read the JWT from the cookie
  token = req.cookies.jwt;

  if (token) {
    try {
      // 1. Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // 2. Find user in DB (and exclude password)
      req.user = await User.findById(decoded.id).select("-password");

      next(); // Proceed
    } catch (error) {
      res.status(401).json({ message: "Not authorized, token failed" });
    }
  } else {
    res.status(401).json({ message: "Not authorized, no token" });
  }
};

module.exports = { protect };
