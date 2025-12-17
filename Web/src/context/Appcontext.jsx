import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
} from "react";
import { checkAuth } from "../services/api";

const AppContext = createContext({});

export const AppProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem("app_user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      try {
        localStorage.removeItem("app_user");
      } catch {}
      return null;
    }
  });

  const [isValidating, setIsValidating] = useState(true);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const verifyUser = async () => {
      let attempt = 0;
      while (mounted.current) {
        try {
          const result = await checkAuth();
          if (!mounted.current) break;
          if (result && result.isAuthenticated) setUser(result.user ?? null);
          else setUser(null);
          break;
        } catch (err) {
          attempt++;
          const delay = Math.min(
            Math.round(3000 * Math.pow(1.5, attempt)),
            30000
          );
          await new Promise((res) => setTimeout(res, delay));
        }
      }
      if (mounted.current) setIsValidating(false);
    };

    verifyUser();
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    try {
      if (user) localStorage.setItem("app_user", JSON.stringify(user));
      else localStorage.removeItem("app_user");
    } catch {
      try {
        localStorage.removeItem("app_user");
      } catch {}
    }
  }, [user]);

  return (
    <AppContext.Provider value={{ user, setUser, isValidating }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
