const express = require("express");
const router = express.Router();
const { protect, requireSuperAdmin } = require("../middleware/authMiddleware");
const {
  getModulesCatalog,
  listRoles,
  createRole,
  updateRole,
  deleteRole,
  assignUserRole,
} = require("../controllers/roleController");

// Module catalog (any authenticated workspace member can inspect available modules)
router.get("/catalog", protect(), getModulesCatalog);

// List dynamic roles from Redis cache (available to all authenticated members for UI dropdowns)
router.get("/", protect(), listRoles);

// Superadmin-only dynamic role & module CRUD
router.post("/", requireSuperAdmin, createRole);
router.put("/assign/:userId", protect(["team.edit", "rbac.manage"]), assignUserRole);
router.put("/:id", requireSuperAdmin, updateRole);
router.delete("/:id", requireSuperAdmin, deleteRole);

module.exports = router;

