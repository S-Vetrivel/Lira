const User = require("../models/userModel");
const Task = require("../models/taskModel");
const Department = require("../models/departmentModel");
const bcrypt = require("bcryptjs");
const { isSuperAdminEmail } = require("../utils/roles");

// Get all team members with their open task count (for Team Directory)
exports.getTeamMembers = async (req, res) => {
  try {
    const users = await User.find({ isActive: true })
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

    const newUser = await User.create({
      fullname: fullname.trim(),
      email: cleanEmail,
      password: hashedPassword,
      role: userRole,
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
    await User.findByIdAndUpdate(id, { isActive: false });

    res.status(200).json({ success: true, message: "User deactivated successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
