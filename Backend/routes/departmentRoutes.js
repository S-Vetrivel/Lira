const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/authMiddleware");
const {
  getDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} = require("../controllers/departmentController");

router.get("/", protect(), getDepartments);
router.post("/", protect(["admin"]), createDepartment);
router.put("/:id", protect(["admin"]), updateDepartment);
router.delete("/:id", protect(["admin"]), deleteDepartment);

module.exports = router;
