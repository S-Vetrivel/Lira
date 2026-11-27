const express = require("express");
const router = express.Router();

router.use("/auth", require("./authRoutes"));
router.use("/roles", require("./roleRoutes"));
router.use("/departments", require("./departmentRoutes"));
router.use("/projects", require("./projectRoutes"));
router.use("/tasks", require("./taskRoutes"));
router.use("/comments", require("./commentRoutes"));
router.use("/notifications", require("./notificationRoutes"));
router.use("/users", require("./userRoutes"));
router.use("/profile", require("./profileRoutes"));
router.use("/analytics", require("./analyticsRoutes"));
router.use("/audit", require("./auditRoutes"));
router.use("/broadcast", require("./broadcastRoutes"));
router.use("/requests", require("./requestRoutes"));
router.use("/files", require("./fileRoutes"));
router.use("/chat", require("./chatRoutes"));
router.use("/ai", require("./aiRoutes"));

module.exports = router;
