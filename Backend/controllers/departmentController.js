const Department = require("../models/departmentModel");
const User = require("../models/userModel");
const Project = require("../models/projectModel");
const { createNotification, notifyUsers } = require("../utils/notificationHelper");
const { enqueueWebSocketEvent } = require("../services/queue");

const MEMBER_FIELDS = "fullname email avatar profilePicture role jobTitle departmentName publicId status isActive phone";

const enrichDepartment = async (deptDoc) => {
  if (!deptDoc) return null;
  const plain = deptDoc.toObject ? deptDoc.toObject() : deptDoc;
  const [members, projectsCount] = await Promise.all([
    User.find({
      isActive: true,
      $or: [{ department: plain._id }, { departmentName: plain.name }],
    })
      .select(MEMBER_FIELDS)
      .sort({ fullname: 1 })
      .lean(),
    Project.countDocuments({
      $or: [{ department: plain._id }, { departments: plain._id }],
    }),
  ]);
  return {
    ...plain,
    members,
    membersCount: members.length,
    projectsCount,
  };
};

// Get all departments with populated members & project counts
exports.getDepartments = async (req, res) => {
  try {
    const departments = await Department.find()
      .populate("lead", MEMBER_FIELDS)
      .sort({ name: 1 })
      .lean();

    const departmentsWithDetails = await Promise.all(departments.map(enrichDepartment));
    res.status(200).json({ success: true, departments: departmentsWithDetails });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create department (with optional initial members list & notifications/email)
exports.createDepartment = async (req, res) => {
  try {
    const { name, code, description, color, lead, members = [] } = req.body;

    if (!name || !code) {
      return res.status(400).json({ success: false, message: "Name and Code are required" });
    }

    const cleanCode = code.toUpperCase().trim();
    const existing = await Department.findOne({
      $or: [{ code: cleanCode }, { name: name.trim() }],
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Department with this name or code already exists",
      });
    }

    const dept = await Department.create({
      name: name.trim(),
      code: cleanCode,
      description: description || "",
      color: color || "#3B82F6",
      lead: lead || req.user._id,
    });

    const initialMemberIds = Array.from(
      new Set([
        ...(Array.isArray(members) ? members.filter(Boolean).map(String) : []),
        ...(lead ? [lead.toString()] : []),
      ])
    );

    if (initialMemberIds.length > 0) {
      await User.updateMany(
        { _id: { $in: initialMemberIds } },
        { department: dept._id, departmentName: dept.name }
      );
      await notifyUsers({
        recipients: initialMemberIds,
        sender: req.user._id,
        publicId: req.user?.publicId,
        type: "department_update",
        title: "Assigned to New Department",
        message: `${req.user.fullname} created the ${dept.name} (${dept.code}) department and assigned you to it.`,
        alsoEmail: true,
        actionUrl: "/projects",
      });
    }

    await enqueueWebSocketEvent({
      target: "all",
      event: "department:updated",
      data: { action: "created", departmentId: dept._id },
    });

    const populated = await Department.findById(dept._id).populate("lead", MEMBER_FIELDS).lean();
    const enriched = await enrichDepartment(populated);
    res.status(201).json({ success: true, department: enriched });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update department (name, code, description, color, lead)
exports.updateDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, description, color, lead } = req.body;

    const existingDept = await Department.findById(id);
    if (!existingDept) {
      return res.status(404).json({ success: false, message: "Department not found" });
    }
    const prevLead = existingDept.lead?.toString();

    const updates = {};
    if (name !== undefined && name.trim()) updates.name = name.trim();
    if (code !== undefined && code.trim()) {
      const cleanCode = code.toUpperCase().trim();
      const dup = await Department.findOne({ code: cleanCode, _id: { $ne: id } });
      if (dup) {
        return res.status(400).json({ success: false, message: `Department code '${cleanCode}' is already in use` });
      }
      updates.code = cleanCode;
    }
    if (description !== undefined) updates.description = description;
    if (color !== undefined) updates.color = color;
    if (lead !== undefined) updates.lead = lead || null;

    const dept = await Department.findByIdAndUpdate(id, updates, { new: true })
      .populate("lead", MEMBER_FIELDS)
      .lean();

    if (updates.name) {
      await User.updateMany({ department: dept._id }, { departmentName: updates.name });
    }

    if (lead && lead.toString() !== prevLead && lead.toString() !== req.user._id.toString()) {
      await createNotification({
        recipient: lead,
        sender: req.user._id,
        publicId: req.user?.publicId,
        type: "department_update",
        title: "Appointed Department Lead",
        message: `${req.user.fullname} appointed you as lead of the ${dept.name} department.`,
        alsoEmail: true,
        actionUrl: "/projects",
      });
    }

    await enqueueWebSocketEvent({
      target: "all",
      event: "department:updated",
      data: { action: "updated", departmentId: dept._id },
    });

    const enriched = await enrichDepartment(dept);
    res.status(200).json({ success: true, department: enriched });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete department
exports.deleteDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    await User.updateMany({ department: id }, { department: null, departmentName: "General" });
    await Department.findByIdAndDelete(id);
    res.status(200).json({ success: true, message: "Department deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Assign staff member to department
exports.addDepartmentMember = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, jobTitle } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: "userId is required" });
    }

    const dept = await Department.findById(id);
    if (!dept) {
      return res.status(404).json({ success: false, message: "Department not found" });
    }

    const userUpdates = {
      department: dept._id,
      departmentName: dept.name,
    };
    if (jobTitle && jobTitle.trim()) {
      userUpdates.jobTitle = jobTitle.trim();
    }

    const updatedUser = await User.findByIdAndUpdate(userId, userUpdates, { new: true })
      .select(MEMBER_FIELDS);

    if (!updatedUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    await createNotification({
      recipient: updatedUser._id,
      sender: req.user._id,
      publicId: updatedUser.publicId,
      type: "department_update",
      title: "Department Assignment",
      message: `${req.user.fullname} assigned you to the ${dept.name} department.`,
      alsoEmail: true,
      recipientEmail: updatedUser.email,
      actionUrl: "/projects",
    });

    await enqueueWebSocketEvent({
      target: "all",
      event: "department:updated",
      data: { departmentId: dept._id },
    });

    res.status(200).json({ success: true, user: updatedUser, department: dept });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Remove staff member from department (moves back to General)
exports.removeDepartmentMember = async (req, res) => {
  try {
    const { id, userId } = req.params;
    const dept = await Department.findById(id);
    if (!dept) {
      return res.status(404).json({ success: false, message: "Department not found" });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { department: null, departmentName: "General" },
      { new: true }
    ).select(MEMBER_FIELDS);

    if (!updatedUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    await createNotification({
      recipient: updatedUser._id,
      sender: req.user._id,
      publicId: updatedUser.publicId,
      type: "department_update",
      title: "Department Updated",
      message: `${req.user.fullname} moved you out of the ${dept.name} department.`,
      alsoEmail: true,
      recipientEmail: updatedUser.email,
      actionUrl: "/projects",
    });

    await enqueueWebSocketEvent({
      target: "all",
      event: "department:updated",
      data: { departmentId: dept._id },
    });

    res.status(200).json({ success: true, user: updatedUser });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
