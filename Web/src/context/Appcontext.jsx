import React, { createContext, useContext, useState, useEffect } from "react";
import { checkAuth } from "../services/api"; // Ensure checkAuth is exported from api.js

const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check if user is logged in on page load (The "Me" check)
  useEffect(() => {
    const verifyUser = async () => {
      try {
        const result = await checkAuth();
        if (result.isAuthenticated) {
          setUser(result.user);
          console.log(result.user);
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error("Session check failed", error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    verifyUser();
  }, []);

  return (
    <AppContext.Provider value={{ user, setUser, loading }}>
      {!loading && children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  return useContext(AppContext);
};
