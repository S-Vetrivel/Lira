const User = require("../models/userModel");
const bcrypt = require("bcryptjs");
const minioService = require("../services/minioService");

// Helper: Indian Phone Validator (10 digits starting with 6-9, optionally prefixed with 91)
const normalizeIndianPhone = (raw) => {
  const digits = raw.toString().replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) {
    return digits.slice(2);
  }
  return digits;
};

const isValidIndianPhone = (phone) => /^[6-9]\d{9}$/.test(phone);

const sanitizeUser = (userDoc) => {
  const obj = userDoc.toObject ? userDoc.toObject() : { ...userDoc };
  delete obj.password;
  delete obj.__v;
  obj.id = obj._id;
  obj.departmentName = obj.department?.name || obj.departmentName || "General";
  obj.avatar = obj.avatar || obj.profilePicture || "";
  return obj;
};

// 1. Personal Info Update
exports.PersonalInfo = async (req, res) => {
  try {
    const userId = req.user._id;
    const { fullName, fullname, phone, jobTitle, bio, password } = req.body;

    const user = await User.findById(userId).populate("department");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const nextName = (fullname || fullName || "").trim();
    if (nextName) {
      user.fullname = nextName;
    }

    if (jobTitle !== undefined) {
      user.jobTitle = jobTitle.trim() || user.jobTitle;
    }

    if (bio !== undefined) {
      user.bio = bio.trim();
    }

    if (phone !== undefined) {
      const trimmed = String(phone).trim();
      if (trimmed === "") {
        user.phone = "";
      } else {
        const cleanPhone = normalizeIndianPhone(trimmed);
        if (!isValidIndianPhone(cleanPhone)) {
          return res.status(400).json({
            success: false,
            message: "Invalid Indian mobile number. Enter 10 digits starting with 6-9.",
          });
        }
        user.phone = cleanPhone;
      }
    }

    if (password && password.trim().length > 0) {
      if (password.trim().length < 6) {
        return res.status(400).json({
          success: false,
          message: "Password must be at least 6 characters long.",
        });
      }
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(password.trim(), salt);
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error("Update Profile Error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to update profile",
    });
  }
};

// 2. Custom Profile Picture Upload
exports.uploadProfilePicture = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No image uploaded" });
    }

    const user = await User.findById(req.user._id).populate("department");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const avatarUrl = `/v3/uploads/avatars/${req.file.filename}`;
    user.avatar = avatarUrl;
    user.profilePicture = avatarUrl;
    await user.save();

    // Non-blocking backup to MinIO if available
    minioService
      .uploadFile(`avatars/${req.file.filename}`, req.file.path, req.file.mimetype)
      .catch(() => {});

    res.status(200).json({
      success: true,
      message: "Profile photo updated!",
      avatar: avatarUrl,
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error("Profile Upload Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
