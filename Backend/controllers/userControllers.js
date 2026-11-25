const User = require("../models/userModel");
const Task = require("../models/taskModel");
const Department = require("../models/departmentModel");
const bcrypt = require("bcryptjs");
const { isSuperAdminEmail } = require("../utils/roles");
const { enqueueWebSocketEvent } = require("../services/queue");
const { sendPushToUser, sendPushToAdmins } = require("../services/pushService");
const { createNotification } = require("../utils/notificationHelper");

// Get all active team members with open tasks count (for Team Directory)
exports.getTeamMembers = async (req, res) => {
  try {
    const users = await User.find({ isActive: true, status: "active" })
      .select("-password")
      .populate("department", "name code color")
      .sort({ fullname: 1 })
      .lean();

    // Calculate open tasks count for each employee
    const usersWithTaskCount = await Promise.all(
      users.map(async (user) => {
        const openTasksCount = await Task.countDocuments({
          assignee: user._id,
          status: { $ne: "done" },
        });

        const completedTasksCount = await Task.countDocuments({
          assignee: user._id,
          status: "done",
        });

        return {
          ...user,
          openTasksCount,
          completedTasksCount,
        };
      })
    );

    res.status(200).json({ success: true, count: usersWithTaskCount.length, members: usersWithTaskCount });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create new user account (Admin only)
exports.createUser = async (req, res) => {
  try {
    const { fullname, email, password, role, department, departmentName, jobTitle, phone } = req.body;

    if (!fullname || !email || !password) {
      return res.status(400).json({ success: false, message: "Fullname, email, and password are required" });
    }

    const cleanEmail = email.toLowerCase().trim();
    const existing = await User.findOne({ email: cleanEmail });
    if (existing) {
      return res.status(400).json({ success: false, message: "User with this email already exists" });
    }

    let userRole = role || "employee";
    if (isSuperAdminEmail(cleanEmail)) {
      userRole = "admin";
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    let deptId = department;
    let deptName = departmentName;

    if (deptId) {
      const dept = await Department.findById(deptId);
      if (dept) deptName = dept.name;
    }

    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const publicId = `EMP-${randomSuffix}`;

    const newUser = await User.create({
      publicId,
      fullname: fullname.trim(),
      email: cleanEmail,
      password: hashedPassword,
      role: userRole,
      status: "active",
      isActive: true,
      department: deptId || null,
      departmentName: deptName || "General",
      jobTitle: jobTitle || "Team Member",
      phone: phone || "",
      avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(fullname)}`,
    });

    const populated = await User.findById(newUser._id)
      .select("-password")
      .populate("department");

    res.status(201).json({ success: true, user: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update user details (Admin or user updating own)
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { fullname, role, department, departmentName, jobTitle, phone, status, isActive } = req.body;

    // Only Admin can change role or active status
    if ((role || isActive !== undefined) && req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Only Admins can modify user roles or active status" });
    }

    const updates = {};
    if (fullname) updates.fullname = fullname.trim();
    if (role) updates.role = role;
    if (department !== undefined) updates.department = department || null;
    if (departmentName) updates.departmentName = departmentName;
    if (jobTitle) updates.jobTitle = jobTitle;
    if (phone !== undefined) updates.phone = phone;
    if (status) updates.status = status;
    if (isActive !== undefined) updates.isActive = isActive;

    const user = await User.findByIdAndUpdate(id, updates, { new: true })
      .select("-password")
      .populate("department");

    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    res.status(200).json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete user account (Admin only)
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (id === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: "Cannot delete your own admin account" });
    }

    // Soft delete / deactivate
    await User.findByIdAndUpdate(id, { isActive: false, status: "away" });

    res.status(200).json({ success: true, message: "User deactivated successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==============================================
// JOIN TEAM REQUEST WORKFLOW & FOLLOW TRACKING
// ==============================================

// 1. Candidate checks self join request status
exports.getJoinRequestStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select("publicId fullname email avatar role status isActive departmentName jobTitle joinRequest createdAt")
      .populate("joinRequest.requestedDepartment", "name code color");

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.status(200).json({
      success: true,
      user,
      status: user.status,
      publicId: user.publicId,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 2. Candidate submits / updates their join request onboarding
exports.submitJoinRequest = async (req, res) => {
  try {
    const { departmentName, jobTitle, reason } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    let deptId = null;
    if (departmentName) {
      const dept = await Department.findOne({ name: new RegExp(`^${departmentName}$`, "i") });
      if (dept) deptId = dept._id;
    }

    user.departmentName = departmentName || user.departmentName || "Engineering";
    user.department = deptId || user.department;
    user.jobTitle = jobTitle || user.jobTitle || "Team Member";
    user.status = "pending_approval";
    user.isActive = false;

    user.joinRequest = {
      requestedDepartment: deptId,
      requestedDepartmentName: user.departmentName,
      requestedRole: "employee",
      requestedJobTitle: user.jobTitle,
      reason: reason || "Joining workspace team",
      requestedAt: new Date(),
    };

    await user.save();

    // Broadcast real-time update to all Admins
    enqueueWebSocketEvent({
      target: "all",
      event: "join-request:new",
      data: {
        user: {
          _id: user._id,
          publicId: user.publicId,
          fullname: user.fullname,
          email: user.email,
          avatar: user.avatar,
          departmentName: user.departmentName,
          jobTitle: user.jobTitle,
          reason: user.joinRequest.reason,
          requestedAt: user.joinRequest.requestedAt,
        },
      },
    });

    sendPushToAdmins({
      title: "New Team Join Request",
      body: `${user.fullname} (${user.publicId}) requested to join ${user.departmentName}.`,
      url: "/team",
    }).catch(() => {});

    res.status(200).json({
      success: true,
      message: "Join request submitted! Awaiting administrator approval.",
      user,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 3. Admin: Get all pending join requests
exports.getPendingJoinRequests = async (req, res) => {
  try {
    const pendingUsers = await User.find({ status: "pending_approval" })
      .select("publicId fullname email avatar role status isActive departmentName jobTitle joinRequest createdAt")
      .populate("joinRequest.requestedDepartment", "name code color")
      .sort({ "joinRequest.requestedAt": -1, createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: pendingUsers.length,
      requests: pendingUsers,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 4. Admin: Approve join request
exports.approveJoinRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, departmentName, jobTitle } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    let deptId = user.joinRequest?.requestedDepartment || user.department;
    let targetDeptName = departmentName || user.joinRequest?.requestedDepartmentName || user.departmentName || "Engineering";

    if (departmentName) {
      const dept = await Department.findOne({ name: new RegExp(`^${departmentName}$`, "i") });
      if (dept) {
        deptId = dept._id;
        targetDeptName = dept.name;
      }
    }

    user.role = role || user.joinRequest?.requestedRole || "employee";
    user.status = "active";
    user.isActive = true;
    user.department = deptId;
    user.departmentName = targetDeptName;
    user.jobTitle = jobTitle || user.joinRequest?.requestedJobTitle || user.jobTitle || "Team Member";

    if (!user.joinRequest) user.joinRequest = {};
    user.joinRequest.reviewedBy = req.user._id;
    user.joinRequest.reviewedAt = new Date();
    user.joinRequest.rejectionReason = "";

    await user.save();

    // 1. In-App Notification
    await createNotification({
      recipient: user._id,
      sender: req.user._id,
      type: "approval_request",
      message: `🎉 Your application to join ${targetDeptName} has been approved by ${req.user.fullname}! Welcome to Lira Workspace.`,
    });

    // 2. Real-time WebSocket event to candidate user channel and publicId channel
    enqueueWebSocketEvent({
      target: "user",
      room: user._id.toString(),
      event: "user:approved",
      data: {
        userId: user._id,
        publicId: user.publicId,
        status: "active",
        role: user.role,
        departmentName: user.departmentName,
        jobTitle: user.jobTitle,
        message: "Your application has been approved!",
      },
    });

    if (user.publicId) {
      enqueueWebSocketEvent({
        target: "all",
        event: `join-request:${user.publicId}:approved`,
        data: {
          publicId: user.publicId,
          status: "active",
        },
      });
    }

    // 3. Real-time Web Push Notification directly to device
    sendPushToUser(user._id, {
      title: "🎉 Application Approved!",
      message: `Welcome to the team! Your application to join ${targetDeptName} has been approved.`,
      url: "/",
    }).catch(() => {});

    // 4. Broadcast update to all admins
    enqueueWebSocketEvent({
      target: "all",
      event: "join-request:updated",
      data: { userId: user._id, status: "active", publicId: user.publicId },
    });

    res.status(200).json({
      success: true,
      message: `User ${user.fullname} (${user.publicId}) approved successfully!`,
      user,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 5. Admin: Reject join request
exports.rejectJoinRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    user.status = "rejected";
    user.isActive = false;
    if (!user.joinRequest) user.joinRequest = {};
    user.joinRequest.reviewedBy = req.user._id;
    user.joinRequest.reviewedAt = new Date();
    user.joinRequest.rejectionReason = reason || "Declined by workspace admin";

    await user.save();

    // Notify user via WebSocket
    enqueueWebSocketEvent({
      target: "user",
      room: user._id.toString(),
      event: "user:rejected",
      data: {
        userId: user._id,
        publicId: user.publicId,
        status: "rejected",
        reason: user.joinRequest.rejectionReason,
      },
    });

    sendPushToUser(user._id, {
      title: "Team Application Update",
      message: `Your request was not approved: "${user.joinRequest.rejectionReason}"`,
      url: "/login",
    }).catch(() => {});

    enqueueWebSocketEvent({
      target: "all",
      event: "join-request:updated",
      data: { userId: user._id, status: "rejected", publicId: user.publicId },
    });

    res.status(200).json({
      success: true,
      message: `Request for ${user.fullname} rejected`,
      user,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
