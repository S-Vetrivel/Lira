const mongoose = require("mongoose");

const bannerSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      default: "",
    },
    subtitle: {
      type: String,
      default: "",
    },
    image: {
      type: String,
      required: false, // Initially empty until Worker updates it
    },
    page: {
      type: String,
      enum: ["home", "shop"],
      default: "home",
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Banner", bannerSchema);
