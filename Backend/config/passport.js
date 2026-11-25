const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/userModel");
const { isSuperAdminEmail } = require("../utils/roles");
const { enqueueWebSocketEvent } = require("../services/queue");
const { sendPushToAdmins } = require("../services/pushService");

module.exports = (passport) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    console.log("ℹ️ Google OAuth client ID not set, skipping GoogleStrategy registration");
    return;
  }

  const callbackURL =
    process.env.GOOGLE_CALLBACK_URL ||
    `${process.env.BACKEND_URL || "http://localhost:5000"}/v3/auth/google/callback`;

  console.log(`🔐 Registering GoogleStrategy with callbackURL: ${callbackURL}`);

  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          console.log("--------------- GOOGLE AUTH START ---------------");

          const googlePhoto =
            profile.photos && profile.photos[0]
              ? profile.photos[0].value
              : null;

          const email =
            profile.emails && profile.emails[0]
              ? profile.emails[0].value.toLowerCase().trim()
              : "";

          const isAdmin = email && isSuperAdminEmail(email);

          // 1. Check existing user by Google ID
          let user = await User.findOne({ googleId: profile.id });
          if (user) {
            console.log("User found by Google ID:", user.email);
            if (isAdmin && user.role !== "admin") {
              user.role = "admin";
              user.status = "active";
              user.isActive = true;
              await user.save();
            }
            if (googlePhoto && !user.avatar && !user.profilePicture) {
              user.avatar = googlePhoto;
              user.profilePicture = googlePhoto;
              await user.save();
            }
            return done(null, user);
          }

          // 2. Check existing user by Email (Account Linking)
          if (email) {
            user = await User.findOne({ email });
            if (user) {
              console.log("User found by Email. Linking account...", email);
              user.googleId = profile.id;
              if (googlePhoto && !user.profilePicture) {
                user.profilePicture = googlePhoto;
              }
              if (googlePhoto && !user.avatar) {
                user.avatar = googlePhoto;
              }
              if (isAdmin && user.role !== "admin") {
                user.role = "admin";
                user.status = "active";
                user.isActive = true;
              }
              await user.save();
              return done(null, user);
            }
          }

          // 3. Prepare New User Object with Public ID & Join Request Workflow
          const randomSuffix = Math.floor(1000 + Math.random() * 9000);
          const publicId = `EMP-${randomSuffix}`;

          const userRole = isAdmin ? "admin" : "employee";
          const userStatus = isAdmin ? "active" : "pending_approval";
          const userActive = isAdmin ? true : false;

          const newUserObj = {
            publicId,
            googleId: profile.id,
            email: email || "no-email-" + profile.id,
            fullname:
              profile.displayName ||
              (profile.name
                ? `${profile.name.givenName || ""} ${profile.name.familyName || ""}`.trim()
                : "Google User"),
            role: userRole,
            status: userStatus,
            isActive: userActive,
            departmentName: isAdmin ? "Management" : "Engineering",
            jobTitle: isAdmin ? "Workspace Admin" : "Team Member",
            password: "google-auth-" + Date.now(),
            profilePicture: googlePhoto,
            avatar: googlePhoto,
            joinRequest: {
              requestedDepartmentName: "Engineering",
              requestedRole: "employee",
              requestedJobTitle: "Team Member",
              requestedAt: new Date(),
            },
          };

          console.log("Creating new user via Google Auth:", newUserObj.email, "PublicId:", publicId, "status:", userStatus);
          const newUser = await User.create(newUserObj);
          console.log("USER CREATED SUCCESSFULLY:", newUser._id);

          // If pending approval, push notifications to workspace admins
          if (!isAdmin) {
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
              title: "New Team Join Request",
              body: `${newUser.fullname} (${newUser.publicId}) requested to join the workspace.`,
              url: "/team",
            }).catch(() => {});
          }

          return done(null, newUser);
        } catch (err) {
          console.error("CRITICAL GOOGLE AUTH DB ERROR:", err);
          return done(err, null);
        }
      }
    )
  );
};
