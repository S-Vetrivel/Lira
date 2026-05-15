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

  const fetchBanners = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const res = await getBanners();
      if (res.success && Array.isArray(res.data)) {
        const allBanners = res.data;
        
        const formattedHome = allBanners
          .filter(b => b.page === "home")
          .sort((a, b) => (a.order || 0) - (b.order || 0))
          .map(b => ({
            id: b._id || b.id,
            desktopSrc: getImageUrl(b.desktopImage || b.image),
            tabletSrc: getImageUrl(b.desktopImage || b.image),
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
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBanners();

    // 5-minute polling interval
    const interval = setInterval(() => {
      console.log("Auto-refreshing banners...");
      fetchBanners(true);
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  // Prefetch ALL Images once banners are loaded or updated
  useEffect(() => {
    const allBanners = [...homeBanners, ...shopBanners];
    if (allBanners.length > 0) {
      allBanners.forEach((banner) => {
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
  }, [homeBanners, shopBanners]);

  return (
    <BannerContext.Provider value={{ homeBanners, shopBanners, isLoading, refreshBanners: fetchBanners }}>
      {children}
    </BannerContext.Provider>
  );
};
