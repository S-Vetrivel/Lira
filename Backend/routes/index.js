const express = require("express");
const router = express.Router();

router.use("/auth", require("./authRoutes"));
router.use("/departments", require("./departmentRoutes"));
router.use("/projects", require("./projectRoutes"));
router.use("/tasks", require("./taskRoutes"));
router.use("/comments", require("./commentRoutes"));
router.use("/notifications", require("./notificationRoutes"));
router.use("/users", require("./userRoutes"));
router.use("/analytics", require("./analyticsRoutes"));
router.use("/ai", require("./aiRoutes"));

module.exports = router;
