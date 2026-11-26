const mongoose = require("mongoose");
const Schema = mongoose.Schema;

/**
 * Dynamic Role Definition
 *
 * `superadmin` is the only hardcoded system role (isSystem = true, modules = ["*"], permissions = ["*"]).
 * All other roles (including default-seeded admin/manager/employee or custom roles created by Superadmin)
 * are dynamically configurable in MongoDB and map directly to Modules & Action Slugs.
 */
const RoleSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    color: {
      type: String,
      default: "#6366F1",
    },
    isSystem: {
      type: Boolean,
      default: false,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    modules: {
      type: [String],
      default: [],
    },
    permissions: {
      type: [String],
      default: [],
    },
    department: {
      type: Schema.Types.ObjectId,
      ref: "Department",
      default: null,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Role", RoleSchema);

