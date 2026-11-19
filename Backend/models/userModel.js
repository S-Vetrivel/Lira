const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const UserSchema = new Schema(
  {
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
      enum: ["admin", "manager", "employee"],
      default: "employee",
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
      enum: ["active", "away", "on_leave"],
      default: "active",
    },
    isActive: { type: Boolean, default: true },
    bio: { type: String },
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
