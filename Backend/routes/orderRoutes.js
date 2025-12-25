const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware"); // Assuming auth middleware
const {
  createOrder,
  getMyOrders,
  getOrderById,
  cancelOrder,
  adminUpdateOrderStatus,
} = require("../controllers/orderControllers");

// --- User Routes ---
router.post("/", protect, createOrder);
router.get("/my-orders", protect, getMyOrders);
router.put("/:id/cancel", protect, cancelOrder);
router.get("/:id", protect, getOrderById); // Place this last to avoid conflict with 'my-orders' if generic


module.exports = router;
