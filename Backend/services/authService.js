const User = require("../models/userModel");
const { isSuperAdminEmail } = require("../utils/roles");
const { enqueueWebSocketEvent } = require("../services/queue");
const { sendPushToAdmins } = require("../services/pushService");
const { notifyAdmins } = require("../utils/notificationHelper");

const ts = () => new Date().toISOString();

async function findOrCreateGoogleUser(profile) {
  const email = (profile.email || "").toLowerCase().trim();
  const isAdmin = isSuperAdminEmail(email);

  // 1. Check by Google ID
  let user = await User.findOne({ googleId: profile.sub });
  if (user) {
    if (isAdmin && user.role !== "superadmin") {
      user.role = "superadmin";
      user.status = "active";
      user.isActive = true;
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
      if (isAdmin) {
        user.role = "superadmin";
        user.status = "active";
        user.isActive = true;
      }
      await user.save();
      return user;
    }
  }

  // 3. Create New User with Public ID & Pending Join Request
  const publicId = `EMP-${Math.floor(1000 + Math.random() * 9000)}`;
  const role = isAdmin ? "superadmin" : "employee";
  const status = isAdmin ? "active" : "pending_approval";
  const isActive = isAdmin;

  const newUser = await User.create({
    publicId,
    googleId: profile.sub,
    email,
    fullname: profile.name || email.split("@")[0],
    profilePicture: profile.picture,
    avatar: profile.picture,
    role,
    status,
    isActive,
    departmentName: isAdmin ? "Management" : "Engineering",
    jobTitle: isAdmin ? "Workspace Admin" : "Team Member",
    password: "google-auth-" + Date.now(),
    joinRequest: {
      requestedDepartmentName: "Engineering",
      requestedRole: "employee",
      requestedJobTitle: "Team Member",
      requestedAt: new Date(),
    },
  });

  console.log(`[${ts()}] [GoogleOneTap] Created user ${newUser.email} publicId=${publicId} status=${status}`);

  if (!isAdmin) {
    await notifyAdmins({
      sender: newUser._id,
      publicId: newUser.publicId,
      type: "approval_request",
      title: `New Join Request (${newUser.publicId})`,
      message: `${newUser.fullname} (${newUser.publicId}) signed up via Google and requested to join ${newUser.departmentName}.`,
      emailType: "join_request_new",
      emailData: {
        applicantName: newUser.fullname,
        applicantEmail: newUser.email,
        publicId: newUser.publicId,
        departmentName: newUser.departmentName,
      },
    });

    enqueueWebSocketEvent({
      target: "all",
      event: "join-request:new",
      data: {
        user: {
          _id: newUser._id,
          publicId: newUser.publicId,
          fullname: newUser.fullname,
          email: newUser.email,
          avatar: newUser.avatar,
          departmentName: newUser.departmentName,
          jobTitle: newUser.jobTitle,
          createdAt: newUser.createdAt,
        },
      },
    });

    sendPushToAdmins({
      title: `New Join Request (${newUser.publicId})`,
      body: `${newUser.fullname} (${newUser.publicId}) requested to join the workspace.`,
      url: "/team",
    }).catch(() => {});
  }

  return newUser;
}

module.exports = { findOrCreateGoogleUser };
