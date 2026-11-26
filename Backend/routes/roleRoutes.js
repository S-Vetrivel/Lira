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

// List dynamic roles (viewers need rbac.view or team governance access)
router.get("/", protect(["rbac.view", "team.edit", "team.join_requests"]), listRoles);

// Superadmin-only dynamic role & module CRUD
router.post("/", requireSuperAdmin, createRole);
router.put("/assign/:userId", protect(["team.edit", "rbac.manage"]), assignUserRole);
router.put("/:id", requireSuperAdmin, updateRole);
router.delete("/:id", requireSuperAdmin, deleteRole);

module.exports = router;

