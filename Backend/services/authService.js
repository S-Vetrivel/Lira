const User = require("../models/userModel");
const { isSuperAdminEmail } = require("../utils/roles");

async function findOrCreateGoogleUser(profile) {
  const email = (profile.email || "").toLowerCase().trim();
  const isAdmin = isSuperAdminEmail(email);

  // 1. Check by Google ID
  let user = await User.findOne({ googleId: profile.sub });
  if (user) {
    if (isAdmin && user.role !== "admin") {
      user.role = "admin";
      await user.save();
    }
    return user;
  }

  // 2. Check by Email
  if (email) {
    user = await User.findOne({ email });
    if (user) {
      user.googleId = profile.sub;
      if (!user.profilePicture && profile.picture) {
        user.profilePicture = profile.picture;
      }
      if (isAdmin) user.role = "admin";
      await user.save();
      return user;
    }
  }

  // 3. Create New User
  const role = isAdmin ? "admin" : "employee";
  return await User.create({
    googleId: profile.sub,
    email,
    fullname: profile.name || email.split("@")[0],
    profilePicture: profile.picture,
    avatar: profile.picture,
    role,
    password: "google-auth-" + Date.now(),
  });
}

module.exports = { findOrCreateGoogleUser };
