const express = require("express");
const router = express.Router();
const {
  adminUpdateOrderStatus,
} = require("../../controllers/orderControllers");

router.put("/admin/:id", adminUpdateOrderStatus);

module.exports = router;
