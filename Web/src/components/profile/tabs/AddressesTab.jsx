import React from "react";
import { Plus, CheckCircle2, MapPin, Edit3 } from "lucide-react";
import { MOCK_ADDRESSES } from "../constants";

export default function AddressesTab({ theme }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-2xl font-bold uppercase tracking-tight">
          Saved Addresses
        </h2>
        <button
          className="flex items-center gap-2 px-4 py-2 rounded-full border text-xs font-bold uppercase tracking-wider hover:bg-current hover:text-white dark:hover:text-black transition-colors"
          style={{ borderColor: theme.text }}
        >
          <Plus size={16} /> Add New
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {MOCK_ADDRESSES.map((addr) => (
          <div
            key={addr.id}
            className="group p-6 rounded-3xl border flex flex-col justify-between min-h-[220px] relative transition-all hover:border-current"
            style={{ borderColor: theme.navbar?.border }}
          >
            {addr.default && (
              <span className="absolute top-6 right-6 flex items-center gap-1 text-[10px] font-bold uppercase text-green-500 bg-green-500/10 px-2 py-1 rounded">
                <CheckCircle2 size={12} /> Default
              </span>
            )}

            <div>
              <div className="flex items-center gap-2 mb-2 opacity-50">
                <MapPin size={16} />
                <span className="text-xs font-bold uppercase tracking-widest">
                  {addr.label}
                </span>
              </div>
              <h3 className="font-bold text-lg mb-1">{addr.name}</h3>
              <p className="text-lg font-medium leading-relaxed opacity-80">
                {addr.mobile}
              </p>
              <p className="text-sm opacity-60 mt-3 leading-relaxed font-mono">
                {addr.street}
                <br />
                {addr.city}, {addr.state} {addr.zip}
              </p>
            </div>

            <div
              className="flex gap-4 mt-6 pt-4 border-t border-dashed"
              style={{ borderColor: theme.navbar?.border }}
            >
              <button className="flex items-center gap-1 text-xs font-bold uppercase hover:opacity-60 transition-opacity">
                <Edit3 size={14} /> Edit
              </button>
              <button className="text-xs font-bold uppercase text-red-500 hover:opacity-60 transition-opacity">
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
