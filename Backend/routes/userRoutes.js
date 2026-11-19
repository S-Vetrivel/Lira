const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const {
  getTeamMembers,
  createUser,
  updateUser,
  deleteUser,
} = require("../controllers/userControllers");

router.get("/team", protect(), getTeamMembers);
router.post("/", protect(["admin"]), createUser);
router.put("/:id", protect(["admin", "manager"]), updateUser);
router.delete("/:id", protect(["admin"]), deleteUser);

module.exports = router;
