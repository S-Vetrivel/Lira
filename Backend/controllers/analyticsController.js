const Task = require("../models/taskModel");
const Project = require("../models/projectModel");
const User = require("../models/userModel");

exports.getManagerOverview = async (req, res) => {
  try {
    const now = new Date();

    // 1. Team Workload (Open tasks per employee)
    const activeUsers = await User.find({ isActive: true })
      .select("fullname email avatar profilePicture jobTitle departmentName")
      .lean();

    const teamWorkload = await Promise.all(
      activeUsers.map(async (user) => {
        const openTasks = await Task.countDocuments({
          assignee: user._id,
          status: { $in: ["todo", "in_progress", "review"] },
        });

        const overdueTasks = await Task.countDocuments({
          assignee: user._id,
          status: { $ne: "done" },
          dueDate: { $lt: now },
        });

        const completedTasks = await Task.countDocuments({
          assignee: user._id,
          status: "done",
        });

        const totalHoursLogged = await Task.aggregate([
          { $match: { "workLogs.user": user._id } },
          { $unwind: "$workLogs" },
          { $match: { "workLogs.user": user._id } },
          { $group: { _id: null, total: { $sum: "$workLogs.hours" } } },
        ]);

        return {
          userId: user._id,
          name: user.fullname,
          jobTitle: user.jobTitle,
          avatar: user.avatar || user.profilePicture,
          openTasks,
          overdueTasks,
          completedTasks,
          hoursLogged: totalHoursLogged[0]?.total || 0,
          isOverloaded: openTasks >= 5, // Threshold flag
        };
      })
    );

    // 2. Project Progress (Completion rate)
    const projects = await Project.find({ status: { $ne: "archived" } })
      .populate("lead", "fullname email")
      .lean();

    const projectProgress = await Promise.all(
      projects.map(async (proj) => {
        const total = await Task.countDocuments({ project: proj._id });
        const done = await Task.countDocuments({ project: proj._id, status: "done" });
        const inProgress = await Task.countDocuments({ project: proj._id, status: "in_progress" });
        const review = await Task.countDocuments({ project: proj._id, status: "review" });
        const todo = await Task.countDocuments({ project: proj._id, status: "todo" });
        const overdue = await Task.countDocuments({
          project: proj._id,
          status: { $ne: "done" },
          dueDate: { $lt: now },
        });

        return {
          projectId: proj._id,
          name: proj.name,
          prefix: proj.prefix,
          color: proj.color,
          total,
          done,
          inProgress,
          review,
          todo,
          overdue,
          percentage: total > 0 ? Math.round((done / total) * 100) : 0,
        };
      })
    );

    // 3. Overdue Alerts (List of all delayed tasks across the company and their owners)
    const overdueTasks = await Task.find({
      dueDate: { $lt: now },
      status: { $ne: "done" },
    })
      .populate("assignee", "fullname email avatar jobTitle")
      .populate("reporter", "fullname email")
      .populate("project", "name prefix color")
      .sort({ dueDate: 1 })
      .limit(20)
      .lean();

    // 4. Overall summary counts
    const totalAllTasks = await Task.countDocuments();
    const totalDoneTasks = await Task.countDocuments({ status: "done" });
    const totalInProgressTasks = await Task.countDocuments({ status: "in_progress" });
    const totalOverdueCount = await Task.countDocuments({
      dueDate: { $lt: now },
      status: { $ne: "done" },
    });

    res.status(200).json({
      success: true,
      summary: {
        totalTasks: totalAllTasks,
        doneTasks: totalDoneTasks,
        inProgressTasks: totalInProgressTasks,
        overdueCount: totalOverdueCount,
        completionRate: totalAllTasks > 0 ? Math.round((totalDoneTasks / totalAllTasks) * 100) : 0,
      },
      teamWorkload: teamWorkload.sort((a, b) => b.openTasks - a.openTasks),
      projectProgress,
      overdueTasks,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
