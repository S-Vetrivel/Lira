import React, { useContext } from "react";
import { ThemeContext } from "@/context/ThemeContext";
import { WifiOff } from "lucide-react";

export default function NetworkError() {
  const { theme } = useContext(ThemeContext);

  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-center p-6 text-center"
      style={{ backgroundColor: theme.bg, color: theme.text }}
    >
      <WifiOff size={80} className="mb-6 opacity-80" />
      <h1 className="text-4xl md:text-5xl font-black uppercase tracking-widest mb-4">
        Connection Lost
      </h1>
      <p className="text-lg opacity-60 mb-8 max-w-md">
        We couldn't connect to the server. Please check your internet connection and try again.
      </p>
      <button
        onClick={() => window.location.href = "/"}
        className="px-8 py-3 rounded-full font-bold uppercase tracking-wider transition-transform hover:scale-105"
        style={{
          backgroundColor: theme.text,
          color: theme.bg,
        }}
      >
        Try Again
      </button>
    </div>
  );
}
