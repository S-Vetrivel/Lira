const Project = require("../models/projectModel");
const Task = require("../models/taskModel");
const User = require("../models/userModel");
const minioService = require("../services/minioService");
const { createNotification, notifyUsers } = require("../utils/notificationHelper");
const { enqueueWebSocketEvent, enqueueFileJob } = require("../services/queue");

const MEMBER_FIELDS = "fullname email avatar profilePicture role jobTitle departmentName publicId status";

exports.getProjects = async (req, res) => {
  try {
    const projects = await Project.find({ status: { $ne: "archived" } })
      .populate("department", "name code color")
      .populate("departments", "name code color")
      .populate("lead", MEMBER_FIELDS)
      .populate("members", MEMBER_FIELDS)
      .populate("files.uploadedBy", "fullname email avatar profilePicture")
      .populate("links.addedBy", "fullname email avatar profilePicture")
      .sort({ createdAt: -1 })
      .lean();

    const projectsWithStats = await Promise.all(
      projects.map(async (project) => {
        const [totalTasks, doneTasks, inProgressTasks, reviewTasks, todoTasks] =
          await Promise.all([
            Task.countDocuments({ project: project._id }),
            Task.countDocuments({ project: project._id, status: "done" }),
            Task.countDocuments({
              project: project._id,
              status: { $in: ["in_progress", "redo_requested"] },
            }),
            Task.countDocuments({
              project: project._id,
              status: { $in: ["review", "submitted_for_review"] },
            }),
            Task.countDocuments({ project: project._id, status: "todo" }),
          ]);

        const progressPercent =
          totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

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

exports.getProjectById = async (req, res) => {
  try {
    const { id } = req.params;
    const project = await Project.findById(id)
      .populate("department", "name code color")
      .populate("departments", "name code color")
      .populate("lead", MEMBER_FIELDS)
      .populate("members", MEMBER_FIELDS)
      .populate("files.uploadedBy", "fullname email avatar profilePicture")
      .populate("links.addedBy", "fullname email avatar profilePicture")
      .lean();

    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    const [totalTasks, doneTasks, inProgressTasks, reviewTasks, todoTasks] =
      await Promise.all([
        Task.countDocuments({ project: project._id }),
        Task.countDocuments({ project: project._id, status: "done" }),
        Task.countDocuments({
          project: project._id,
          status: { $in: ["in_progress", "redo_requested"] },
        }),
        Task.countDocuments({
          project: project._id,
          status: { $in: ["review", "submitted_for_review"] },
        }),
        Task.countDocuments({ project: project._id, status: "todo" }),
      ]);

    const progressPercent =
      totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

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

exports.createProject = async (req, res) => {
  try {
    const {
      name,
      prefix,
      description,
      department,
      departments = [],
      lead,
      members = [],
      color,
      startDate,
      targetDate,
    } = req.body;

    if (!name || !prefix) {
      return res.status(400).json({
        success: false,
        message: "Name and Key Prefix (e.g. ENG) are required",
      });
    }

    const cleanPrefix = prefix.toUpperCase().trim().replace(/[^A-Z0-9]/g, "");
    if (!cleanPrefix || cleanPrefix.length < 2) {
      return res.status(400).json({
        success: false,
        message: "Prefix must be at least 2 alphanumeric characters",
      });
    }

    const existing = await Project.findOne({ prefix: cleanPrefix });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Project prefix '${cleanPrefix}' is already in use`,
      });
    }

    const invokedDeptIds = Array.from(
      new Set([
        ...(department ? [department.toString()] : []),
        ...(Array.isArray(departments) ? departments.filter(Boolean).map(String) : []),
      ])
    );

    const memberSet = new Set([req.user._id.toString()]);
    if (Array.isArray(members)) {
      members.filter(Boolean).forEach((m) => memberSet.add(m.toString()));
    }
    if (invokedDeptIds.length > 0) {
      const deptUsers = await User.find({
        department: { $in: invokedDeptIds },
        isActive: true,
        status: "active",
      })
        .select("_id")
        .lean();
      deptUsers.forEach((u) => memberSet.add(u._id.toString()));
    }
    const memberIds = Array.from(memberSet);

    const project = await Project.create({
      name: name.trim(),
      prefix: cleanPrefix,
      description: description || "",
      department: department || invokedDeptIds[0] || null,
      departments: invokedDeptIds,
      lead: lead || req.user._id,
      members: memberIds,
      color: color || "#4F46E5",
      taskSequence: 100,
      startDate: startDate || new Date(),
      targetDate: targetDate || null,
    });

    const populated = await Project.findById(project._id)
      .populate("department", "name code color")
      .populate("departments", "name code color")
      .populate("lead", MEMBER_FIELDS)
      .populate("members", MEMBER_FIELDS);

    await notifyUsers({
      recipients: memberIds,
      sender: req.user._id,
      publicId: req.user?.publicId,
      type: "project_update",
      title: `Added to Project [${cleanPrefix}]`,
      message: `${req.user.fullname} added you to project [${cleanPrefix}] ${name.trim()}.`,
      alsoEmail: true,
      actionUrl: "/projects",
    });

    await enqueueWebSocketEvent({
      target: "all",
      event: "project:updated",
      data: populated,
    });

    res.status(201).json({ success: true, project: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateProject = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = {};
    const allowed = [
      "name",
      "description",
      "department",
      "departments",
      "lead",
      "members",
      "color",
      "status",
      "startDate",
      "targetDate",
    ];
    allowed.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    const project = await Project.findByIdAndUpdate(id, updates, { new: true })
      .populate("department", "name code color")
      .populate("departments", "name code color")
      .populate("lead", MEMBER_FIELDS)
      .populate("members", MEMBER_FIELDS)
      .populate("files.uploadedBy", "fullname email avatar profilePicture")
      .populate("links.addedBy", "fullname email avatar profilePicture");

    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    res.status(200).json({ success: true, project });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

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

// Add member to project
exports.addProjectMember = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, message: "userId is required" });
    }

    const project = await Project.findByIdAndUpdate(
      id,
      { $addToSet: { members: userId } },
      { new: true }
    )
      .populate("department", "name code color")
      .populate("lead", MEMBER_FIELDS)
      .populate("members", MEMBER_FIELDS)
      .populate("files.uploadedBy", "fullname email avatar profilePicture");

    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    await createNotification({
      recipient: userId,
      sender: req.user._id,
      publicId: req.user?.publicId,
      type: "project_update",
      title: `Project Access Granted [${project.prefix}]`,
      message: `${req.user.fullname} added you to [${project.prefix}] ${project.name}.`,
      alsoEmail: true,
      actionUrl: "/projects",
    });

    await enqueueWebSocketEvent({
      target: "project",
      room: project._id.toString(),
      event: "project:updated",
      data: project,
    });

    await enqueueWebSocketEvent({
      target: "all",
      event: "project:updated",
      data: project,
    });

    res.status(200).json({ success: true, project });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Remove member from project
exports.removeProjectMember = async (req, res) => {
  try {
    const { id, userId } = req.params;
    const project = await Project.findByIdAndUpdate(
      id,
      { $pull: { members: userId } },
      { new: true }
    )
      .populate("department", "name code color")
      .populate("lead", MEMBER_FIELDS)
      .populate("members", MEMBER_FIELDS)
      .populate("files.uploadedBy", "fullname email avatar profilePicture");

    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    await createNotification({
      recipient: userId,
      sender: req.user._id,
      type: "project_update",
      title: "Project Membership Updated",
      message: `${req.user.fullname} removed you from [${project.prefix}] ${project.name}.`,
    });

    res.status(200).json({ success: true, project });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Upload shared file to project
exports.uploadProjectFile = async (req, res) => {
  try {
    const { id } = req.params;
    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, message: "No file provided" });
    }

    const project = await Project.findById(id);
    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    const fileUrl = `/v3/uploads/${file.filename}`;
    project.files.push({
      filename: file.filename,
      originalName: file.originalname,
      url: fileUrl,
      size: file.size,
      mimetype: file.mimetype,
      uploadedBy: req.user._id,
      uploadedAt: new Date(),
    });
    await project.save();

    minioService
      .uploadFile(file.filename, file.path, file.mimetype)
      .catch(() => {});
    enqueueFileJob({
      fileName: file.filename,
      originalName: file.originalname,
      size: file.size,
      userId: req.user._id,
      projectId: project._id,
    }).catch(() => {});

    const populated = await Project.findById(project._id)
      .populate("department", "name code color")
      .populate("lead", MEMBER_FIELDS)
      .populate("members", MEMBER_FIELDS)
      .populate("files.uploadedBy", "fullname email avatar profilePicture");

    await notifyUsers({
      recipients: project.members,
      sender: req.user._id,
      type: "file_shared",
      title: "Project File Shared",
      message: `${req.user.fullname} shared "${file.originalname}" in [${project.prefix}] ${project.name}.`,
    });

    await enqueueWebSocketEvent({
      target: "project",
      room: project._id.toString(),
      event: "project:updated",
      data: populated,
    });

    res.status(200).json({ success: true, project: populated, files: populated.files });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete shared file from project
exports.deleteProjectFile = async (req, res) => {
  try {
    const { id, fileId } = req.params;
    const project = await Project.findById(id);
    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    project.files.pull({ _id: fileId });
    await project.save();

    const populated = await Project.findById(project._id)
      .populate("department", "name code color")
      .populate("lead", MEMBER_FIELDS)
      .populate("members", MEMBER_FIELDS)
      .populate("files.uploadedBy", "fullname email avatar profilePicture");

    res.status(200).json({ success: true, project: populated, files: populated.files });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Add external URL / resource link to project
exports.addProjectUrl = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, url, category } = req.body;

    if (!title?.trim() || !url?.trim()) {
      return res.status(400).json({ success: false, message: "Title and URL are required" });
    }

    const project = await Project.findById(id);
    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    const normalizedUrl = /^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`;

    project.links.push({
      title: title.trim(),
      url: normalizedUrl,
      category: category?.trim() || "Resource",
      addedBy: req.user._id,
      addedAt: new Date(),
    });
    await project.save();

    const populated = await Project.findById(project._id)
      .populate("department", "name code color")
      .populate("lead", MEMBER_FIELDS)
      .populate("members", MEMBER_FIELDS)
      .populate("files.uploadedBy", "fullname email avatar profilePicture")
      .populate("links.addedBy", "fullname email avatar profilePicture");

    await enqueueWebSocketEvent({
      target: "project",
      room: project._id.toString(),
      event: "project:updated",
      data: populated,
    });

    res.status(200).json({ success: true, project: populated, links: populated.links });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Invoke an entire Department / Team into a project (pulls active department staff in as project members)
exports.invokeProjectDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const { departmentId } = req.body;
    if (!departmentId) {
      return res.status(400).json({ success: false, message: "departmentId is required" });
    }

    const deptUsers = await User.find({
      department: departmentId,
      isActive: true,
      status: "active",
    })
      .select("_id")
      .lean();
    const userIds = deptUsers.map((u) => u._id);

    const project = await Project.findByIdAndUpdate(
      id,
      {
        $addToSet: {
          departments: departmentId,
          members: { $each: userIds },
        },
      },
      { new: true }
    )
      .populate("department", "name code color")
      .populate("departments", "name code color")
      .populate("lead", MEMBER_FIELDS)
      .populate("members", MEMBER_FIELDS)
      .populate("files.uploadedBy", "fullname email avatar profilePicture")
      .populate("links.addedBy", "fullname email avatar profilePicture");

    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    if (userIds.length > 0) {
      await notifyUsers({
        recipients: userIds,
        sender: req.user._id,
        publicId: req.user?.publicId,
        type: "project_update",
        title: `Team Invoked to [${project.prefix}]`,
        message: `${req.user.fullname} invoked your team into project [${project.prefix}] ${project.name}.`,
        alsoEmail: true,
        actionUrl: "/projects",
      });
    }

    await enqueueWebSocketEvent({
      target: "project",
      room: project._id.toString(),
      event: "project:updated",
      data: project,
    });

    res.status(200).json({ success: true, project, addedCount: userIds.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Remove a Department invocation from a project
exports.removeProjectDepartment = async (req, res) => {
  try {
    const { id, deptId } = req.params;
    const project = await Project.findByIdAndUpdate(
      id,
      { $pull: { departments: deptId } },
      { new: true }
    )
      .populate("department", "name code color")
      .populate("departments", "name code color")
      .populate("lead", MEMBER_FIELDS)
      .populate("members", MEMBER_FIELDS)
      .populate("files.uploadedBy", "fullname email avatar profilePicture")
      .populate("links.addedBy", "fullname email avatar profilePicture");

    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    res.status(200).json({ success: true, project });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Remove URL / resource link from project
exports.deleteProjectUrl = async (req, res) => {
  try {
    const { id, urlId } = req.params;
    const project = await Project.findById(id);
    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    project.links.pull({ _id: urlId });
    await project.save();

    const populated = await Project.findById(project._id)
      .populate("department", "name code color")
      .populate("lead", MEMBER_FIELDS)
      .populate("members", MEMBER_FIELDS)
      .populate("files.uploadedBy", "fullname email avatar profilePicture")
      .populate("links.addedBy", "fullname email avatar profilePicture");

    res.status(200).json({ success: true, project: populated, links: populated.links });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
