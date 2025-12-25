const Order = require("../models/orderModel");
const Product = require("../models/productModel");
const User = require("../models/userModel");
const mongoose = require("mongoose");

// --- WORKER SIMULATION ---
const triggerOrderProcessingWorker = (orderId) => {
  return new Promise((resolve) => {
    console.log(`[Worker] Job started for Order ${orderId}...`);
    setTimeout(async () => {
      try {
        const order = await Order.findOneAndUpdate(
          { orderId: orderId, status: "Pending" },
          { status: "Processing", processedByWorker: true },
          { new: true }
        );
        if (order)
          console.log(`[Worker] Order ${orderId} moved to PROCESSING.`);
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
 */
exports.createOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { items, addressId, paymentMethod, totalAmount, phone } = req.body;
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

    // 2. Resolve Phone Number
    let finalPhone = phone || user.phone || user.mobile;

    if (!finalPhone) {
      throw new Error("Phone number is required to place an order.");
    }

    // Update User Profile if phone was missing
    if (!user.phone && !user.mobile) {
      user.phone = finalPhone;
      await user.save({ session });
    }

    // 3. Validate Stock & Deduct (Atomically)
    const orderItems = [];

    // Helper to normalize strings for comparison (trim spaces, lowercase)
    const normalize = (str) =>
      String(str || "")
        .trim()
        .toLowerCase();

    for (const item of items) {
      const productId = item.product || item.productId;
      const product = await Product.findById(productId).session(session);

      if (!product) throw new Error(`Product ID ${productId} not found`);

      // ROBUST MATCHING LOGIC
      const variantIndex = product.stock.findIndex((s) => {
        const dbColor = normalize(s.colorName);
        const reqColor = normalize(item.color);
        const dbSize = normalize(s.size);
        const reqSize = normalize(item.size);

        return dbColor === reqColor && dbSize === reqSize;
      });

      if (variantIndex === -1) {
        // DEBUG LOGGING: Print what we have vs what we asked for
        console.error("Variant Mismatch Error:");
        console.error(`Requested: Color="${item.color}", Size="${item.size}"`);
        console.error(
          "Available Variants in DB:",
          product.stock.map((s) => `${s.colorName}/${s.size}`)
        );

        throw new Error(
          `Variant ${item.color}/${item.size} unavailable for ${product.title}`
        );
      }

      const currentStock = product.stock[variantIndex].quantity;
      if (currentStock < item.quantity) {
        throw new Error(
          `Insufficient stock for ${product.title} (${item.color}/${item.size})`
        );
      }

      // Deduct Stock
      product.stock[variantIndex].quantity -= item.quantity;
      await product.save({ session });

      orderItems.push({
        product: product._id,
        title: product.title,
        price: product.discountPrice || product.price,
        quantity: item.quantity,
        color: item.color,
        size: item.size,
        image: item.image || (product.visuals && product.visuals[0]?.images[0]),
      });
    }

    // 4. Create Order
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
        phone: finalPhone,
      },
      totalAmount,
      paymentMethod,
      paymentStatus: paymentMethod === "COD" ? "Pending" : "Paid",
      status: "Pending",
    });

    await newOrder.save({ session });

    await session.commitTransaction();
    session.endSession();

    // 5. Trigger Worker
    triggerOrderProcessingWorker(newOrderId);

    res.status(201).json({
      success: true,
      message: "Order placed successfully",
      orderId: newOrder.orderId,
      order: newOrder,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Order Creation Error:", error.message);
    res.status(400).json({ success: false, message: error.message });
  }
};

// ... (Other controllers remain unchanged: getMyOrders, getOrderById, cancelOrder, adminUpdateOrderStatus)
exports.getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .select("-items.product");
    res.status(200).json({ success: true, count: orders.length, orders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate(
      "items.product",
      "slug category title image"
    );
    if (!order)
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
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

exports.cancelOrder = async (req, res) => {
  try {
    const { reason } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order)
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    if (order.user.toString() !== req.user._id.toString()) {
      return res
        .status(401)
        .json({ success: false, message: "Not authorized" });
    }
    if (["Shipped", "Delivered"].includes(order.status)) {
      return res
        .status(400)
        .json({ success: false, message: "Cannot cancel shipped order." });
    }
    if (order.status === "Pending") {
      order.status = "Cancelled";
      order.cancelledAt = Date.now();
      order.cancellationReason = reason || "User cancelled";
      await order.save();
      return res
        .status(200)
        .json({
          success: true,
          message: "Order cancelled.",
          status: "Cancelled",
        });
    }
    if (order.status === "Processing") {
      order.status = "Cancellation Requested";
      order.cancellationReason = reason;
      await order.save();
      return res
        .status(200)
        .json({
          success: true,
          message: "Cancellation requested.",
          status: "Cancellation Requested",
        });
    }
    res
      .status(400)
      .json({
        success: false,
        message: "Order cannot be cancelled in current state",
      });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.adminUpdateOrderStatus = async (req, res) => {
  try {
    const { status, trackingNumber } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order)
      return res.status(404).json({ success: false, message: "Not found" });
    if (order.status === "Cancellation Requested") {
      if (status === "Cancelled") {
        order.status = "Cancelled";
        order.cancelledAt = Date.now();
        await order.save();
        return res.json({
          success: true,
          message: "Cancellation Approved",
          order,
        });
      }
      if (status === "Processing") {
        order.status = "Processing";
        await order.save();
        return res.json({
          success: true,
          message: "Cancellation Rejected",
          order,
        });
      }
    }
    if (status) order.status = status;
    if (trackingNumber) order.trackingNumber = trackingNumber;
    await order.save();
    res
      .status(200)
      .json({ success: true, message: `Order updated to ${status}`, order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
