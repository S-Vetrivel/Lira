const User = require("../models/userModel");
const Task = require("../models/taskModel");
const Department = require("../models/departmentModel");
const Project = require("../models/projectModel");
const bcrypt = require("bcryptjs");
const Role = require("../models/roleModel");
const { isSuperAdminEmail, isSuperAdminUser, hasWildcardPermission } = require("../utils/roles");
const { enqueueWebSocketEvent, enqueueEmailJob } = require("../services/queue");
const { sendPushToUser, sendPushToAdmins } = require("../services/pushService");
const { createNotification, notifyAdmins } = require("../utils/notificationHelper");

const ts = () => new Date().toISOString();

// Get team members with open tasks count (Admin can pass ?includeInactive=true for full user management)
exports.getTeamMembers = async (req, res) => {
  try {
    const includeInactive =
      req.query.includeInactive === "true" &&
      (req.user?.isSuperAdmin || req.user?.role === "admin" || hasWildcardPermission(req.user?.permissions, "team.edit"));
    const filter = includeInactive
      ? {}
      : { isActive: true, status: { $in: ["active", "away", "on_leave"] } };

    const users = await User.find(filter)
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
    const {
      fullname,
      email,
      password,
      role,
      department,
      departmentId,
      departmentName,
      jobTitle,
      phone,
    } = req.body;

    if (!fullname || !email) {
      return res.status(400).json({ success: false, message: "Fullname and email are required" });
    }

    const cleanEmail = email.toLowerCase().trim();
    const existing = await User.findOne({ email: cleanEmail });
    if (existing) {
      return res.status(400).json({ success: false, message: "User with this email already exists" });
    }

    let userRole = (role || "employee").toLowerCase().trim();
    if (isSuperAdminEmail(cleanEmail)) {
      userRole = "superadmin";
    } else if (userRole === "superadmin" && !req.user?.isSuperAdmin) {
      return res.status(403).json({ success: false, message: "Only Superadmin can assign the superadmin role" });
    }
    const roleDoc = await Role.findOne({ name: userRole }).select("_id").lean();

    const salt = await bcrypt.genSalt(10);
    const rawPassword = password && password.trim() ? password.trim() : "Lira@2026";
    const hashedPassword = await bcrypt.hash(rawPassword, salt);

    let deptId = department || departmentId;
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
      roleRef: roleDoc?._id || null,
      status: "active",
      isActive: true,
      department: deptId || null,
      departmentName: deptName || "General",
      jobTitle: jobTitle || "Team Member",
      ...(phone && phone.trim() ? { phone: phone.trim() } : {}),
      avatar: "",
    });

    const populated = await User.findById(newUser._id)
      .select("-password")
      .populate("department");

    await createNotification({
      recipient: newUser._id,
      sender: req.user._id,
      allowSelf: true,
      publicId,
      type: "system",
      title: "Welcome to Lira Workspace",
      message: `${req.user.fullname} created your workspace account (${userRole} • ${deptName || "General"}).`,
      alsoEmail: true,
      recipientEmail: cleanEmail,
      actionUrl: "/",
    });

    enqueueWebSocketEvent({
      target: "all",
      event: "team:updated",
      data: { action: "user_created", user: populated },
    });

    res.status(201).json({ success: true, user: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update user details (Admin or user updating own)
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { fullname, role, department, departmentName, jobTitle, phone, status, isActive, bio } = req.body;

    const canEditGovernance =
      req.user.isSuperAdmin ||
      req.user.role === "admin" ||
      hasWildcardPermission(req.user.permissions, "team.edit");

    // Only Admin / Superadmin / team.edit holders can change role or active status
    if ((role || isActive !== undefined) && !canEditGovernance) {
      return res.status(403).json({ success: false, message: "Only Administrators can modify user roles or active status" });
    }

    const updates = {};
    if (fullname) updates.fullname = fullname.trim();
    if (role) {
      const normalizedRole = role.trim().toLowerCase();
      if (normalizedRole === "superadmin" && !req.user.isSuperAdmin) {
        return res.status(403).json({ success: false, message: "Only Superadmin can assign the superadmin role" });
      }
      updates.role = normalizedRole;
      const roleDoc = await Role.findOne({ name: normalizedRole }).select("_id").lean();
      if (roleDoc) updates.roleRef = roleDoc._id;
    }
    if (department !== undefined) {
      updates.department = department || null;
      if (department) {
        const deptDoc = await Department.findById(department);
        if (deptDoc) updates.departmentName = deptDoc.name;
      } else {
        updates.departmentName = "General";
      }
    }
    if (departmentName) updates.departmentName = departmentName;
    if (jobTitle !== undefined) updates.jobTitle = jobTitle;
    if (phone !== undefined && phone.trim()) updates.phone = phone.trim();
    if (bio !== undefined) updates.bio = bio;
    if (status) updates.status = status;
    if (isActive !== undefined) updates.isActive = isActive;

    const user = await User.findByIdAndUpdate(id, updates, { new: true })
      .select("-password")
      .populate("department");

    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    if (req.user._id.toString() !== user._id.toString()) {
      await createNotification({
        recipient: user._id,
        sender: req.user._id,
        publicId: user.publicId,
        type: "system",
        title: "Account Updated",
        message: `${req.user.fullname} updated your account details (${user.role} • ${user.departmentName}).`,
        alsoEmail: true,
        recipientEmail: user.email,
        actionUrl: "/",
      });

      enqueueWebSocketEvent({
        target: "user",
        room: user._id.toString(),
        event: "rbac:user-updated",
        data: { userId: user._id },
      });
    }

    enqueueWebSocketEvent({
      target: "all",
      event: "team:updated",
      data: { action: "user_updated", userId: user._id },
    });

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

    const target = await User.findById(id).select("role isSuperAdmin");
    if (!target) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    if (isSuperAdminUser(target) && !req.user.isSuperAdmin) {
      return res.status(403).json({ success: false, message: "Cannot deactivate a Superadmin account" });
    }

    // Soft delete / deactivate
    await User.findByIdAndUpdate(id, { isActive: false, status: "away" });

    enqueueWebSocketEvent({
      target: "all",
      event: "team:updated",
      data: { action: "user_deactivated", userId: id },
    });

    res.status(200).json({ success: true, message: "User deactivated successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Superadmin only: Bulk remove all non-Superadmin user accounts cleanly with global realtime broadcast
exports.bulkRemoveNonSuperadmins = async (req, res) => {
  try {
    if (!req.user?.isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: "Only Superadmin may remove all non-Superadmin accounts",
      });
    }

    const candidates = await User.find({
      _id: { $ne: req.user._id },
      role: { $nin: ["superadmin", "super_admin"] },
      isSuperAdmin: { $ne: true },
    })
      .select("_id email fullname role")
      .lean();

    const targetIds = candidates
      .filter((u) => !isSuperAdminEmail(u.email) && !isSuperAdminUser(u))
      .map((u) => u._id);

    if (targetIds.length === 0) {
      return res.status(200).json({
        success: true,
        deletedCount: 0,
        message: "No non-Superadmin accounts found to remove.",
      });
    }

    const [delRes] = await Promise.all([
      User.deleteMany({ _id: { $in: targetIds } }),
      Project.updateMany({}, { $pull: { members: { $in: targetIds } } }),
      Department.updateMany({}, { $pull: { members: { $in: targetIds } } }),
    ]);

    await Promise.all([
      enqueueWebSocketEvent({
        target: "all",
        event: "team:updated",
        data: { action: "bulk_removed_non_superadmins", deletedCount: delRes.deletedCount || 0 },
      }),
      enqueueWebSocketEvent({
        target: "all",
        event: "project:updated",
        data: { action: "members_pruned" },
      }),
      enqueueWebSocketEvent({
        target: "all",
        event: "department:updated",
        data: { action: "members_pruned" },
      }),
    ]);

    res.status(200).json({
      success: true,
      deletedCount: delRes.deletedCount || 0,
      message: `Removed ${delRes.deletedCount || 0} non-Superadmin user accounts.`,
    });
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

    console.log(
      `[${ts()}] [JoinRequest] Submitted/Updated publicId=${user.publicId} email=${user.email} dept=${user.departmentName}`
    );

    // 1. Notify all Admins via Notification Queue + WebSocket + Email Queue
    await notifyAdmins({
      sender: user._id,
      publicId: user.publicId,
      type: "approval_request",
      title: `New Join Request (${user.publicId})`,
      message: `${user.fullname} (${user.publicId}) requested to join ${user.departmentName}.`,
      emailType: "join_request_new",
      emailData: {
        applicantName: user.fullname,
        applicantEmail: user.email,
        publicId: user.publicId,
        departmentName: user.departmentName,
      },
    });

    // 2. Broadcast real-time update to all Admins
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

    user.role = (role || user.joinRequest?.requestedRole || "employee").toLowerCase().trim();
    const matchedRole = await Role.findOne({ name: user.role }).select("_id").lean();
    if (matchedRole) user.roleRef = matchedRole._id;
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

    // 1. In-App Notification + WebSocket via Notification Queue
    await createNotification({
      recipient: user._id,
      sender: req.user._id,
      publicId: user.publicId,
      type: "approval_request",
      title: `Approved (${user.publicId})`,
      message: `🎉 Your application to join ${targetDeptName} has been approved by ${req.user.fullname}! Welcome to Lira Workspace.`,
    });

    // 1b. Decision Email via Email Queue
    if (user.email) {
      enqueueEmailJob({
        to: user.email,
        type: "join_request_decision",
        data: {
          publicId: user.publicId,
          decision: "Approved",
          departmentName: targetDeptName,
        },
      });
    }

    console.log(
      `[${ts()}] [JoinRequest] Approved publicId=${user.publicId} user=${user.email} by=${req.user.email}`
    );

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

    // 1. In-App Notification + Email Queue
    await createNotification({
      recipient: user._id,
      sender: req.user._id,
      publicId: user.publicId,
      type: "approval_request",
      title: `Application Declined (${user.publicId})`,
      message: `Your request (${user.publicId}) was declined: "${user.joinRequest.rejectionReason}"`,
    });

    if (user.email) {
      enqueueEmailJob({
        to: user.email,
        type: "join_request_decision",
        data: {
          publicId: user.publicId,
          decision: "Declined",
          reason: user.joinRequest.rejectionReason,
        },
      });
    }

    console.log(
      `[${ts()}] [JoinRequest] Rejected publicId=${user.publicId} user=${user.email} by=${req.user.email}`
    );

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
