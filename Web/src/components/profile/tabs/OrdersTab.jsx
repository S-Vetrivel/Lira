import React from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { MOCK_ORDERS } from "../constants";

export default function OrdersTab({ theme }) {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold uppercase mb-6">Order History</h2>
      {MOCK_ORDERS.map((order) => (
        <div
          key={order.id}
          className="group flex flex-col md:flex-row items-start md:items-center justify-between p-6 rounded-3xl border transition-all hover:shadow-lg hover:border-current"
          style={{
            backgroundColor: theme.card?.bg || "rgba(255,255,255,0.02)",
            borderColor: theme.navbar?.border,
          }}
        >
          <div className="flex gap-4">
            <div className="flex -space-x-4">
              {order.items.map((item) => (
                <Link
                  to={`/shop/${item.id}`}
                  key={item.id}
                  className="relative w-16 h-16 rounded-xl overflow-hidden border-2 border-white dark:border-black hover:z-10 hover:scale-110 transition-transform"
                >
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                </Link>
              ))}
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-3">
                <h3 className="font-bold text-lg font-mono">{order.id}</h3>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                    order.status === "Delivered"
                      ? "bg-green-500/10 text-green-500"
                      : order.status === "Processing"
                      ? "bg-yellow-500/10 text-yellow-500"
                      : "bg-blue-500/10 text-blue-500"
                  }`}
                >
                  {order.status}
                </span>
              </div>
              <p className="text-sm opacity-60">
                {order.items.map((i) => i.name).join(", ")}
              </p>
              <p className="text-xs opacity-40 font-mono mt-1">{order.date}</p>
            </div>
          </div>

          <div className="flex items-center justify-between w-full md:w-auto mt-4 md:mt-0 gap-8">
            <p className="font-bold text-lg">{order.total}</p>
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
