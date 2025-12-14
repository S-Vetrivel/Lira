import React from "react";
import { Link } from "react-router-dom";
import { MOCK_WISHLIST } from "../constants";

export default function WishlistTab({ theme }) {
  return (
    <div>
      <h2 className="text-2xl font-bold uppercase mb-6">Your Wishlist</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {MOCK_WISHLIST.map((item) => (
          <div
            key={item.id}
            className="p-4 rounded-3xl border flex gap-4 transition-colors hover:border-current"
            style={{
              backgroundColor: theme.card?.bg || "rgba(255,255,255,0.02)",
              borderColor: theme.navbar?.border,
            }}
          >
            <Link to={`/shop/${item.id}`} className="shrink-0">
              <div className="w-24 h-24 rounded-2xl overflow-hidden bg-gray-100 hover:opacity-90 transition-opacity">
                <img
                  src={item.image}
                  alt={item.name}
                  className="w-full h-full object-cover"
                />
              </div>
            </Link>
            <div className="flex flex-col justify-between flex-1 py-1">
              <div>
                <Link to={`/shop/${item.id}`}>
                  <h3 className="font-bold leading-tight hover:underline">
                    {item.name}
                  </h3>
                </Link>
                <p className="text-xs font-bold uppercase tracking-wider opacity-60 mt-1">
                  {item.stock}
                </p>
              </div>
              <div className="flex justify-between items-end">
                <span className="font-bold">{item.price}</span>
                <button className="text-xs font-bold uppercase underline opacity-60 hover:opacity-100">
                  Move to Cart
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
