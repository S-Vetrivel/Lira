import React, { createContext, useState, useEffect } from "react";
import { getBanners } from "@/services/api";

const getImageUrl = (path) => {
  if (!path) return "";
  if (path.startsWith("http") || path.startsWith("blob")) return path;
  return `${import.meta.env.VITE_API_URL}${path}`;
};

export const BannerContext = createContext({
  homeBanners: [],
  shopBanners: [],
  isLoading: true,
  refreshBanners: () => {},
});

export const BannerProvider = ({ children }) => {
  const [homeBanners, setHomeBanners] = useState([]);
  const [shopBanners, setShopBanners] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchBanners = async () => {
    setIsLoading(true);
    try {
      const res = await getBanners();
      if (res.success) {
        const allBanners = res.data;
        
        const formattedHome = allBanners
          .filter(b => b.page === "home")
          .sort((a, b) => (a.order || 0) - (b.order || 0))
          .map(b => ({
            id: b._id || b.id,
            desktopSrc: getImageUrl(b.desktopImage || b.image),
            tabletSrc: getImageUrl(b.desktopImage || b.image), // fallback to desktop for tablet
            mobileSrc: getImageUrl(b.mobileImage || b.image),
            title: b.title,
            subtitle: b.subtitle,
          }));

        const formattedShop = allBanners
          .filter(b => b.page === "shop")
          .sort((a, b) => (a.order || 0) - (b.order || 0))
          .map(b => ({
            id: b._id || b.id,
            desktopSrc: getImageUrl(b.desktopImage || b.image),
            tabletSrc: getImageUrl(b.desktopImage || b.image),
            mobileSrc: getImageUrl(b.mobileImage || b.image),
            title: b.title,
            subtitle: b.subtitle,
          }));

        setHomeBanners(formattedHome);
        setShopBanners(formattedShop);
      }
    } catch (error) {
      console.error("Error fetching banners:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBanners();
  }, []);

  // Prefetch Shop Images once shopBanners are loaded
  useEffect(() => {
    if (shopBanners.length > 0) {
      console.log("Prefetching shop banners...");
      shopBanners.forEach((banner) => {
        if (banner.desktopSrc) {
          const img = new Image();
          img.src = banner.desktopSrc;
        }
        if (banner.mobileSrc) {
          const img = new Image();
          img.src = banner.mobileSrc;
        }
      });
    }
  }, [shopBanners]);

  return (
    <BannerContext.Provider value={{ homeBanners, shopBanners, isLoading, refreshBanners: fetchBanners }}>
      {children}
    </BannerContext.Provider>
  );
};
