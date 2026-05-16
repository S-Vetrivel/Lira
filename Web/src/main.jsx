import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import { ThemeProvider } from "./context/ThemeContext";
import { AppProvider } from "./context/Appcontext";
import { BannerProvider } from "./context/BannerContext";
import { HelmetProvider } from 'react-helmet-async';
ReactDOM.createRoot(document.getElementById("root")).render(
  <HelmetProvider>
    <AppProvider>
      <BrowserRouter>
        <ThemeProvider>
          <BannerProvider>
            <App />
          </BannerProvider>
        </ThemeProvider>
      </BrowserRouter>
    </AppProvider>
  </HelmetProvider>
);
