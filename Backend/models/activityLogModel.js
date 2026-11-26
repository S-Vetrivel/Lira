const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const ActivityLogSchema = new Schema(
  {
    task: {
      type: Schema.Types.ObjectId,
      ref: "Task",
      required: true,
      index: true,
    },
    project: {
      type: Schema.Types.ObjectId,
      ref: "Project",
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    action: {
      type: String,
      required: true,
      enum: [
        "created",
        "status_changed",
        "submitted_for_review",
        "task_approved",
        "revision_requested",
        "assigned",
        "unassigned",
        "priority_changed",
        "due_date_changed",
        "logged_work",
        "commented",
        "subtask_added",
        "subtask_toggled",
        "subtask_removed",
        "attachment_uploaded",
        "description_updated",
        "title_updated",
      ],
    },
    details: {
      field: { type: String },
      oldValue: { type: Schema.Types.Mixed },
      newValue: { type: Schema.Types.Mixed },
      message: { type: String, required: true },
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

module.exports = mongoose.model("ActivityLog", ActivityLogSchema);
