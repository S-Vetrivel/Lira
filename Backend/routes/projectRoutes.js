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

router.get("/", protect("projects.view"), getProjects);
router.get("/:id", protect("projects.view"), getProjectById);
router.post("/", protect("projects.create"), createProject);
router.put("/:id", protect("projects.edit"), updateProject);
router.delete("/:id", protect("projects.delete"), deleteProject);

// Project team member management
router.post("/:id/members", protect("projects.edit"), addProjectMember);
router.delete("/:id/members/:userId", protect("projects.edit"), removeProjectMember);

// Project team file sharing
router.post("/:id/files", protect("projects.edit"), upload.single("file"), uploadProjectFile);
router.delete("/:id/files/:fileId", protect("projects.edit"), deleteProjectFile);

module.exports = router;
