const jwt = require("jsonwebtoken");
const { getJwtSecret } = require("./envSecrets");

const generateTokenAndSetCookie = (res, userId) => {
  // 1. Generate Token
  const token = jwt.sign({ id: userId }, getJwtSecret(), {
    expiresIn: "7d",
  });

  // 2. Cookie Options
  const isProd = process.env.NODE_ENV === "production";
  const options = {
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    httpOnly: true, // Security: JS cannot read this
    secure: isProd, // HTTPS only in prod
    sameSite: isProd ? "none" : "lax", // Lax for dev top-level OAuth navigation; none for cross-site prod
  };

  // 3. Set Cookie
  res.cookie("token", token, options);

  return token;
};

module.exports = generateTokenAndSetCookie;
