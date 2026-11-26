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

router.get("/", protect("departments.view"), getDepartments);
router.post("/", protect("departments.create"), createDepartment);
router.put("/:id", protect("departments.edit"), updateDepartment);
router.delete("/:id", protect("departments.delete"), deleteDepartment);

// Department staff management
router.post("/:id/members", protect("departments.edit"), addDepartmentMember);
router.delete("/:id/members/:userId", protect("departments.edit"), removeDepartmentMember);

module.exports = router;
