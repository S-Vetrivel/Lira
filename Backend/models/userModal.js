const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const UserSchema = new Schema({
  googleId: { type: String, unique: true, sparse: true }, // Added this
  username: { type: String },
  fullname: { type: String },
  email: { type: String, required: true },
  password: { type: String },
  phone: { type: String },
  role: { type: String, default: "User" },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Users", UserSchema);
