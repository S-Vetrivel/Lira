const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const UserSchema = new Schema(
  {
    publicId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
      trim: true,
    },
    fullname: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String },
    role: {
      type: String,
      default: "employee",
      lowercase: true,
      trim: true,
      index: true,
    },
    roleRef: {
      type: Schema.Types.ObjectId,
      ref: "Role",
      default: null,
    },
    customPermissions: {
      type: [String],
      default: [],
    },
    department: {
      type: Schema.Types.ObjectId,
      ref: "Department",
    },
    departmentName: { type: String, default: "General" },
    jobTitle: { type: String, default: "Team Member" },
    avatar: { type: String },
    profilePicture: { type: String },
    googleId: { type: String, sparse: true },
    phone: { type: String },
    status: {
      type: String,
      enum: ["active", "pending_approval", "rejected", "away", "on_leave"],
      default: "active",
      index: true,
    },
    isActive: { type: Boolean, default: true },
    bio: { type: String },

    // Team Join Request Workflow & Follow details
    joinRequest: {
      requestedDepartment: { type: Schema.Types.ObjectId, ref: "Department" },
      requestedDepartmentName: { type: String, default: "Engineering" },
      requestedRole: { type: String, default: "employee", lowercase: true, trim: true },
      requestedJobTitle: { type: String, default: "Team Member" },
      reason: { type: String, default: "" },
      requestedAt: { type: Date, default: Date.now },
      reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
      reviewedAt: { type: Date },
      rejectionReason: { type: String, default: "" },
    },

    // Web Push Notification Subscription
    pushSubscription: {
      type: Schema.Types.Mixed,
      default: null,
    },
    lastSeenAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Virtual for avatar or profile picture
UserSchema.virtual("displayAvatar").get(function () {
  return this.avatar || this.profilePicture || "";
});

module.exports = mongoose.model("User", UserSchema);
