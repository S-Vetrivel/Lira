const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { PersonalInfo } = require("../controllers/profileControllers");

router.put("/info", protect(), PersonalInfo);

module.exports = router;
