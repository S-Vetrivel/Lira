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
  submitForReview,
  approveTask,
  requestRevision,
  updateSubtaskProof,
  bulkUpdateTasks,
} = require("../controllers/taskController");

router.get("/", protect(), getTasks);
router.get("/my-work", protect(), getMyTasks);
router.post("/bulk-update", protect(), bulkUpdateTasks);
router.get("/:keyOrId", protect(), getTaskByKeyOrId);
router.post("/", protect(), createTask);
router.put("/:id", protect(), updateTask);
router.patch("/:id/status", protect(), updateTaskStatus);
router.post("/:id/submit-for-review", protect(), submitForReview);
router.post("/:id/approve", protect(["admin", "manager"]), approveTask);
router.post("/:id/redo", protect(["admin", "manager"]), requestRevision);
router.patch("/:id/subtasks/:subtaskId/proof", protect(), updateSubtaskProof);
router.post("/:id/worklog", protect(), addWorkLog);
router.post("/:id/subtasks", protect(), addSubtask);
router.patch("/:id/subtasks/:subtaskId/toggle", protect(), toggleSubtask);
router.delete("/:id/subtasks/:subtaskId", protect(), deleteSubtask);
router.post("/:id/attachments", protect(), upload.single("file"), uploadAttachment);
router.delete("/:id", protect(), deleteTask);

module.exports = router;
