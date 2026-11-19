const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const CommentSchema = new Schema(
  {
    task: {
      type: Schema.Types.ObjectId,
      ref: "Task",
      required: true,
      index: true,
    },
    author: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: { type: String, required: true },
    mentions: [{ type: Schema.Types.ObjectId, ref: "User" }],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Comment", CommentSchema);
