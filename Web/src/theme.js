export const Theme = {
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
    // Dark Glass Navbar
    bg: "rgba(11, 12, 16, 0.85)",
    border: "rgba(212, 175, 55, 0.15)", // Subtle gold border
    shadow: "0 8px 32px 0 rgba(0, 0, 0, 0.6)",

    // Text Colors
    textIdle: "#8892B0", // Soft slate
    textHover: "#D4AF37", // Gold on hover
    activePill: "rgba(212, 175, 55, 0.2)", // Gold pill bg

    // Logo
    logoBg: "#D4AF37", // Gold Box
    logoText: "#0B0C10", // Dark Text

    // Search Bar
    searchBg: "#12141A",
    searchHoverBg: "#1F232D",
    searchText: "#FFFFFF",
    searchBorder: "rgba(212, 175, 55, 0.3)",

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
