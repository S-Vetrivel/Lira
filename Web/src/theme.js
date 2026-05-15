export const DarkTheme = {
  name: "dark",
  bg: "#0B0C10", // Very dark sleek slate/black
  text: "#FFFFFF", // Crisp white text
  arrowBg: "#D4AF37", // Luxurious Champagne Gold
  rememberMe: "#8892B0", // Soft muted slate/blue

  // UI elements
  ui: {
    barBg: "#12141A", // Slightly lighter than bg
    barText: "#FFFFFF", 
  },

  navbar: {
    // Gray Tinted Glass Navbar
    bg: "rgba(40, 45, 55, 0.9)",
    border: "rgba(255, 255, 255, 0.1)",
    shadow: "0 8px 32px 0 rgba(0, 0, 0, 0.6)",

    // Text Colors
    textIdle: "#D1D5DB",
    textHover: "#FFFFFF",
    activePill: "rgba(255, 255, 255, 0.15)",

    // Logo
    logoBg: "#FFFFFF",
    logoText: "#0B0C10",

    // Search Bar
    searchBg: "rgba(255, 255, 255, 0.05)",
    searchHoverBg: "rgba(255, 255, 255, 0.1)",
    searchText: "#FFFFFF",
    searchBorder: "rgba(255, 255, 255, 0.1)",

    iconColor: "#FFFFFF",
    modalBg: "#12141A",
    modalOverlay: "rgba(0, 0, 0, 0.75)",
  },

  card: {
    imgBg: "#1A1D24", // Very dark gray for image backgrounds

    // Dark Glass Card
    bg: "rgba(18, 20, 26, 0.7)",
    border: "rgba(255, 255, 255, 0.05)",

    textPrimary: "#FFFFFF",
    textSecondary: "#8892B0",

    // Buttons
    btnBg: "#D4AF37", // Gold button
    btnText: "#0B0C10", // Dark text on gold button

    iconBtnBg: "rgba(255, 255, 255, 0.05)",
    iconBtnColor: "#FFFFFF",
  },

  badges: {
    new: { bg: "#D4AF37", text: "#0B0C10" }, // Gold
    sale: { bg: "#FF3366", text: "#FFFFFF" }, // Neon Red/Pink pop
    hot: { bg: "#00E5FF", text: "#0B0C10" }, // Electric Cyan
    default: { bg: "#1F232D", text: "#FFFFFF" },
  },

  scrollbar: {
    track: "#0B0C10",
    border: "#12141A",
    teeth: "#D4AF37", 
    handleBody: "#1F232D",
    handleStroke: "rgba(212, 175, 55, 0.3)",
    handleGradientStart: "#D4AF37", 
    handleGradientEnd: "#AA8C2C",
  },
};

export const LightTheme = {
  name: "light",
  bg: "#F9FAFB", // Soft off-white background
  text: "#111827", // Dark gray text
  arrowBg: "#D4AF37", 
  rememberMe: "#6B7280", 

  ui: {
    barBg: "#FFFFFF", 
    barText: "#111827", 
  },

  navbar: {
    // Gray Tinted Glass Navbar
    bg: "rgba(40, 45, 55, 0.9)",
    border: "rgba(255, 255, 255, 0.1)",
    shadow: "0 8px 32px 0 rgba(0, 0, 0, 0.2)",

    textIdle: "#D1D5DB",
    textHover: "#FFFFFF",
    activePill: "rgba(255, 255, 255, 0.15)",

    logoBg: "#FFFFFF",
    logoText: "#0B0C10",

    searchBg: "rgba(255, 255, 255, 0.05)",
    searchHoverBg: "rgba(255, 255, 255, 0.1)",
    searchText: "#FFFFFF",
    searchBorder: "rgba(255, 255, 255, 0.1)",

    iconColor: "#FFFFFF",
    modalBg: "#FFFFFF", // Modal itself should be light
    modalOverlay: "rgba(0, 0, 0, 0.4)",
  },

  card: {
    imgBg: "#F3F4F6", 

    bg: "rgba(255, 255, 255, 0.8)",
    border: "rgba(0, 0, 0, 0.05)",

    textPrimary: "#111827",
    textSecondary: "#6B7280",

    btnBg: "#0B0C10", 
    btnText: "#FFFFFF", 

    iconBtnBg: "rgba(0, 0, 0, 0.05)",
    iconBtnColor: "#111827",
  },

  badges: {
    new: { bg: "#D4AF37", text: "#0B0C10" },
    sale: { bg: "#FF3366", text: "#FFFFFF" },
    hot: { bg: "#00E5FF", text: "#0B0C10" },
    default: { bg: "#E5E7EB", text: "#111827" },
  },

  scrollbar: {
    track: "#F9FAFB",
    border: "#E5E7EB",
    teeth: "#D4AF37", 
    handleBody: "#D1D5DB",
    handleStroke: "rgba(212, 175, 55, 0.3)",
    handleGradientStart: "#D4AF37", 
    handleGradientEnd: "#AA8C2C",
  },
};

// Export LightTheme as default Theme for backwards compatibility in other imports
export const Theme = LightTheme;
