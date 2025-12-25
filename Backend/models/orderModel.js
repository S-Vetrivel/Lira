const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const OrderItemSchema = new Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    // Snapshot of product details at time of purchase
    title: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },

    // Variant details
    color: { type: String },
    size: { type: String },
    image: { type: String }, // Thumbnail
  },
  { _id: false }
);

const OrderSchema = new Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Unique human-readable Order ID (e.g., ORD-1735152345)
    orderId: { type: String, unique: true, required: true },

    items: [OrderItemSchema],

    // Address Snapshot (Copied from User address to preserve history)
    shippingAddress: {
      name: { type: String, required: true },
      door: String,
      street: String,
      city: String,
      state: String,
      zip: String,
      country: String,
      phone: String,
    },

    // Financials
    totalAmount: { type: Number, required: true },
    paymentMethod: { type: String, enum: ["COD", "Online"], default: "COD" },
    paymentStatus: {
      type: String,
      enum: ["Pending", "Paid", "Failed", "Refunded"],
      default: "Pending",
    },

    // Order Lifecycle State Machine
    status: {
      type: String,
      enum: [
        "Pending", // Placed, stock deducted, waiting for worker
        "Processing", // Worker picked up / Packed
        "Shipped", // With courier
        "Delivered", // Completed
        "Cancelled", // Final cancelled state
        "Cancellation Requested", // User asked to cancel, waiting for admin
      ],
      default: "Pending",
    },

    // Cancellation Details
    cancellationReason: { type: String },
    cancelledAt: { type: Date },

    // Admin/Worker Tracking
    processedByWorker: { type: Boolean, default: false },
    trackingNumber: { type: String },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Order", OrderSchema);
