const Order = require("../models/orderModel");
const Product = require("../models/productModel");
const User = require("../models/userModel");
const mongoose = require("mongoose");

// --- WORKER SIMULATION ---
// Simulates a background job (like BullMQ/RabbitMQ) processing the order
const triggerOrderProcessingWorker = (orderId) => {
  return new Promise((resolve) => {
    console.log(`[Worker] Job started for Order ${orderId}...`);

    // Simulate 5-second processing delay (e.g., sending email, notifying warehouse)
    setTimeout(async () => {
      try {
        const order = await Order.findOneAndUpdate(
          { orderId: orderId, status: "Pending" }, // Only process if still Pending
          {
            status: "Processing",
            processedByWorker: true,
          },
          { new: true }
        );

        if (order) {
          console.log(`[Worker] Order ${orderId} moved to PROCESSING.`);
        } else {
          console.log(
            `[Worker] Order ${orderId} was cancelled or already processed.`
          );
        }
        resolve(true);
      } catch (err) {
        console.error(`[Worker] Failed to process ${orderId}`, err);
        resolve(false);
      }
    }, 5000);
  });
};

// --- CONTROLLERS ---

/**
 * @desc    Create a new order & trigger worker
 * @route   POST /api/orders
 * @access  Private (User)
 */
exports.createOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { items, addressId, paymentMethod, totalAmount } = req.body;
    const userId = req.user._id;

    // 1. Validate User & Address
    const user = await User.findById(userId).session(session);
    if (!user) throw new Error("User not found");

    const selectedAddress = user.addresses.find(
      (addr) => addr._id && addr._id.toString() === addressId
    );

    if (!selectedAddress) {
      throw new Error("Invalid address ID selected");
    }

    // 2. Validate Stock & Deduct It (Atomically)
    const orderItems = [];

    for (const item of items) {
      const product = await Product.findById(item.productId).session(session);
      if (!product) throw new Error(`Product ID ${item.productId} not found`);

      // Find specific variant (Color + Size)
      const variantIndex = product.stock.findIndex(
        (s) => s.colorName === item.color && s.size === item.size
      );

      if (variantIndex === -1) {
        throw new Error(
          `Variant ${item.color}/${item.size} unavailable for ${product.title}`
        );
      }

      const currentStock = product.stock[variantIndex].quantity;
      if (currentStock < item.quantity) {
        throw new Error(`Insufficient stock for ${product.title}`);
      }

      // DEDUCT STOCK
      product.stock[variantIndex].quantity -= item.quantity;
      await product.save({ session });

      // Add to Order Items Snapshot
      orderItems.push({
        product: product._id,
        title: product.title,
        price: product.discountPrice || product.price, // Use discount price if exists
        quantity: item.quantity,
        color: item.color,
        size: item.size,
        image: item.image || product.visuals[0]?.images[0],
      });
    }

    // 3. Create the Order
    const newOrderId = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const newOrder = new Order({
      user: userId,
      orderId: newOrderId,
      items: orderItems,
      shippingAddress: {
        name: user.fullname || user.username,
        door: selectedAddress.door,
        street: selectedAddress.street,
        city: selectedAddress.city,
        state: selectedAddress.state,
        zip: selectedAddress.zip,
        country: selectedAddress.country,
        phone: user.phone,
      },
      totalAmount,
      paymentMethod,
      paymentStatus: paymentMethod === "COD" ? "Pending" : "Paid",
      status: "Pending",
    });

    await newOrder.save({ session });

    // Commit Transaction (Stock is permanently deducted now)
    await session.commitTransaction();
    session.endSession();

    // 4. Trigger Worker (Fire and Forget)
    // We do NOT await this, so the user gets an immediate success response.
    triggerOrderProcessingWorker(newOrderId);

    res.status(201).json({
      success: true,
      message: "Order placed successfully",
      orderId: newOrder.orderId,
      order: newOrder,
    });
  } catch (error) {
    // Rollback stock deduction if anything fails
    await session.abortTransaction();
    session.endSession();
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get logged-in user's orders
 * @route   GET /api/orders/my-orders
 */
exports.getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .select("-items.product"); // Optimize query if needed

    res.status(200).json({ success: true, count: orders.length, orders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get single order details
 * @route   GET /api/orders/:id
 */
exports.getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate(
      "items.product",
      "slug category"
    );

    if (!order)
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });

    // Check ownership
    if (
      order.user.toString() !== req.user._id.toString() &&
      req.user.role !== "admin"
    ) {
      return res
        .status(401)
        .json({ success: false, message: "Not authorized" });
    }

    res.status(200).json({ success: true, order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Cancel Order (User Action)
 * @route   PUT /api/orders/:id/cancel
 */
exports.cancelOrder = async (req, res) => {
  try {
    const { reason } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order)
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });

    // Ensure User owns the order
    if (order.user.toString() !== req.user._id.toString()) {
      return res
        .status(401)
        .json({ success: false, message: "Not authorized" });
    }

    // CASE 1: Shipped/Delivered -> Cannot Cancel
    if (["Shipped", "Delivered"].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message:
          "Order has already been shipped. Please initiate a return instead.",
      });
    }

    // CASE 2: Pending -> Immediate Cancellation
    if (order.status === "Pending") {
      // TODO: Here you would ideally invoke a function to RESTORE stock

      order.status = "Cancelled";
      order.cancelledAt = Date.now();
      order.cancellationReason = reason || "User cancelled";
      await order.save();

      return res.status(200).json({
        success: true,
        message: "Order cancelled successfully.",
        status: "Cancelled",
      });
    }

    // CASE 3: Processing -> Request Admin Approval
    if (order.status === "Processing") {
      order.status = "Cancellation Requested";
      order.cancellationReason = reason;
      await order.save();

      return res.status(200).json({
        success: true,
        message: "Cancellation request sent to admin for approval.",
        status: "Cancellation Requested",
      });
    }

    res.status(400).json({
      success: false,
      message: "Order cannot be cancelled in current state",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Admin: Update Status or Approve Cancellation
 * @route   PUT /api/admin/orders/:id
 * @access  Private (Admin)
 */
exports.adminUpdateOrderStatus = async (req, res) => {
  try {
    const { status, trackingNumber } = req.body;
    // status can be: "Shipped", "Delivered", "Cancelled" (Approved), "Processing" (Rejected)

    const order = await Order.findById(req.params.id);
    if (!order)
      return res.status(404).json({ success: false, message: "Not found" });

    // Handle Cancellation Approval Logic
    if (order.status === "Cancellation Requested") {
      if (status === "Cancelled") {
        order.status = "Cancelled";
        order.cancelledAt = Date.now();
        // TODO: Restore Stock & Trigger Refund logic here
        await order.save();
        return res.json({
          success: true,
          message: "Cancellation Approved",
          order,
        });
      }
      if (status === "Processing") {
        order.status = "Processing"; // Reject request, go back to processing
        await order.save();
        return res.json({
          success: true,
          message: "Cancellation Rejected. Order resumed.",
          order,
        });
      }
    }

    // Normal Flow Updates
    if (status) order.status = status;
    if (trackingNumber) order.trackingNumber = trackingNumber;

    await order.save();

    res.status(200).json({
      success: true,
      message: `Order status updated to ${status}`,
      order,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
