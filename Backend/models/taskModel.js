const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const SubtaskSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    completed: { type: Boolean, default: false },
    assignee: { type: Schema.Types.ObjectId, ref: "User" },
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
});

const WorkLogSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true },
  hours: { type: Number, required: true },
  note: { type: String, default: "" },
  date: { type: Date, default: Date.now },
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
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    type: {
      type: String,
      enum: ["task", "bug", "client_request", "approval"],
      default: "task",
    },
    status: {
      type: String,
      enum: ["todo", "in_progress", "review", "done"],
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
    reporter: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    dueDate: { type: Date },
    estimatedHours: { type: Number, default: 0 },
    loggedHours: { type: Number, default: 0 },
    subtasks: [SubtaskSchema],
    attachments: [AttachmentSchema],
    workLogs: [WorkLogSchema],
    order: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
);

// Calculate total logged hours before save if needed
TaskSchema.methods.recalculateLoggedHours = function () {
  this.loggedHours = this.workLogs.reduce((acc, log) => acc + (log.hours || 0), 0);
  return this.loggedHours;
};

module.exports = mongoose.model("Task", TaskSchema);
