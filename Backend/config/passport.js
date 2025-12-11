const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/userModal"); // Verifying path matches your screenshot

module.exports = (passport) => {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: "http://localhost:3000/api/auth/google/callback",
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          console.log("--------------- GOOGLE AUTH START ---------------");

          // 1. Check existing
          let user = await User.findOne({ googleId: profile.id });
          if (user) {
            console.log("User found by Google ID:", user.email);
            return done(null, user);
          }

          // 2. Check existing email
          if (profile.emails && profile.emails.length > 0) {
            user = await User.findOne({ email: profile.emails[0].value });
            if (user) {
              console.log("User found by Email. Linking account...");
              user.googleId = profile.id;
              await user.save();
              return done(null, user);
            }
          }

          // 3. Prepare New User Object
          const newUserObj = {
            googleId: profile.id,
            email:
              profile.emails && profile.emails[0]
                ? profile.emails[0].value
                : "no-email-" + profile.id,

            // FALLBACK CHAIN: Try display name -> Try given name -> Hardcode "Google User"
            fullname:
              profile.displayName || profile.name?.givenName || "Google User",

            // FALLBACK CHAIN: Try email split -> Hardcode "user" + timestamp
            username:
              profile.emails && profile.emails[0]
                ? profile.emails[0].value.split("@")[0]
                : "user" + Date.now(),

            password: "google-auth-" + Date.now(), // Dummy password
          };

          console.log("ATTEMPTING TO CREATE USER:", newUserObj); // <--- CHECK THIS LOG IN TERMINAL

          const newUser = await User.create(newUserObj);
          console.log("USER CREATED SUCCESSFULLY:", newUser._id);

          return done(null, newUser);
        } catch (err) {
          console.error("CRITICAL DB ERROR:", err);
          return done(err, null);
        }
      }
    )
  );
};
