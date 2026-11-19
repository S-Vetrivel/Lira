const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const DepartmentSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      unique: true,
    },
    description: { type: String, default: "" },
    color: { type: String, default: "#3B82F6" },
    lead: { type: Schema.Types.ObjectId, ref: "User" },
    membersCount: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Department", DepartmentSchema);
