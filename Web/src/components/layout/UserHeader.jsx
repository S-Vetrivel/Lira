import React, { useState, useEffect } from "react";
import {
  ShoppingBag,
  User,
  Bell,
  AlertCircle,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { useApp } from "../../context/Appcontext";
import Modal from "../../components/layout/Modal"; // Adjust path if necessary

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

// --- MOCK DATA (Replace with real API data later) ---
const MOCK_NOTIFICATIONS = [
  {
    id: 1,
    type: "order",
    title: "New Order #ORD-992",
    message: "New COD order received from Vetrivel S.",
    time: "2 min ago",
    read: false,
  },
  {
    id: 2,
    type: "alert",
    title: "Low Stock Alert",
    message: "Product 'Urban Street T-Shirt' is below 5 units.",
    time: "1 hour ago",
    read: false,
  },
  {
    id: 3,
    type: "success",
    title: "System Update",
    message: "Maintenance completed successfully.",
    time: "1 day ago",
    read: true,
  },
];

const UserHeader = ({ theme }) => {
  const { user, cart } = useApp();
  const [isNotifyOpen, setIsNotifyOpen] = useState(false);

  // --- Logic: Role Detection ---
  const isStaffOrAdmin = ["admin", "staff"].includes(user?.role);

  // --- Logic: Cart Count (For Users) ---
  const cartCount =
    cart?.items?.reduce((acc, item) => acc + item.quantity, 0) || 0;

  // --- Logic: Notification Count (For Admin/Staff) ---
  const unreadCount = MOCK_NOTIFICATIONS.filter((n) => !n.read).length;

  // --- Logic: Profile Image ---
  const [imgError, setImgError] = useState(false);
  const [blobLoaded, setBlobLoaded] = useState(false);

  const getImageUrl = (path) => {
    if (!path) return null;
    if (path.startsWith("http") || path.startsWith("blob:")) return path;
    return `${API_BASE_URL}${path}`;
  };

  const profileSrc = getImageUrl(user?.profilePicture);
  const isDirectUrl = profileSrc?.startsWith("http");

  useEffect(() => {
    setImgError(false);
    if (!isDirectUrl) setBlobLoaded(false);
  }, [profileSrc, isDirectUrl]);

  return (
    <>
      <div className="flex items-center gap-2 mr-2">
        {/* 1. CONDITIONAL BUTTON: CART (User) vs NOTIFICATIONS (Admin/Staff) */}
        {isStaffOrAdmin ? (
          // --- ADMIN/STAFF: NOTIFICATION BELL ---
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsNotifyOpen(true)}
            style={{
              backgroundColor: theme.navbar.searchBg,
              color: theme.navbar.iconColor,
            }}
            className="relative w-10 h-10 flex items-center justify-center rounded-full transition-colors hover:opacity-80"
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute top-0 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-white dark:ring-black">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </motion.button>
        ) : (
          // --- USER: SHOPPING CART ---
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
                  {cartCount > 99 ? "99+" : cartCount}
                </span>
              )}
            </motion.button>
          </Link>
        )}

        {/* 2. PROFILE BUTTON (Common for all) */}
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
            {!isDirectUrl && !blobLoaded && !imgError && profileSrc && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-gray-200/20 dark:bg-white/10 backdrop-blur-md animate-pulse" />
            )}

            {profileSrc && !imgError ? (
              <img
                key={profileSrc}
                src={profileSrc}
                alt="Profile"
                referrerPolicy="no-referrer"
                className={`w-full h-full object-cover absolute inset-0 z-10 transition-opacity duration-300 ${
                  isDirectUrl || blobLoaded ? "opacity-100" : "opacity-0"
                }`}
                onLoad={() => setBlobLoaded(true)}
                onError={() => {
                  setImgError(true);
                  setBlobLoaded(true);
                }}
              />
            ) : (
              <User
                size={20}
                className={`z-0 ${user ? "opacity-100" : "opacity-80"}`}
              />
            )}
          </motion.button>
        </Link>
      </div>

      {/* --- NOTIFICATION MODAL --- */}
      <Modal
        isOpen={isNotifyOpen}
        onClose={() => setIsNotifyOpen(false)}
        title="Notifications"
        description={`You have ${unreadCount} unread messages.`}
        theme={theme}
      >
        <div className="flex flex-col gap-3">
          {MOCK_NOTIFICATIONS.length === 0 ? (
            <div className="text-center py-10 opacity-50">
              <Bell size={48} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">No new notifications</p>
            </div>
          ) : (
            MOCK_NOTIFICATIONS.map((note) => (
              <div
                key={note.id}
                className={`p-4 rounded-2xl border transition-colors flex gap-4 ${
                  !note.read
                    ? "bg-blue-500/5 border-blue-500/20"
                    : "bg-transparent hover:bg-black/5 dark:hover:bg-white/5"
                }`}
                style={{
                  borderColor: !note.read ? "" : theme.navbar.border,
                }}
              >
                {/* Icon based on type */}
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                    note.type === "alert"
                      ? "bg-red-500/10 text-red-500"
                      : note.type === "success"
                      ? "bg-green-500/10 text-green-500"
                      : "bg-blue-500/10 text-blue-500"
                  }`}
                >
                  {note.type === "alert" && <AlertCircle size={20} />}
                  {note.type === "success" && <CheckCircle2 size={20} />}
                  {note.type === "order" && <ShoppingBag size={20} />}
                </div>

                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <h4 className="font-bold text-sm">{note.title}</h4>
                    {!note.read && (
                      <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-1.5" />
                    )}
                  </div>
                  <p className="text-xs opacity-70 mt-1 leading-relaxed">
                    {note.message}
                  </p>
                  <p className="text-[10px] font-mono opacity-40 mt-2 flex items-center gap-1">
                    <Clock size={10} /> {note.time}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </Modal>
    </>
  );
};

export default UserHeader;
