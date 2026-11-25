const Task = require("../models/taskModel");
const Project = require("../models/projectModel");
const User = require("../models/userModel");
const Department = require("../models/departmentModel");
const ActionLog = require("../models/actionLogModel");
const ActivityLog = require("../models/activityLogModel");
const batchLogger = require("../services/batchLogger");

const HOURLY_RATE_INR = 1500;

exports.getManagerOverview = async (req, res) => {
  try {
    const now = new Date();
    const currentUser = req.user;
    const { projectId } = req.query;

    // Base query filter (project-specific or global)
    const taskFilter = {};
    if (projectId) {
      taskFilter.project = projectId;
    }

    // 1. Overall Task Metrics (Real DB counts)
    const totalAllTasks = await Task.countDocuments(taskFilter);
    const totalDoneTasks = await Task.countDocuments({ ...taskFilter, status: "done" });
    const totalInProgressTasks = await Task.countDocuments({
      ...taskFilter,
      status: { $in: ["in_progress", "redo_requested"] },
    });
    const totalReviewTasks = await Task.countDocuments({
      ...taskFilter,
      status: { $in: ["review", "submitted_for_review"] },
    });
    const totalTodoTasks = await Task.countDocuments({ ...taskFilter, status: "todo" });
    const totalOverdueCount = await Task.countDocuments({
      ...taskFilter,
      dueDate: { $lt: now },
      status: { $ne: "done" },
    });

    const completionRate =
      totalAllTasks > 0 ? Math.round((totalDoneTasks / totalAllTasks) * 100) : 0;

    // Status breakdown with real percentages
    const statusBreakdown = {
      inProgress: {
        count: totalInProgressTasks,
        percentage: totalAllTasks > 0 ? Math.round((totalInProgressTasks / totalAllTasks) * 100) : 0,
      },
      done: {
        count: totalDoneTasks,
        percentage: totalAllTasks > 0 ? Math.round((totalDoneTasks / totalAllTasks) * 100) : 0,
      },
      review: {
        count: totalReviewTasks,
        percentage: totalAllTasks > 0 ? Math.round((totalReviewTasks / totalAllTasks) * 100) : 0,
      },
      todo: {
        count: totalTodoTasks,
        percentage: totalAllTasks > 0 ? Math.round((totalTodoTasks / totalAllTasks) * 100) : 0,
      },
    };

    // 2. Effort & Hours calculation (Real DB records)
    const allMatchingTasks = await Task.find(taskFilter)
      .select("_id estimatedHours loggedHours workLogs createdAt updatedAt dueDate status")
      .lean();

    let totalEstimatedHours = 0;
    let totalLoggedHours = 0;

    allMatchingTasks.forEach((t) => {
      totalEstimatedHours += Number(t.estimatedHours) || 0;
      totalLoggedHours += Number(t.loggedHours) || 0;
    });

    totalEstimatedHours = Math.round(totalEstimatedHours * 10) / 10;
    totalLoggedHours = Math.round(totalLoggedHours * 10) / 10;

    // Real INR valuation based strictly on logged work hours
    const sprintValuationINR = Math.round(totalLoggedHours * HOURLY_RATE_INR);

    // 3. Weekly Velocity (Mon - Sun of current week, real workLogs)
    const dayOfWeek = (now.getDay() + 6) % 7; // 0 for Mon, 6 for Sun
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - dayOfWeek);
    startOfWeek.setHours(0, 0, 0, 0);

    const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const weeklyVelocity = weekDays.map((dayName, idx) => {
      const dStart = new Date(startOfWeek);
      dStart.setDate(startOfWeek.getDate() + idx);
      const dEnd = new Date(dStart);
      dEnd.setDate(dStart.getDate() + 1);

      let dayHours = 0;
      const touchedTaskIds = new Set();

      allMatchingTasks.forEach((t) => {
        t.workLogs?.forEach((l) => {
          const lDate = new Date(l.date || l.createdAt || now);
          if (lDate >= dStart && lDate < dEnd) {
            dayHours += Number(l.hours) || 0;
            touchedTaskIds.add(t._id.toString());
          }
        });
      });

      return {
        day: dayName,
        tasksCount: touchedTaskIds.size,
        hours: Math.round(dayHours * 10) / 10,
        isToday: idx === dayOfWeek,
      };
    });

    // 4. Real Throughput Timeline (Last 14 Days from real ActivityLogs + Task workLogs + Task events)
    const fourteenDaysAgo = new Date(now);
    fourteenDaysAgo.setDate(now.getDate() - 13);
    fourteenDaysAgo.setHours(0, 0, 0, 0);

    const activityFilter = { createdAt: { $gte: fourteenDaysAgo } };
    if (projectId) activityFilter.project = projectId;
    const recentActivities = await ActivityLog.find(activityFilter).select("createdAt").lean();

    const throughputCurve = [];
    for (let i = 13; i >= 0; i--) {
      const dStart = new Date(now);
      dStart.setDate(now.getDate() - i);
      dStart.setHours(0, 0, 0, 0);
      const dEnd = new Date(dStart);
      dEnd.setDate(dStart.getDate() + 1);

      const dayLabel = dStart.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
      const dayNumber = dStart.getDate();

      // Count real activities logged on this day
      let actionsCount = recentActivities.filter((a) => {
        const dt = new Date(a.createdAt);
        return dt >= dStart && dt < dEnd;
      }).length;

      // Also include tasks created/updated on this day if no activity log was recorded for them
      const taskUpdatesCount = allMatchingTasks.filter((t) => {
        const created = t.createdAt ? new Date(t.createdAt) : null;
        return created && created >= dStart && created < dEnd;
      }).length;

      // Real workLog hours on this day
      let dayHours = 0;
      allMatchingTasks.forEach((t) => {
        t.workLogs?.forEach((l) => {
          const lDate = new Date(l.date || l.createdAt);
          if (lDate >= dStart && lDate < dEnd) {
            dayHours += Number(l.hours) || 0;
          }
        });
      });

      const realActions = actionsCount > 0 ? actionsCount : taskUpdatesCount;

      throughputCurve.push({
        date: dayLabel,
        dayNumber,
        actions: realActions,
        hours: Math.round(dayHours * 10) / 10,
      });
    }

    // Current month task due dates (for real sprint calendar markers)
    const currentMonthDueDays = [];
    allMatchingTasks.forEach((t) => {
      if (!t.dueDate) return;
      const d = new Date(t.dueDate);
      if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) {
        currentMonthDueDays.push({
          day: d.getDate(),
          status: t.status,
        });
      }
    });

    // 5. Top Priority Tasks (Real database records)
    const priorityOrder = { urgent: 1, high: 2, medium: 3, low: 4 };
    const rawPriorityTasks = await Task.find({
      ...taskFilter,
      status: { $ne: "done" },
    })
      .populate("assignee", "fullname email avatar jobTitle")
      .populate("project", "name prefix color")
      .populate("reporter", "fullname email")
      .sort({ dueDate: 1 })
      .limit(10)
      .lean();

    const topPriorityTickets = rawPriorityTasks
      .sort((a, b) => (priorityOrder[a.priority] || 3) - (priorityOrder[b.priority] || 3))
      .slice(0, 5)
      .map((t) => ({
        id: t._id,
        key: t.key,
        title: t.title,
        priority: t.priority,
        type: t.type,
        status: t.status,
        projectName: t.project?.name || "Workspace",
        projectPrefix: t.project?.prefix || "ENG",
        assigneeName: t.assignee?.fullname || "Unassigned",
        assigneeAvatar: t.assignee?.avatar || null,
        subtasksTotal: t.subtasks?.length || 0,
        subtasksDone: t.subtasks?.filter((s) => s.completed).length || 0,
        estimatedHours: t.estimatedHours || 0,
        loggedHours: t.loggedHours || 0,
        dueDate: t.dueDate,
      }));

    // 6. Team Workload Breakdown (Real active workspace staff)
    const activeUsers = await User.find({ isActive: true, status: "active" })
      .select("fullname email avatar profilePicture jobTitle departmentName role")
      .lean();

    const teamWorkload = await Promise.all(
      activeUsers.map(async (u) => {
        const openTasks = await Task.countDocuments({
          ...taskFilter,
          assignee: u._id,
          status: { $in: ["todo", "in_progress", "review", "submitted_for_review", "redo_requested"] },
        });

        const overdueTasks = await Task.countDocuments({
          ...taskFilter,
          assignee: u._id,
          status: { $ne: "done" },
          dueDate: { $lt: now },
        });

        const completedTasks = await Task.countDocuments({
          ...taskFilter,
          assignee: u._id,
          status: "done",
        });

        const totalHoursLogged = await Task.aggregate([
          ...(projectId ? [{ $match: { project: allMatchingTasks[0]?.project || null } }] : []),
          { $match: { "workLogs.user": u._id } },
          { $unwind: "$workLogs" },
          { $match: { "workLogs.user": u._id } },
          { $group: { _id: null, total: { $sum: "$workLogs.hours" } } },
        ]);

        return {
          userId: u._id,
          name: u.fullname,
          role: u.role,
          jobTitle: u.jobTitle,
          avatar: u.avatar || u.profilePicture,
          departmentName: u.departmentName || "General",
          openTasks,
          overdueTasks,
          completedTasks,
          hoursLogged: totalHoursLogged[0]?.total || 0,
          isOverloaded: openTasks >= 5,
        };
      })
    );

    // 7. Department Breakdown
    const departments = await Department.find().lean();
    const departmentBreakdown = await Promise.all(
      departments.map(async (dept) => {
        const deptUsers = await User.find({
          isActive: true,
          status: "active",
          $or: [{ department: dept._id }, { departmentName: dept.name }],
        }).select("_id");
        const deptUserIds = deptUsers.map((u) => u._id);

        const deptTasksCount = await Task.countDocuments({
          ...taskFilter,
          assignee: { $in: deptUserIds },
        });

        const deptDoneCount = await Task.countDocuments({
          ...taskFilter,
          assignee: { $in: deptUserIds },
          status: "done",
        });

        const deptTasks = await Task.find({
          ...taskFilter,
          assignee: { $in: deptUserIds },
        })
          .select("loggedHours")
          .lean();
        const deptHours = deptTasks.reduce((sum, t) => sum + (Number(t.loggedHours) || 0), 0);

        return {
          id: dept._id,
          name: dept.name,
          code: dept.code,
          color: dept.color,
          taskCount: deptTasksCount,
          completedCount: deptDoneCount,
          hoursLogged: Math.round(deptHours * 10) / 10,
          membersCount: deptUsers.length,
        };
      })
    );

    // 8. Project Progress
    const projects = await Project.find({ status: { $ne: "archived" } })
      .populate("lead", "fullname email")
      .lean();

    const projectProgress = await Promise.all(
      projects.map(async (proj) => {
        const total = await Task.countDocuments({ project: proj._id });
        const done = await Task.countDocuments({ project: proj._id, status: "done" });
        const inProgress = await Task.countDocuments({
          project: proj._id,
          status: { $in: ["in_progress", "redo_requested"] },
        });
        const review = await Task.countDocuments({
          project: proj._id,
          status: { $in: ["review", "submitted_for_review"] },
        });
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

    // 9. Overdue Tasks list
    const overdueTasks = await Task.find({
      ...taskFilter,
      dueDate: { $lt: now },
      status: { $ne: "done" },
    })
      .populate("assignee", "fullname email avatar jobTitle")
      .populate("reporter", "fullname email")
      .populate("project", "name prefix color")
      .sort({ dueDate: 1 })
      .limit(10)
      .lean();

    // 10. Role-Specific Personal Data
    let userRoleData = {
      role: currentUser.role,
      userId: currentUser._id,
      fullname: currentUser.fullname,
    };

    if (currentUser.role === "employee") {
      const myTasks = await Task.find({ ...taskFilter, assignee: currentUser._id }).lean();
      const myDone = myTasks.filter((t) => t.status === "done").length;
      const myInProgress = myTasks.filter((t) =>
        ["in_progress", "redo_requested"].includes(t.status)
      ).length;
      const myReview = myTasks.filter((t) =>
        ["review", "submitted_for_review"].includes(t.status)
      ).length;
      const myTodo = myTasks.filter((t) => t.status === "todo").length;
      const myOverdue = myTasks.filter(
        (t) => t.status !== "done" && t.dueDate && new Date(t.dueDate) < now
      ).length;

      let myLoggedHours = 0;
      let myEstimatedHours = 0;
      myTasks.forEach((t) => {
        myEstimatedHours += Number(t.estimatedHours) || 0;
        myLoggedHours += Number(t.loggedHours) || 0;
      });

      userRoleData.myMetrics = {
        totalTasks: myTasks.length,
        doneTasks: myDone,
        inProgressTasks: myInProgress,
        reviewTasks: myReview,
        todoTasks: myTodo,
        overdueCount: myOverdue,
        loggedHours: Math.round(myLoggedHours * 10) / 10,
        estimatedHours: Math.round(myEstimatedHours * 10) / 10,
        completionRate: myTasks.length > 0 ? Math.round((myDone / myTasks.length) * 100) : 0,
      };

      userRoleData.myStatusBreakdown = {
        inProgress: {
          count: myInProgress,
          percentage: myTasks.length > 0 ? Math.round((myInProgress / myTasks.length) * 100) : 0,
        },
        done: {
          count: myDone,
          percentage: myTasks.length > 0 ? Math.round((myDone / myTasks.length) * 100) : 0,
        },
        review: {
          count: myReview,
          percentage: myTasks.length > 0 ? Math.round((myReview / myTasks.length) * 100) : 0,
        },
        todo: {
          count: myTodo,
          percentage: myTasks.length > 0 ? Math.round((myTodo / myTasks.length) * 100) : 0,
        },
      };
    } else if (currentUser.role === "manager") {
      const unassignedTasksCount = await Task.countDocuments({
        ...taskFilter,
        assignee: null,
      });

      const overloadedMembersCount = teamWorkload.filter((m) => m.isOverloaded).length;

      userRoleData.managerMetrics = {
        unassignedTasksCount,
        overloadedMembersCount,
        totalTeamMembers: activeUsers.length,
      };
    } else if (currentUser.role === "admin") {
      const totalDepartmentsCount = await Department.countDocuments();
      const totalUsersCount = await User.countDocuments({ isActive: true, status: "active" });
      const totalProjectsCount = await Project.countDocuments({ status: { $ne: "archived" } });

      userRoleData.adminMetrics = {
        totalDepartmentsCount,
        totalUsersCount,
        totalProjectsCount,
      };
    }

    res.status(200).json({
      success: true,
      summary: {
        totalTasks: totalAllTasks,
        doneTasks: totalDoneTasks,
        inProgressTasks: totalInProgressTasks,
        reviewTasks: totalReviewTasks,
        todoTasks: totalTodoTasks,
        overdueCount: totalOverdueCount,
        completionRate,
        totalEstimatedHours,
        totalLoggedHours,
        hourlyRateINR: HOURLY_RATE_INR,
        sprintValuationINR,
      },
      statusBreakdown,
      weeklyVelocity,
      throughputCurve,
      currentMonthDueDays,
      topPriorityTickets,
      teamWorkload: teamWorkload.sort((a, b) => b.openTasks - a.openTasks),
      departmentBreakdown,
      projectProgress,
      overdueTasks,
      userRoleData,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==============================================
// 2. ACTION LOGS & BATCHED LOGGER AUDIT
// ==============================================
exports.getActionLogs = async (req, res) => {
  try {
    const { page = 1, limit = 50, action, status, search } = req.query;
    const query = {};

    if (action) query.action = action;
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { path: { $regex: search, $options: "i" } },
        { userEmail: { $regex: search, $options: "i" } },
        { action: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const logs = await ActionLog.find(query)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate("user", "fullname email role avatar")
      .lean();

    const total = await ActionLog.countDocuments(query);

    res.json({
      success: true,
      logs,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
      metrics: batchLogger.getMetrics(),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getActionLogStats = async (req, res) => {
  try {
    const metrics = batchLogger.getMetrics();
    const totalCount = await ActionLog.countDocuments();
    const recentErrors = await ActionLog.countDocuments({ statusCode: { $gte: 400 } });

    res.json({
      success: true,
      metrics,
      totalCount,
      recentErrors,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
