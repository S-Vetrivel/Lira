const User = require("../../models/userModal");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

exports.Login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ message: "Missing fields" });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ message: "Invalid credentials" });

    // 1. Generate the Token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    // 2. Set the Cookie Options
    const options = {
      expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      httpOnly: true, // Security: JS cannot read this cookie
      secure: process.env.NODE_ENV === "production", // Security: HTTPS only in Prod
      sameSite: "strict", // Security: CSRF protection
    };

    // 3. Send the Cookie + Response
    res
      .status(200)
      .cookie("token", token, options) // <--- Set the cookie here
      .json({
        message: "Login successful",
        // Note: We do NOT send the token in JSON anymore
        user: {
          id: user._id,
          email: user.email,
          name: user.name, // Good to have for the UI
        },
      });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
