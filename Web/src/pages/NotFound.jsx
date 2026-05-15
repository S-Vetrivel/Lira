import React, { useContext } from "react";
import { ThemeContext } from "@/context/ThemeContext";
import { FileQuestion } from "lucide-react";
import { Link } from "react-router-dom";

export default function NotFound() {
  const { theme } = useContext(ThemeContext);

  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-center p-6 text-center"
      style={{ backgroundColor: theme.bg, color: theme.text }}
    >
      <FileQuestion size={80} className="mb-6 opacity-80" />
      <h1 className="text-6xl md:text-8xl font-black uppercase tracking-tighter mb-4">
        404
      </h1>
      <h2 className="text-2xl font-bold uppercase tracking-widest mb-4">
        Page Not Found
      </h2>
      <p className="text-lg opacity-60 mb-8 max-w-md">
        The page you are looking for doesn't exist or has been moved.
      </p>
      <Link
        to="/"
        className="px-8 py-3 rounded-full font-bold uppercase tracking-wider transition-transform hover:scale-105"
        style={{
          backgroundColor: theme.text,
          color: theme.bg,
        }}
      >
        Return Home
      </Link>
    </div>
  );
}
