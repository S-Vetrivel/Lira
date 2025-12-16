const User = require("../models/userModel");
const bcrypt = require("bcryptjs");

// --- Configuration: Country Digit Rules ---
// This matches your frontend configuration
const COUNTRY_RULES = {
  "+91": { country: "IN", digits: 10 },
  "+1": { country: "US", digits: 10 },
  "+44": { country: "UK", digits: 10 },
  "+61": { country: "AU", digits: 9 },
  "+81": { country: "JP", digits: 10 },
  "+49": { country: "DE", digits: 11 },
};

// --- Helper: Password Strength Validator ---
const isPasswordStrong = (password) => {
  // Regex: Min 8 chars, 1 Uppercase, 1 Lowercase, 1 Number, 1 Special Char
  const strongRegex = new RegExp(
    "^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])(?=.{8,})"
  );
  return strongRegex.test(password);
};

exports.PersonalInfo = async (req, res) => {
  try {
    const userId = req.user._id;

    // 1. Destructure Payload
    // Note: We expect 'countryCode' and 'phone' separately now for better validation
    const { fullName, countryCode, phone, password } = req.body;

    // 2. Find User
    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // --- 3. Update Full Name ---
    if (fullName && fullName.trim().length > 0) {
      user.fullname = fullName.trim();
    }

    // --- 4. Validate & Update Phone Number ---
    // Only proceed if both parts are present
    if (countryCode && phone) {
      // A. Check if Country Code is supported
      const countryRule = COUNTRY_RULES[countryCode];

      if (!countryRule) {
        return res.status(400).json({
          success: false,
          message: `Invalid or unsupported country code: ${countryCode}`,
        });
      }

      // B. Validate Digit Length
      // Remove any accidental spaces or dashes from the phone string
      const cleanPhone = phone.toString().replace(/\D/g, "");

      if (cleanPhone.length !== countryRule.digits) {
        return res.status(400).json({
          success: false,
          message: `Invalid phone format. ${countryRule.country} numbers must be exactly ${countryRule.digits} digits.`,
        });
      }

      // C. Save as combined string (e.g., "+91 9876543210")
      user.phone = `${countryCode} ${cleanPhone}`;
    }

    // --- 5. Validate & Update Password ---
    if (password && password.length > 0) {
      // A. Strength Check
      if (!isPasswordStrong(password)) {
        return res.status(400).json({
          success: false,
          message:
            "Password is too weak. Must contain 8+ characters, 1 uppercase, 1 lowercase, 1 number, and 1 special character.",
        });
      }

      // B. Hash Password
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(password, salt);
    }

    // 6. Save Changes
    const updatedUser = await user.save();

    // 7. Return Response (exclude password)
    const userResponse = updatedUser.toObject();
    delete userResponse.password;

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: userResponse,
    });
  } catch (error) {
    console.error("Update Profile Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};
