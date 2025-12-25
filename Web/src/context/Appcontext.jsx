import React, { createContext, useContext, useState, useEffect } from "react";
import { checkAuth, getCart, getMyOrders } from "../services/api";

const AppContext = createContext();

export const AppProvider = ({ children }) => {
  // 1. OPTIMISTIC INITIALIZATION
  // We initialize immediately from LocalStorage so the user can use the app offline.
  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem("app_user");
    return storedUser ? JSON.parse(storedUser) : null;
  });

  const [cart, setCart] = useState(() => {
    const stored = localStorage.getItem("app_cart");
    return stored ? JSON.parse(stored) : null;
  });

  const [orders, setOrders] = useState(() => {
    const stored = localStorage.getItem("app_orders");
    return stored ? JSON.parse(stored) : [];
  });

  // This loading state now just means "Background validation is running"
  // It does NOT block the UI anymore.
  const [isValidating, setIsValidating] = useState(true);

  // --- BACKGROUND VALIDATION LOOP ---
  useEffect(() => {
    let isMounted = true;

    const verifyUser = async () => {
      let isChecked = false;

      // 2. BACKGROUND VALIDATION LOOP
      // This runs silently. If offline, it retries forever.
      // If online, it updates the user state to the "source of truth" from the server.
      while (!isChecked) {
        try {
          const result = await checkAuth();

          if (result.isAuthenticated) {
            // Server confirms user: Update state (in case details changed)
            setUser(result.user);

            // Step B: Only if authenticated, fetch Cart & Orders
            // We run these in parallel for speed
            const [cartRes, ordersRes] = await Promise.allSettled([
              getCart(),
              getMyOrders(),
            ]);

            if (cartRes.status === "fulfilled" && cartRes.value.success) {
              setCart(cartRes.value.cart);
            }

            if (ordersRes.status === "fulfilled" && ordersRes.value.success) {
              setOrders(ordersRes.value.orders);
            }
          } else {
            // Server says invalid session (e.g., token expired): Force logout
            setUser(null);
            setCart(null);
            setOrders([]);
          }

          isChecked = true; // Connection successful, stop loop
        } catch (error) {
          // Network Error: Keep using LocalStorage data, retry in 3s
          console.warn("Network unreachable. Retrying in background...");
          await new Promise((resolve) => setTimeout(resolve, 3000));
        }
      }

      if (isMounted) setIsValidating(false);
    };

    verifyUser();

    return () => {
      isMounted = false;
    };
  }, []);

  // 3. SYNC LOCAL STORAGE
  useEffect(() => {
    if (user) localStorage.setItem("app_user", JSON.stringify(user));
    else localStorage.removeItem("app_user");
  }, [user]);

  useEffect(() => {
    if (cart) localStorage.setItem("app_cart", JSON.stringify(cart));
    else localStorage.removeItem("app_cart");
  }, [cart]);

  useEffect(() => {
    if (orders && orders.length > 0)
      localStorage.setItem("app_orders", JSON.stringify(orders));
    else localStorage.removeItem("app_orders");
  }, [orders]);

  // --- 4. HELPER ACTIONS ---
  // Exposed so pages can manually trigger updates (e.g., after adding to cart)
  const refreshCart = async () => {
    try {
      const res = await getCart();
      if (res.success) setCart(res.cart);
    } catch (e) {
      console.error("Manual cart refresh failed", e);
    }
  };

  const refreshOrders = async () => {
    try {
      const res = await getMyOrders();
      if (res.success) setOrders(res.orders);
    } catch (e) {
      console.error("Manual order refresh failed", e);
    }
  };

  return (
    // We expose 'isValidating' in case you want to show a small "Connecting..."
    // badge in a corner, but the main app renders immediately.
    <AppContext.Provider
      value={{
        user,
        setUser,
        cart,
        setCart,
        orders,
        setOrders,
        isValidating,
        refreshCart,
        refreshOrders,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
