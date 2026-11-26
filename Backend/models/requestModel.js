const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const ApprovalStageSchema = new Schema({
  stageNumber: { type: Number, required: true },
  stageName: { type: String, required: true },
  approver: { type: Schema.Types.ObjectId, ref: "User" },
  roleRequired: { type: String, default: "manager" }, // "lead", "finance", "admin", etc.
  department: { type: Schema.Types.ObjectId, ref: "Department" },
  status: {
    type: String,
    enum: ["pending", "approved", "rejected", "skipped"],
    default: "pending",
  },
  comment: { type: String, default: "" },
  actionDate: { type: Date },
});

const RequestSchema = new Schema(
  {
    requestCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    requestType: {
      type: String,
      enum: [
        "budget_approval",
        "travel_request",
        "asset_requisition",
        "leave_approval",
        "vendor_payment",
        "compliance_signoff",
        "general_request",
      ],
      default: "general_request",
      index: true,
    },
    description: { type: String, default: "" },
    department: {
      type: Schema.Types.ObjectId,
      ref: "Department",
      required: true,
      index: true,
    },
    targetDepartment: {
      type: Schema.Types.ObjectId,
      ref: "Department",
      index: true,
    },
    targetProject: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      index: true,
    },
    targetUsers: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    requester: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
    amount: { type: Number, default: 0 },
    currency: { type: String, default: "INR" },
    dateNeeded: { type: Date },
    attachments: [
      {
        filename: { type: String, required: true },
        originalName: { type: String, required: true },
        url: { type: String, required: true },
        size: { type: Number, default: 0 },
        mimetype: { type: String },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    stages: [ApprovalStageSchema],
    currentStageIndex: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["draft", "submitted", "in_review", "approved", "rejected", "cancelled"],
      default: "submitted",
      index: true,
    },
    rejectionReason: { type: String, default: "" },
    createdTask: { type: Schema.Types.ObjectId, ref: "Task" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Request", RequestSchema);
