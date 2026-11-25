const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const {
  getDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  addDepartmentMember,
  removeDepartmentMember,
} = require("../controllers/departmentController");

router.get("/", protect(), getDepartments);
router.post("/", protect(["admin"]), createDepartment);
router.put("/:id", protect(["admin", "manager"]), updateDepartment);
router.delete("/:id", protect(["admin"]), deleteDepartment);

// Department staff management
router.post("/:id/members", protect(["admin", "manager"]), addDepartmentMember);
router.delete("/:id/members/:userId", protect(["admin", "manager"]), removeDepartmentMember);

module.exports = router;
