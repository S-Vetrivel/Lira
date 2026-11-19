const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const {
  getProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
} = require("../controllers/projectController");

router.get("/", protect(), getProjects);
router.get("/:id", protect(), getProjectById);
router.post("/", protect(["admin", "manager"]), createProject);
router.put("/:id", protect(["admin", "manager"]), updateProject);
router.delete("/:id", protect(["admin"]), deleteProject);

module.exports = router;
