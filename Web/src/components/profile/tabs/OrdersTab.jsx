import React from "react";
import { Link } from "react-router-dom";
import { ChevronRight, PackageX } from "lucide-react";
import { useApp } from "@/context/Appcontext"; // Global Context

// Helper to construct image URL
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
const getImageUrl = (path) => {
  if (!path) return "";
  if (path.startsWith("http") || path.startsWith("blob:")) return path;
  return `${API_BASE_URL}${path}`;
};

// Helper for Currency
const formatINR = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);

// Helper for Date
const formatDate = (dateString) => {
  if (!dateString) return "";
  return new Date(dateString).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

export default function OrdersTab({ theme }) {
  const { orders } = useApp();

  // Sort orders by date (newest first)
  const sortedOrders = [...(orders || [])].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );

  if (sortedOrders.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center py-20 border-2 border-dashed rounded-3xl opacity-50"
        style={{ borderColor: theme.navbar?.border }}
      >
        <PackageX size={48} className="mb-4" />
        <h3 className="text-lg font-bold uppercase">No Orders Yet</h3>
        <p className="text-sm">Start shopping to see your history here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold uppercase mb-6">Order History</h2>
      {sortedOrders.map((order) => (
        <div
          key={order._id}
          className="group flex flex-col md:flex-row items-start md:items-center justify-between p-6 rounded-3xl border transition-all hover:shadow-lg hover:border-current"
          style={{
            backgroundColor: theme.card?.bg || "rgba(255,255,255,0.02)",
            borderColor: theme.navbar?.border,
          }}
        >
          <div className="flex gap-4">
            {/* Product Images (Limit to 3) */}
            <div className="flex -space-x-4">
              {order.items.slice(0, 3).map((item, idx) => {
                const productId = item.product?._id || item.product;
                // Fallback if product was deleted but image string remains in order item
                const imgPath = item.image || item.product?.image || "";

                return (
                  <Link
                    to={`/shop/${productId}`}
                    key={item._id || idx}
                    className="relative w-16 h-16 rounded-xl overflow-hidden border-2 border-white dark:border-black hover:z-10 hover:scale-110 transition-transform bg-gray-100"
                  >
                    <img
                      src={getImageUrl(imgPath)}
                      alt={item.title || "Product"}
                      className="w-full h-full object-cover"
                      onError={(e) => (e.target.style.display = "none")}
                    />
                  </Link>
                );
              })}
              {order.items.length > 3 && (
                <div className="relative w-16 h-16 rounded-xl border-2 border-white dark:border-black flex items-center justify-center bg-gray-200 text-xs font-bold z-0">
                  +{order.items.length - 3}
                </div>
              )}
            </div>

            {/* Order Info */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-3">
                <h3 className="font-bold text-lg font-mono">
                  #{order._id.slice(-6).toUpperCase()}
                </h3>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                    order.status === "Delivered"
                      ? "bg-green-500/10 text-green-500"
                      : order.status === "Cancelled"
                      ? "bg-red-500/10 text-red-500"
                      : order.status === "Shipped"
                      ? "bg-blue-500/10 text-blue-500"
                      : "bg-yellow-500/10 text-yellow-500" // Processing/Pending
                  }`}
                >
                  {order.status}
                </span>
              </div>

              {/* Product Titles Summary */}
              <p className="text-sm opacity-60 max-w-[200px] md:max-w-md truncate">
                {order.items.map((i) => i.title || "Product").join(", ")}
              </p>

              <p className="text-xs opacity-40 font-mono mt-1">
                {formatDate(order.createdAt)}
              </p>
            </div>
          </div>

          {/* Total & Action */}
          <div className="flex items-center justify-between w-full md:w-auto mt-4 md:mt-0 gap-8">
            <div className="text-right">
              <p className="text-[10px] uppercase opacity-50">Total Amount</p>
              <p className="font-bold text-lg">
                {formatINR(order.totalAmount)}
              </p>
            </div>

            {/* View Details Button (Visual Only or Link to Details Page if you have one) */}
            <button
              className="p-2 rounded-full border hover:bg-current hover:text-white dark:hover:text-black transition-colors"
              style={{ borderColor: theme.text }}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
