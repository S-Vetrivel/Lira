const Project = require("../models/projectModel");
const Task = require("../models/taskModel");

// Get all projects
exports.getProjects = async (req, res) => {
  try {
    const projects = await Project.find({ status: { $ne: "archived" } })
      .populate("department", "name code color")
      .populate("lead", "fullname email avatar profilePicture")
      .populate("members", "fullname email avatar profilePicture role")
      .sort({ createdAt: -1 })
      .lean();

    // Attach task completion statistics to each project
    const projectsWithStats = await Promise.all(
      projects.map(async (project) => {
        const totalTasks = await Task.countDocuments({ project: project._id });
        const doneTasks = await Task.countDocuments({ project: project._id, status: "done" });
        const inProgressTasks = await Task.countDocuments({ project: project._id, status: "in_progress" });
        const reviewTasks = await Task.countDocuments({ project: project._id, status: "review" });
        const todoTasks = await Task.countDocuments({ project: project._id, status: "todo" });

        const progressPercent = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

        return {
          ...project,
          stats: {
            total: totalTasks,
            done: doneTasks,
            inProgress: inProgressTasks,
            review: reviewTasks,
            todo: todoTasks,
            progressPercent,
          },
        };
      })
    );

    res.status(200).json({ success: true, projects: projectsWithStats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get single project
exports.getProjectById = async (req, res) => {
  try {
    const { id } = req.params;
    const project = await Project.findById(id)
      .populate("department", "name code color")
      .populate("lead", "fullname email avatar profilePicture")
      .populate("members", "fullname email avatar profilePicture role")
      .lean();

    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    const totalTasks = await Task.countDocuments({ project: project._id });
    const doneTasks = await Task.countDocuments({ project: project._id, status: "done" });
    const inProgressTasks = await Task.countDocuments({ project: project._id, status: "in_progress" });
    const reviewTasks = await Task.countDocuments({ project: project._id, status: "review" });
    const todoTasks = await Task.countDocuments({ project: project._id, status: "todo" });

    const progressPercent = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

    res.status(200).json({
      success: true,
      project: {
        ...project,
        stats: {
          total: totalTasks,
          done: doneTasks,
          inProgress: inProgressTasks,
          review: reviewTasks,
          todo: todoTasks,
          progressPercent,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create project (Admin or Manager)
exports.createProject = async (req, res) => {
  try {
    const { name, prefix, description, department, lead, members, color, startDate, targetDate } = req.body;

    if (!name || !prefix) {
      return res.status(400).json({ success: false, message: "Name and Key Prefix (e.g. ENG) are required" });
    }

    const cleanPrefix = prefix.toUpperCase().trim().replace(/[^A-Z0-9]/g, "");
    if (!cleanPrefix || cleanPrefix.length < 2) {
      return res.status(400).json({ success: false, message: "Prefix must be at least 2 alphanumeric characters" });
    }

    const existing = await Project.findOne({ prefix: cleanPrefix });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Project prefix '${cleanPrefix}' is already in use`,
      });
    }

    const project = await Project.create({
      name: name.trim(),
      prefix: cleanPrefix,
      description: description || "",
      department: department || null,
      lead: lead || req.user._id,
      members: members && members.length > 0 ? members : [req.user._id],
      color: color || "#4F46E5",
      taskSequence: 100, // Tasks will start at ENG-101
      startDate: startDate || new Date(),
      targetDate: targetDate || null,
    });

    const populated = await Project.findById(project._id)
      .populate("department", "name code color")
      .populate("lead", "fullname email avatar")
      .populate("members", "fullname email avatar role");

    res.status(201).json({ success: true, project: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update project
exports.updateProject = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, department, lead, members, color, status, startDate, targetDate } = req.body;

    const project = await Project.findByIdAndUpdate(
      id,
      {
        name,
        description,
        department,
        lead,
        members,
        color,
        status,
        startDate,
        targetDate,
      },
      { new: true }
    )
      .populate("department", "name code color")
      .populate("lead", "fullname email avatar")
      .populate("members", "fullname email avatar role");

    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    res.status(200).json({ success: true, project });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete project (Admin only)
exports.deleteProject = async (req, res) => {
  try {
    const { id } = req.params;
    await Project.findByIdAndDelete(id);
    await Task.deleteMany({ project: id });
    res.status(200).json({ success: true, message: "Project and associated tasks removed" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
