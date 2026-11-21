const { Worker } = require("bullmq");
const User = require("../models/userModel");
const Task = require("../models/taskModel");
const Project = require("../models/projectModel");
const { redisConfig, enqueueNotification, enqueueWebSocketEvent } = require("../services/queue");

const calculateNextRun = (frequency, interval = 1) => {
  const next = new Date();
  if (frequency === "daily") {
    next.setDate(next.getDate() + interval);
  } else if (frequency === "weekdays") {
    do {
      next.setDate(next.getDate() + 1);
    } while (next.getDay() === 0 || next.getDay() === 6);
  } else if (frequency === "weekly") {
    next.setDate(next.getDate() + 7 * interval);
  } else if (frequency === "monthly") {
    next.setMonth(next.getMonth() + interval);
  } else {
    next.setDate(next.getDate() + 1);
  }
  return next;
};

const routineSchedulerWorker = new Worker(
  "routine-scheduler-queue",
  async (job) => {
    console.log("[RoutineScheduler] Running recurring task generator & deadline supervisor...");
    const now = new Date();

    // 1. Process Due Recurring Tasks
    const recurringTasks = await Task.find({
      isRecurring: true,
      "recurrence.nextRun": { $lte: now },
    });

    let spawnedCount = 0;
    for (const sourceTask of recurringTasks) {
      try {
        const project = await Project.findByIdAndUpdate(
          sourceTask.project,
          { $inc: { taskSequence: 1 } },
          { new: true }
        );
        const prefix = project?.prefix || (sourceTask.key || "LIRA-1").split("-")[0] || "LIRA";
        const newKey = `${prefix}-${project?.taskSequence || Date.now().toString().slice(-4)}`;

        const resetSubtasks = (sourceTask.subtasks || []).map((st) => ({
          title: st.title,
          completed: false,
          proofRequired: st.proofRequired || false,
          proofType: st.proofType || "none",
        }));

        const nextDeadline = calculateNextRun(
          sourceTask.recurrence?.frequency || "daily",
          sourceTask.recurrence?.interval || 1
        );

        await Task.create({
          title: `${sourceTask.title} (Routine - ${now.toLocaleDateString()})`,
          key: newKey,
          description: sourceTask.description,
          project: sourceTask.project,
          department: sourceTask.department,
          type: sourceTask.type || "task",
          priority: sourceTask.priority,
          status: "todo",
          assignee: sourceTask.assignee,
          creator: sourceTask.creator,
          collaborators: sourceTask.collaborators,
          isConfidential: sourceTask.isConfidential,
          proofRequired: sourceTask.proofRequired,
          dueTime: sourceTask.dueTime,
          dueDate: nextDeadline,
          subtasks: resetSubtasks,
          isRecurring: false,
        });

        if (!sourceTask.recurrence) sourceTask.recurrence = {};
        sourceTask.recurrence.nextRun = calculateNextRun(
          sourceTask.recurrence.frequency || "daily",
          sourceTask.recurrence.interval || 1
        );
        await sourceTask.save();
        spawnedCount++;

        if (sourceTask.assignee) {
          await enqueueNotification({
            recipient: sourceTask.assignee,
            type: "ASSIGNED",
            title: `New routine scheduled: ${sourceTask.title}`,
            task: sourceTask._id,
          });
        }
      } catch (err) {
        console.error(`Error spawning routine for task ${sourceTask._id}:`, err.message);
      }
    }

    // 2. Check Overdue & Clock Deadline Escalations
    const overdueTasks = await Task.find({
      status: { $in: ["todo", "in_progress", "redo_requested"] },
      dueDate: { $lt: now },
      dueDate: { $gt: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
    }).populate("assignee reporter", "name email");

    for (const t of overdueTasks) {
      if (t.assignee) {
        await enqueueWebSocketEvent({
          room: `user_${t.assignee._id}`,
          event: "task:deadline_warning",
          data: { taskId: t._id, title: t.title, key: t.key, dueTime: t.dueTime },
          target: "user",
        });
      }
    }

    return { spawnedCount, scannedOverdue: overdueTasks.length };
  },
  {
    connection: redisConfig,
    concurrency: 2,
  }
);

routineSchedulerWorker.on("completed", (job) => {
  console.log(`[RoutineScheduler] Job ${job.id} completed`);
});

routineSchedulerWorker.on("failed", (job, err) => {
  console.error(`[RoutineScheduler] Job ${job?.id} failed:`, err.message);
});

module.exports = routineSchedulerWorker;
