const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const upload = require("../config/upload");
const {
  getTasks,
  getMyTasks,
  getTaskByKeyOrId,
  createTask,
  updateTask,
  updateTaskStatus,
  addWorkLog,
  addSubtask,
  toggleSubtask,
  deleteSubtask,
  uploadAttachment,
  deleteTask,
} = require("../controllers/taskController");

router.get("/", protect(), getTasks);
router.get("/my-work", protect(), getMyTasks);
router.get("/:keyOrId", protect(), getTaskByKeyOrId);
router.post("/", protect(), createTask);
router.put("/:id", protect(), updateTask);
router.patch("/:id/status", protect(), updateTaskStatus);
router.post("/:id/worklog", protect(), addWorkLog);
router.post("/:id/subtasks", protect(), addSubtask);
router.patch("/:id/subtasks/:subtaskId/toggle", protect(), toggleSubtask);
router.delete("/:id/subtasks/:subtaskId", protect(), deleteSubtask);
router.post("/:id/attachments", protect(), upload.single("file"), uploadAttachment);
router.delete("/:id", protect(), deleteTask);

module.exports = router;
