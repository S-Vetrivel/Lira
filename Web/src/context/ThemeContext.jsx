import { createContext, useState, useEffect } from "react";
import { DarkTheme, LightTheme } from "../theme";

export const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [themeName, setThemeName] = useState(() => {
    const saved = localStorage.getItem("appTheme");
    return saved ? saved : "light";
  });

  const theme = themeName === "dark" ? DarkTheme : LightTheme;

  const toggleTheme = () => {
    const newTheme = themeName === "light" ? "dark" : "light";
    setThemeName(newTheme);
    localStorage.setItem("appTheme", newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, themeName }}>
      <div
        style={{
          background: theme.bg,
          color: theme.text,
          minHeight: "100vh",
          transition: "background 0.3s ease, color 0.3s ease",
        }}
      >
        {children}
      </div>
    </ThemeContext.Provider>
  );
};
