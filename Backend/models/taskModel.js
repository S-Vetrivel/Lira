const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const SubtaskSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    completed: { type: Boolean, default: false },
    assignee: { type: Schema.Types.ObjectId, ref: "User" },
    dueDate: { type: Date },
    dueTime: { type: String, default: "17:00" },
    requiresProof: { type: Boolean, default: false },
    proofAttachment: {
      filename: { type: String },
      originalName: { type: String },
      url: { type: String },
      uploadedAt: { type: Date },
    },
    completedAt: { type: Date },
    completedBy: { type: Schema.Types.ObjectId, ref: "User" },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const AttachmentSchema = new Schema({
  filename: { type: String, required: true },
  originalName: { type: String, required: true },
  url: { type: String, required: true },
  size: { type: Number, default: 0 },
  mimetype: { type: String },
  uploadedBy: { type: Schema.Types.ObjectId, ref: "User" },
  uploadedAt: { type: Date, default: Date.now },
  isProofOfWork: { type: Boolean, default: false },
});

const WorkLogSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true },
  hours: { type: Number, required: true },
  note: { type: String, default: "" },
  date: { type: Date, default: Date.now },
});

const RecurrenceSchema = new Schema({
  frequency: {
    type: String,
    enum: ["daily", "weekdays", "weekly", "biweekly", "monthly", "custom"],
    default: "weekly",
  },
  interval: { type: Number, default: 1 },
  daysOfWeek: [{ type: Number }], // 0 = Sunday, 1 = Monday ... 6 = Saturday
  dayOfMonth: { type: Number },
  timeOfDay: { type: String, default: "09:00" },
  nextRunDate: { type: Date },
  lastRunDate: { type: Date },
  templateChecklist: [{ type: String }],
});

const TaskSchema = new Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    project: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    department: {
      type: Schema.Types.ObjectId,
      ref: "Department",
      index: true,
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    type: {
      type: String,
      enum: ["task", "bug", "client_request", "approval", "compliance", "routine"],
      default: "task",
    },
    status: {
      type: String,
      enum: ["todo", "in_progress", "review", "submitted_for_review", "redo_requested", "done", "cancelled"],
      default: "todo",
      index: true,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
      index: true,
    },
    assignee: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    collaborators: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    reporter: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    dueDate: { type: Date },
    dueTime: { type: String, default: "17:00" },
    clockDeadline: { type: Date }, // combined Date + Time
    estimatedHours: { type: Number, default: 0 },
    loggedHours: { type: Number, default: 0 },
    subtasks: [SubtaskSchema],
    attachments: [AttachmentSchema],
    workLogs: [WorkLogSchema],
    order: { type: Number, default: 0 },

    // Office Governance & Manager Redo Loop
    reviewFeedback: { type: String, default: "" },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
    revisionCount: { type: Number, default: 0 },
    submittedForReviewAt: { type: Date },

    // Proof of Work Requirements
    proofRequired: { type: Boolean, default: false },
    proofFiles: [AttachmentSchema],

    // Privacy & Confidentiality
    isConfidential: { type: Boolean, default: false, index: true },

    // Native Recurring Engine
    isRecurring: { type: Boolean, default: false, index: true },
    recurrence: RecurrenceSchema,
    parentRecurringTaskId: { type: Schema.Types.ObjectId, ref: "Task" },

    // Automated Escalations & Nudges
    lastNudgedAt: { type: Date },
    escalatedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

// Auto-calculate clockDeadline before save if dueDate & dueTime exist
TaskSchema.pre("save", async function () {
  if (this.dueDate) {
    const d = new Date(this.dueDate);
    if (this.dueTime && typeof this.dueTime === "string") {
      const parts = this.dueTime.split(":");
      const hours = parseInt(parts[0], 10) || 17;
      const minutes = parseInt(parts[1], 10) || 0;
      d.setHours(hours, minutes, 0, 0);
    }
    this.clockDeadline = d;
  }
});

// Calculate total logged hours before save if needed
TaskSchema.methods.recalculateLoggedHours = function () {
  this.loggedHours = this.workLogs.reduce((acc, log) => acc + (log.hours || 0), 0);
  return this.loggedHours;
};

module.exports = mongoose.model("Task", TaskSchema);
