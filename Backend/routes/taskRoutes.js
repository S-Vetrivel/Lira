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

router.get("/", protect("tasks.view"), getTasks);
router.get("/my-work", protect("tasks.view"), getMyTasks);
router.post("/bulk-update", protect("tasks.edit"), bulkUpdateTasks);
router.get("/:keyOrId", protect("tasks.view"), getTaskByKeyOrId);
router.post("/", protect("tasks.create"), createTask);
router.put("/:id", protect("tasks.edit"), updateTask);
router.patch("/:id/status", protect("tasks.edit"), updateTaskStatus);
router.post("/:id/submit-for-review", protect("tasks.review"), submitForReview);
router.post("/:id/approve", protect("tasks.approve"), approveTask);
router.post("/:id/redo", protect("tasks.approve"), requestRevision);
router.patch("/:id/subtasks/:subtaskId/proof", protect("tasks.edit"), updateSubtaskProof);
router.post("/:id/worklog", protect("tasks.edit"), addWorkLog);
router.post("/:id/subtasks", protect("tasks.edit"), addSubtask);
router.patch("/:id/subtasks/:subtaskId/toggle", protect("tasks.edit"), toggleSubtask);
router.delete("/:id/subtasks/:subtaskId", protect("tasks.edit"), deleteSubtask);
router.post("/:id/attachments", protect("tasks.edit"), upload.single("file"), uploadAttachment);
router.delete("/:id", protect("tasks.delete"), deleteTask);

module.exports = router;
