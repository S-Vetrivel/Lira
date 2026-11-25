const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const upload = require("../config/upload");
const {
  getProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  addProjectMember,
  removeProjectMember,
  uploadProjectFile,
  deleteProjectFile,
} = require("../controllers/projectController");

router.get("/", protect(), getProjects);
router.get("/:id", protect(), getProjectById);
router.post("/", protect(["admin", "manager"]), createProject);
router.put("/:id", protect(["admin", "manager"]), updateProject);
router.delete("/:id", protect(["admin"]), deleteProject);

// Project team member management
router.post("/:id/members", protect(["admin", "manager"]), addProjectMember);
router.delete("/:id/members/:userId", protect(["admin", "manager"]), removeProjectMember);

// Project team file sharing
router.post("/:id/files", protect(), upload.single("file"), uploadProjectFile);
router.delete("/:id/files/:fileId", protect(), deleteProjectFile);

module.exports = router;
