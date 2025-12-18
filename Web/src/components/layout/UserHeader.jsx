import React, { useState, useEffect } from "react";
import { ShoppingBag, User } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { useApp } from "../../context/Appcontext";

// Get API URL from env
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

const UserHeader = ({ theme }) => {
  const { user } = useApp();
  const [cartCount, setCartCount] = useState(2); // Mock Cart Count

  // Image State: 'loading' | 'loaded' | 'error'
  const [imgStatus, setImgStatus] = useState("loading");

  // --- LOGIC: Resolve Image URL ---
  const getImageUrl = (path) => {
    if (!path) return null;
    if (path.startsWith("http") || path.startsWith("blob:")) {
      return path;
    }
    return `${API_BASE_URL}${path}`;
  };

  const profileSrc = getImageUrl(user?.profilePicture);

  // Reset state when the image source changes (e.g., Blob -> URL, or User A -> User B)
  useEffect(() => {
    if (profileSrc) {
      setImgStatus("loading");
    } else {
      setImgStatus("error"); // No image source = fallback to icon
    }
  }, [profileSrc]);

  return (
    <div className="flex items-center gap-2 mr-2">
      {/* --- CART COMPONENT --- */}
      <Link to="/cart">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          style={{
            backgroundColor: theme.navbar.searchBg,
            color: theme.navbar.iconColor,
          }}
          className="relative w-10 h-10 flex items-center justify-center rounded-full transition-colors hover:opacity-80"
        >
          <ShoppingBag size={20} />
          {cartCount > 0 && (
            <span className="absolute top-0 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-white dark:ring-black">
              {cartCount}
            </span>
          )}
        </motion.button>
      </Link>

      {/* --- PROFILE COMPONENT --- */}
      <Link to={user ? "/profile" : "/login"}>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="relative w-10 h-10 flex items-center justify-center rounded-full overflow-hidden border transition-colors group"
          style={{
            backgroundColor: theme.navbar.searchBg,
            borderColor: theme.navbar.border,
            color: theme.navbar.iconColor,
          }}
        >
          <AnimatePresence mode="wait">
            {/* 1. GLASSMORPHIC SKELETON (Shows while loading) */}
            {imgStatus === "loading" && user && (
              <motion.div
                key="skeleton"
                initial={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-20 flex items-center justify-center"
              >
                {/* The Glass Effect Layer */}
                <div className="w-full h-full bg-gray-200/20 dark:bg-white/10 backdrop-blur-md animate-pulse" />
              </motion.div>
            )}

            {/* 2. ACTUAL IMAGE (Hidden until loaded) */}
            {profileSrc && imgStatus !== "error" ? (
              <motion.img
                key={profileSrc}
                src={profileSrc}
                alt="Profile"
                initial={{ opacity: 0 }}
                animate={{ opacity: imgStatus === "loaded" ? 1 : 0 }}
                transition={{ duration: 0.3 }}
                className="w-full h-full object-cover absolute inset-0 z-10"
                onLoad={() => setImgStatus("loaded")}
                onError={() => setImgStatus("error")}
              />
            ) : (
              // 3. FALLBACK ICON (Guest or Error)
              <User
                size={20}
                className={`z-0 ${user ? "opacity-100" : "opacity-80"}`}
              />
            )}
          </AnimatePresence>
        </motion.button>
      </Link>
    </div>
  );
};

export default UserHeader;
