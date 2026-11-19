const Department = require("../models/departmentModel");
const User = require("../models/userModel");
const Project = require("../models/projectModel");

// Get all departments
exports.getDepartments = async (req, res) => {
  try {
    const departments = await Department.find()
      .populate("lead", "fullname email avatar profilePicture")
      .sort({ name: 1 })
      .lean();

    // Populate user counts and project counts
    const departmentsWithCounts = await Promise.all(
      departments.map(async (dept) => {
        const membersCount = await User.countDocuments({ department: dept._id, isActive: true });
        const projectsCount = await Project.countDocuments({ department: dept._id });
        return {
          ...dept,
          membersCount,
          projectsCount,
        };
      })
    );

    res.status(200).json({ success: true, departments: departmentsWithCounts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create department (Admin only)
exports.createDepartment = async (req, res) => {
  try {
    const { name, code, description, color, lead } = req.body;

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

    res.status(201).json({ success: true, department: dept });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update department
exports.updateDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, color, lead } = req.body;

    const dept = await Department.findByIdAndUpdate(
      id,
      { name, description, color, lead },
      { new: true }
    ).populate("lead", "fullname email avatar");

    if (!dept) {
      return res.status(404).json({ success: false, message: "Department not found" });
    }

    res.status(200).json({ success: true, department: dept });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete department
exports.deleteDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    await Department.findByIdAndDelete(id);
    res.status(200).json({ success: true, message: "Department deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
