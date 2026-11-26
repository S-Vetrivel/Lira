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
  invokeProjectDepartment,
  removeProjectDepartment,
  uploadProjectFile,
  deleteProjectFile,
  addProjectUrl,
  deleteProjectUrl,
} = require("../controllers/projectController");

router.get("/", protect("projects.view"), getProjects);
router.get("/:id", protect("projects.view"), getProjectById);
router.post("/", protect("projects.create"), createProject);
router.put("/:id", protect("projects.edit"), updateProject);
router.delete("/:id", protect("projects.delete"), deleteProject);

// Project team member & department invocation management
router.post("/:id/members", protect(["projects.members", "projects.edit"]), addProjectMember);
router.delete("/:id/members/:userId", protect(["projects.members", "projects.edit"]), removeProjectMember);
router.post("/:id/departments", protect(["projects.members", "projects.edit"]), invokeProjectDepartment);
router.delete("/:id/departments/:deptId", protect(["projects.members", "projects.edit"]), removeProjectDepartment);

// Project team file sharing
router.post("/:id/files", protect(["projects.files", "projects.edit"]), upload.single("file"), uploadProjectFile);
router.delete("/:id/files/:fileId", protect(["projects.files", "projects.edit"]), deleteProjectFile);

// Project URLs / external resource links
router.post("/:id/urls", protect(["projects.urls", "projects.edit"]), addProjectUrl);
router.delete("/:id/urls/:urlId", protect(["projects.urls", "projects.edit"]), deleteProjectUrl);

module.exports = router;
