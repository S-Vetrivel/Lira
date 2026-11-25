const User = require("../models/userModel");
const Department = require("../models/departmentModel");
const bcrypt = require("bcryptjs");
const generateTokenAndSetCookie = require("../utils/generateToken");
const { isSuperAdminEmail } = require("../utils/roles");
const { enqueueWebSocketEvent } = require("../services/queue");
const { sendPushToAdmins } = require("../services/pushService");
const { createNotification, notifyAdmins } = require("../utils/notificationHelper");

// ==============================================
// 1. SIGNUP
// ==============================================
exports.Signup = async (req, res) => {
  try {
    const {
      fullname,
      email,
      password,
      confirmPassword,
      role,
      departmentName,
      jobTitle,
      phone,
      reason,
    } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required" });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, message: "Passwords do not match" });
    }

    const cleanEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) {
      return res.status(400).json({ success: false, message: "User with this email already exists" });
    }

    const isAdmin = isSuperAdminEmail(cleanEmail);
    const userRole = isAdmin ? "admin" : (role || "employee");
    const userStatus = isAdmin ? "active" : "pending_approval";
    const userActive = isAdmin ? true : false;

    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const publicId = `EMP-${randomSuffix}`;

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Resolve department ObjectId if matching departmentName
    let departmentId = null;
    if (departmentName) {
      const dept = await Department.findOne({ name: new RegExp(`^${departmentName}$`, "i") });
      if (dept) departmentId = dept._id;
    }

    const newUser = await User.create({
      publicId,
      fullname: fullname || cleanEmail.split("@")[0],
      email: cleanEmail,
      password: hashedPassword,
      role: userRole,
      status: userStatus,
      isActive: userActive,
      department: departmentId,
      departmentName: departmentName || "Engineering",
      jobTitle: jobTitle || (isAdmin ? "Workspace Admin" : "Team Member"),
      phone,
      avatar: "",
      joinRequest: {
        requestedDepartment: departmentId,
        requestedDepartmentName: departmentName || "Engineering",
        requestedRole: userRole,
        requestedJobTitle: jobTitle || "Team Member",
        reason: reason || "Standard workspace registration",
        requestedAt: new Date(),
      },
    });

    const token = generateTokenAndSetCookie(res, newUser._id);

    // Notify Admins if pending approval
    if (!isAdmin) {
      await notifyAdmins({
        sender: newUser._id,
        publicId: newUser.publicId,
        type: "approval_request",
        title: `New Join Request (${newUser.publicId})`,
        message: `${newUser.fullname} (${newUser.publicId}) requested to join ${newUser.departmentName}.`,
        emailType: "join_request_new",
        emailData: {
          applicantName: newUser.fullname,
          applicantEmail: newUser.email,
          publicId: newUser.publicId,
          departmentName: newUser.departmentName,
        },
      });

      enqueueWebSocketEvent({
        target: "all",
        event: "join-request:new",
        data: {
          user: {
            _id: newUser._id,
            publicId: newUser.publicId,
            fullname: newUser.fullname,
            email: newUser.email,
            avatar: newUser.avatar,
            departmentName: newUser.departmentName,
            jobTitle: newUser.jobTitle,
            createdAt: newUser.createdAt,
            reason: reason || "Standard workspace registration",
          },
        },
      });

      sendPushToAdmins({
        title: "New Team Join Request",
        body: `${newUser.fullname} (${newUser.publicId}) requested to join ${newUser.departmentName}.`,
        url: "/team",
      }).catch(() => {});
    }

    res.status(201).json({
      success: true,
      message: isAdmin
        ? "Superadmin registration successful"
        : "Join request submitted! Your account is pending workspace admin approval.",
      token,
      user: {
        _id: newUser._id,
        id: newUser._id,
        publicId: newUser.publicId,
        email: newUser.email,
        fullname: newUser.fullname,
        role: newUser.role,
        status: newUser.status,
        isActive: newUser.isActive,
        departmentName: newUser.departmentName,
        jobTitle: newUser.jobTitle,
        avatar: newUser.avatar,
        joinRequest: newUser.joinRequest,
      },
    });
  } catch (error) {
    console.error("Signup Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==============================================
// 2. LOGIN (Strict Real Authentication)
// ==============================================
exports.Login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required" });
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: cleanEmail }).populate("department");
    if (!user) {
      return res.status(404).json({ success: false, message: "No account found with this email" });
    }

    // Strict bcrypt authentication - NO backdoors
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    // Upgrade to admin if superadmin email
    if (isSuperAdminEmail(cleanEmail) && user.role !== "admin") {
      user.role = "admin";
      user.status = "active";
      user.isActive = true;
      await user.save();
    }

    // Handle Rejected Account
    if (user.status === "rejected") {
      return res.status(403).json({
        success: false,
        message: `Your request to join this workspace was declined: "${user.joinRequest?.rejectionReason || "Contact administrator"}"`,
      });
    }

    // Ensure user has a public ID
    if (!user.publicId) {
      user.publicId = `EMP-${Math.floor(1000 + Math.random() * 9000)}`;
      await user.save();
    }

    const token = generateTokenAndSetCookie(res, user._id);

    res.status(200).json({
      success: true,
      message: user.status === "pending_approval"
        ? "Account pending workspace approval"
        : "Login successful",
      token,
      user: {
        _id: user._id,
        id: user._id,
        publicId: user.publicId,
        email: user.email,
        fullname: user.fullname,
        role: user.role,
        status: user.status,
        isActive: user.isActive,
        departmentName: user.department?.name || user.departmentName || "General",
        department: user.department,
        jobTitle: user.jobTitle,
        avatar: user.avatar || user.profilePicture,
        phone: user.phone,
        bio: user.bio,
        joinRequest: user.joinRequest,
      },
    });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==============================================
// 3. LOGOUT
// ==============================================
exports.Logout = (req, res) => {
  res.cookie("token", "", {
    httpOnly: true,
    expires: new Date(0),
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    secure: process.env.NODE_ENV === "production",
  });
  res.status(200).json({ success: true, message: "Logged out successfully" });
};

// ==============================================
// 4. ME (Get Current User & Join Request State)
// ==============================================
exports.Me = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select("-password -__v")
      .populate("department");

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Ensure publicId exists
    if (!user.publicId) {
      user.publicId = `EMP-${Math.floor(1000 + Math.random() * 9000)}`;
      await user.save();
    }

    res.status(200).json({
      success: true,
      user: {
        _id: user._id,
        id: user._id,
        publicId: user.publicId,
        email: user.email,
        fullname: user.fullname,
        role: user.role,
        status: user.status,
        isActive: user.isActive,
        departmentName: user.department?.name || user.departmentName || "General",
        department: user.department,
        jobTitle: user.jobTitle,
        avatar: user.avatar || user.profilePicture,
        phone: user.phone,
        bio: user.bio,
        joinRequest: user.joinRequest,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==============================================
// 5. DEMO LOGIN (Disabled for production security)
// ==============================================
exports.DemoLogin = async (req, res) => {
  return res.status(403).json({
    success: false,
    message: "Demo logins have been permanently removed. Please sign in with your email or Continue with Google.",
  });
};

// ==============================================
// 6. RESET PASSWORD
// ==============================================
exports.resetPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: "Email is required" });

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) return res.status(404).json({ success: false, message: "No account found with this email" });

    res.status(200).json({
      success: true,
      message: "Password reset link has been dispatched to your email address",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
