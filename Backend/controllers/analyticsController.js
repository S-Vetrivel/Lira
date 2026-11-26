const Task = require("../models/taskModel");
const Project = require("../models/projectModel");
const User = require("../models/userModel");
const Department = require("../models/departmentModel");
const Role = require("../models/roleModel");
const ActionLog = require("../models/actionLogModel");
const ActivityLog = require("../models/activityLogModel");
const PresenceLog = require("../models/presenceLogModel");
const batchLogger = require("../services/batchLogger");
const { getOnlineUserIds } = require("../config/socket");
const { isSuperAdminUser, hasWildcardPermission } = require("../utils/roles");
const { buildTimeBuckets, findBucketIndex } = require("../utils/timeSeriesHelper");

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

    // 10. Dynamic Module/Permission-Driven Role Metrics (supports any dynamic role created by Superadmin)
    const hasOrgScope =
      isSuperAdminUser(currentUser) ||
      hasWildcardPermission(currentUser.permissions, "projects.view") ||
      hasWildcardPermission(currentUser.permissions, "team.view") ||
      hasWildcardPermission(currentUser.permissions, "departments.view") ||
      hasWildcardPermission(currentUser.permissions, "dashboard.logs");

    const userRoleData = {
      role: currentUser.role,
      roleDisplayName: currentUser.roleDisplayName || currentUser.role,
      isSuperAdmin: isSuperAdminUser(currentUser),
      hasOrgScope,
      userId: currentUser._id,
      fullname: currentUser.fullname,
    };

    const myOrFilter = [{ assignee: currentUser._id }, { assignees: currentUser._id }];
    if (currentUser.department) {
      myOrFilter.push({ assignedDepartments: currentUser.department });
    }
    const myTasks = await Task.find({ ...taskFilter, $or: myOrFilter }).lean();
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

    if (hasOrgScope) {
      const unassignedTasksCount = await Task.countDocuments({
        ...taskFilter,
        assignee: null,
        $or: [{ assignees: { $exists: false } }, { assignees: { $size: 0 } }],
      });
      const overloadedMembersCount = teamWorkload.filter((m) => m.isOverloaded).length;
      const [totalDepartmentsCount, totalUsersCount, totalProjectsCount] = await Promise.all([
        Department.countDocuments(),
        User.countDocuments({ isActive: true, status: "active" }),
        Project.countDocuments({ status: { $ne: "archived" } }),
      ]);

      userRoleData.managerMetrics = {
        unassignedTasksCount,
        overloadedMembersCount,
        totalTeamMembers: activeUsers.length,
      };
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
function buildActionLogQuery({ action, status, userId, actorType, search } = {}) {
  const query = {};
  if (action) query.action = action;
  if (status) query.status = status;
  if (userId) query.user = userId;
  if (actorType) query.actorType = actorType;
  if (search) {
    query.$or = [
      { path: { $regex: search, $options: "i" } },
      { userEmail: { $regex: search, $options: "i" } },
      { userName: { $regex: search, $options: "i" } },
      { userPublicId: { $regex: search, $options: "i" } },
      { action: { $regex: search, $options: "i" } },
    ];
  }
  return query;
}

exports.getActionLogs = async (req, res) => {
  try {
    await batchLogger.flush().catch(() => {});
    const { page = 1, limit = 50 } = req.query;
    const query = buildActionLogQuery(req.query);

    const skip = (Number(page) - 1) * Number(limit);
    const logs = await ActionLog.find(query)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate("user", "fullname email role avatar publicId departmentName")
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

// ==============================================
// 3. SUPERADMIN AUDIT + ONLINE USERS + TEAMS OVERVIEW
// ==============================================
async function computePresenceTelemetry(rawRange = "24h", liveOnlineIds = []) {
  const { range, rangeLabel, stepMs, windowStart, buckets } = buildTimeBuckets(rawRange);
  const startMs = buckets[0]?.startMs || windowStart.getTime();
  const [presenceEvents, actionEvents, recentPresence] = await Promise.all([
    PresenceLog.find({ timestamp: { $gte: windowStart } })
      .select("user userName userEmail userPublicId userRole departmentName event onlineCount onlineUserIds ip timestamp")
      .sort({ timestamp: 1 })
      .lean(),
    ActionLog.find({ timestamp: { $gte: windowStart }, user: { $ne: null } })
      .select("user userName userEmail userPublicId userRole ip timestamp")
      .sort({ timestamp: 1 })
      .lean(),
    PresenceLog.find({})
      .sort({ timestamp: -1 })
      .limit(40)
      .lean(),
  ]);

  const bucketData = buckets.map((b) => ({
    ...b,
    peakOnline: 0,
    activeUsersSet: new Set(),
    connectEvents: 0,
    disconnectEvents: 0,
    actionsCount: 0,
  }));

  for (const ev of presenceEvents) {
    const idx = findBucketIndex(ev.timestamp, startMs, stepMs, bucketData.length);
    if (idx === -1) continue;
    const b = bucketData[idx];
    if (ev.user) b.activeUsersSet.add(String(ev.user));
    (ev.onlineUserIds || []).forEach((id) => b.activeUsersSet.add(String(id)));
    if (Number(ev.onlineCount) > b.peakOnline) b.peakOnline = Number(ev.onlineCount);
    if (ev.event === "online") b.connectEvents += 1;
    if (ev.event === "offline") b.disconnectEvents += 1;
  }

  for (const act of actionEvents) {
    const idx = findBucketIndex(act.timestamp, startMs, stepMs, bucketData.length);
    if (idx === -1) continue;
    const b = bucketData[idx];
    if (act.user) b.activeUsersSet.add(String(act.user));
    b.actionsCount += 1;
  }

  const lastIdx = bucketData.length - 1;
  if (lastIdx >= 0 && liveOnlineIds.length > 0) {
    liveOnlineIds.forEach((id) => bucketData[lastIdx].activeUsersSet.add(String(id)));
    if (liveOnlineIds.length > bucketData[lastIdx].peakOnline) {
      bucketData[lastIdx].peakOnline = liveOnlineIds.length;
    }
  }

  const series = bucketData.map((b) => {
    const uniqueUsers = b.activeUsersSet.size;
    const peakOnline = Math.max(b.peakOnline, uniqueUsers);
    return {
      label: b.label,
      fullLabel: b.fullLabel,
      iso: b.iso,
      peakOnline,
      uniqueUsers,
      connectEvents: b.connectEvents,
      disconnectEvents: b.disconnectEvents,
      actionsCount: b.actionsCount,
    };
  });

  // Fallback timeline synthesized from latest distinct user activity if no PresenceLog records exist yet
  let timeline = recentPresence;
  if (!timeline.length) {
    const latestActions = await ActionLog.find({ user: { $ne: null } })
      .sort({ timestamp: -1 })
      .limit(30)
      .select("user userName userEmail userPublicId userRole ip timestamp action path")
      .lean();
    const liveSet = new Set(liveOnlineIds.map(String));
    timeline = latestActions.map((a) => ({
      _id: a._id,
      user: a.user,
      userName: a.userName || a.userEmail || "Member",
      userEmail: a.userEmail || "",
      userPublicId: a.userPublicId || "",
      userRole: a.userRole || "",
      departmentName: "",
      event: liveSet.has(String(a.user)) ? "online" : "heartbeat",
      onlineCount: liveOnlineIds.length,
      ip: a.ip || "",
      timestamp: a.timestamp,
      actionHint: `${a.action} (${a.path})`,
    }));
  }

  return {
    range,
    rangeLabel,
    peakConcurrent: Math.max(...series.map((s) => s.peakOnline), liveOnlineIds.length, 0),
    totalConnects: series.reduce((sum, s) => sum + s.connectEvents, 0),
    uniqueActiveWindow: new Set([
      ...presenceEvents.filter((e) => e.user).map((e) => String(e.user)),
      ...actionEvents.filter((a) => a.user).map((a) => String(a.user)),
      ...liveOnlineIds.map(String),
    ]).size,
    series,
    timeline,
  };
}

exports.getPresenceTimeline = async (req, res) => {
  try {
    await batchLogger.flush().catch(() => {});
    const liveIds = getOnlineUserIds();
    const telemetry = await computePresenceTelemetry(req.query.range || "24h", liveIds);
    res.status(200).json({ success: true, ...telemetry });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getAuditOverview = async (req, res) => {
  try {
    await batchLogger.flush().catch(() => {});

    const { page = 1, limit = 40, presenceRange = "24h" } = req.query;
    const query = buildActionLogQuery(req.query);

    const onlineIds = getOnlineUserIds();
    const onlineSet = new Set(onlineIds.map(String));

    const [
      allUsers,
      departments,
      projects,
      roles,
      auditLogs,
      totalLogs,
      errorLogsCount,
      domainActivity,
      openTasks,
      presenceTelemetry,
    ] = await Promise.all([
      User.find({ isActive: true, status: { $ne: "rejected" } })
        .select("fullname email publicId role department departmentName jobTitle avatar profilePicture status updatedAt")
        .sort({ fullname: 1 })
        .lean(),
      Department.find()
        .populate("lead", "fullname email publicId avatar")
        .sort({ name: 1 })
        .lean(),
      Project.find({ status: { $ne: "archived" } })
        .populate("department", "name code")
        .populate("departments", "name code")
        .lean(),
      Role.find().select("name displayName color isSystem modules permissions").lean(),
      ActionLog.find(query)
        .sort({ timestamp: -1 })
        .skip((Number(page) - 1) * Number(limit))
        .limit(Number(limit))
        .populate("user", "fullname email role avatar publicId departmentName")
        .lean(),
      ActionLog.countDocuments(query),
      ActionLog.countDocuments({ statusCode: { $gte: 400 } }),
      ActivityLog.find()
        .sort({ createdAt: -1 })
        .limit(30)
        .populate("user", "fullname email publicId role avatar")
        .populate("task", "key title status")
        .populate("project", "name prefix")
        .lean(),
      Task.find().select("project department assignedDepartments status dueDate").lean(),
      computePresenceTelemetry(presenceRange, onlineIds),
    ]);

    const now = new Date();
    const onlineUsers = allUsers
      .filter((u) => onlineSet.has(u._id.toString()))
      .map((u) => ({ ...u, isOnline: true }));

    const offlineUsers = allUsers
      .filter((u) => !onlineSet.has(u._id.toString()))
      .map((u) => ({ ...u, isOnline: false }));

    const teamsOverview = departments.map((dept) => {
      const deptId = dept._id.toString();
      const members = allUsers.filter(
        (u) => String(u.department) === deptId || u.departmentName === dept.name
      );
      const onlineMembers = members.filter((m) => onlineSet.has(m._id.toString()));
      const linkedProjects = projects.filter(
        (p) =>
          String(p.department?._id || p.department) === deptId ||
          (p.departments || []).some((pd) => String(pd._id || pd) === deptId)
      );
      const deptTasks = openTasks.filter(
        (t) =>
          String(t.department) === deptId ||
          (t.assignedDepartments || []).some((td) => String(td) === deptId)
      );
      return {
        _id: dept._id,
        name: dept.name,
        code: dept.code,
        color: dept.color,
        description: dept.description,
        lead: dept.lead,
        membersCount: members.length,
        onlineCount: onlineMembers.length,
        projectsCount: linkedProjects.length,
        totalTasks: deptTasks.length,
        doneTasks: deptTasks.filter((t) => t.status === "done").length,
        overdueTasks: deptTasks.filter(
          (t) => t.status !== "done" && t.dueDate && new Date(t.dueDate) < now
        ).length,
        members: members.map((m) => ({ ...m, isOnline: onlineSet.has(m._id.toString()) })),
      };
    });

    const projectsOverview = projects.map((p) => {
      const pTasks = openTasks.filter((t) => String(t.project) === String(p._id));
      const doneCount = pTasks.filter((t) => t.status === "done").length;
      return {
        _id: p._id,
        name: p.name,
        prefix: p.prefix,
        status: p.status,
        membersCount: p.members?.length || 0,
        departmentsCount:
          (p.departments?.length || 0) > 0 ? p.departments.length : p.department ? 1 : 0,
        totalTasks: pTasks.length,
        doneTasks: doneCount,
        progressPercent: pTasks.length > 0 ? Math.round((doneCount / pTasks.length) * 100) : 0,
      };
    });

    const pendingJoinRequests = allUsers.filter((u) => u.status === "pending_approval").length;

    res.status(200).json({
      success: true,
      summary: {
        totalActiveUsers: allUsers.length,
        onlineCount: onlineUsers.length,
        teamsCount: departments.length,
        projectsCount: projects.length,
        rolesCount: roles.length,
        totalLogs,
        errorLogsCount,
        pendingJoinRequests,
      },
      onlineUsers,
      offlineUsers,
      teamsOverview,
      projectsOverview,
      rolesSummary: roles.map((r) => ({
        ...r,
        usersCount: allUsers.filter((u) => u.role === r.name).length,
      })),
      auditLogs,
      total: totalLogs,
      page: Number(page),
      totalPages: Math.ceil(totalLogs / Number(limit)),
      domainActivity,
      presenceTelemetry,
      metrics: batchLogger.getMetrics(),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
