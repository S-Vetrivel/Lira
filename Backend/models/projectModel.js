const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const ProjectFileSchema = new Schema({
  filename: { type: String, required: true },
  originalName: { type: String, required: true },
  url: { type: String, required: true },
  size: { type: Number, default: 0 },
  mimetype: { type: String },
  uploadedBy: { type: Schema.Types.ObjectId, ref: "User" },
  uploadedAt: { type: Date, default: Date.now },
});

const ProjectSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    prefix: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      unique: true,
    },
    description: { type: String, default: "" },
    department: { type: Schema.Types.ObjectId, ref: "Department" },
    lead: { type: Schema.Types.ObjectId, ref: "User" },
    members: [{ type: Schema.Types.ObjectId, ref: "User" }],
    files: [ProjectFileSchema],
    status: {
      type: String,
      enum: ["active", "archived", "completed"],
      default: "active",
    },
    color: { type: String, default: "#4F46E5" },
    taskSequence: { type: Number, default: 100 },
    startDate: { type: Date, default: Date.now },
    targetDate: { type: Date },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Project", ProjectSchema);
