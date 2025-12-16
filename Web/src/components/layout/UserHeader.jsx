import React, { useState, useEffect } from "react";
import { ShoppingBag, User } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useApp } from "../../context/Appcontext";

// Get API URL from env (Same as in ProfileHeader)
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

const UserHeader = ({ theme }) => {
  const { user } = useApp();
  const [cartCount, setCartCount] = useState(2); // Mock Cart Count
  const [imgError, setImgError] = useState(false); // State to track image load errors

  // Reset error state if the user's picture url changes
  useEffect(() => {
    setImgError(false);
  }, [user?.profilePicture]);

  // --- LOGIC: Resolve Image URL ---
  const getImageUrl = (path) => {
    if (!path) return null;
    // Check for "http" (External/Google) or "blob:" (Local Preview/Optimistic Update)
    if (path.startsWith("http") || path.startsWith("blob:")) {
      return path;
    }
    // Otherwise, append API URL (for backend uploads)
    return `${API_BASE_URL}${path}`;
  };

  const profileSrc = getImageUrl(user?.profilePicture);
  const hasValidImage = user && profileSrc && !imgError;

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

          {/* Cart Badge Logic */}
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
          className="relative w-10 h-10 flex items-center justify-center rounded-full overflow-hidden border transition-colors hover:opacity-80"
          style={{
            backgroundColor: theme.navbar.searchBg,
            borderColor: theme.navbar.border,
            color: theme.navbar.iconColor,
          }}
        >
          {hasValidImage ? (
            // Authenticated & Valid Image
            <img
              key={profileSrc} // Force re-render on URL change
              src={profileSrc} // Use resolved URL
              alt="Profile"
              className="w-full h-full object-cover"
              onError={() => setImgError(true)} // Handle broken links
            />
          ) : (
            // Guest OR Logged-in Fallback (User Icon)
            <User size={20} className={user ? "opacity-100" : "opacity-80"} />
          )}
        </motion.button>
      </Link>
    </div>
  );
};

export default UserHeader;
