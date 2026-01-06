import React, {
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { ThemeContext } from "@/context/ThemeContext";
import HeroCarousel from "@/components/home/HeroCarousel";
import ProductCard from "@/components/ProductCard";
import { getAllProducts } from "@/services/api"; // API Service
import { Loader2 } from "lucide-react"; // Loader Icon

// --- STATIC DATA FOR HERO (Visuals only) ---
const SLIDES_DATA = [
  {
    desktopSrc:
      "https://images.unsplash.com/photo-1483985988355-763728e1935b?q=80&w=1920&auto=format&fit=crop",
    tabletSrc:
      "https://images.unsplash.com/photo-1483985988355-763728e1935b?q=80&w=1000&auto=format&fit=crop",
    mobileSrc:
      "https://images.unsplash.com/photo-1483985988355-763728e1935b?q=80&w=600&auto=format&fit=crop",
    title: "New Arrival",
    subtitle: "Performance meets style.",
  },
  {
    desktopSrc:
      "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?q=80&w=1920&auto=format&fit=crop",
    tabletSrc:
      "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?q=80&w=1000&auto=format&fit=crop",
    mobileSrc:
      "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?q=80&w=600&auto=format&fit=crop",
    title: "Winter '24",
    subtitle: "Bold looks for cold days.",
  },
  {
    desktopSrc:
      "https://images.unsplash.com/photo-1529139574466-a302d2752424?q=80&w=1920&auto=format&fit=crop",
    tabletSrc:
      "https://images.unsplash.com/photo-1529139574466-a302d2752424?q=80&w=1000&auto=format&fit=crop",
    mobileSrc:
      "https://images.unsplash.com/photo-1529139574466-a302d2752424?q=80&w=600&auto=format&fit=crop",
    title: "Urban Flux",
    subtitle: "Redefining street wear.",
  },
];

// --- ANIMATION VARIANTS ---
const sectionVariants = {
  initial: (direction) => ({
    y: direction > 0 ? "100%" : "-100%",
    opacity: 0,
    scale: 0.95,
  }),
  animate: {
    y: "0%",
    opacity: 1,
    scale: 1,
    transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] },
  },
  exit: (direction) => ({
    y: direction > 0 ? "-100%" : "100%",
    opacity: 0,
    scale: 1.05,
    transition: { duration: 0.6, ease: "easeInOut" },
  }),
};

// --- CAROUSEL ITEM COMPONENT ---
const CarouselItem = ({ product, index, x, isClickBlockedRef }) => {
  const CARD_WIDTH = 300;
  const GAP = 32;
  const ITEM_STRIDE = CARD_WIDTH + GAP;
  const itemOffset = index * ITEM_STRIDE;
  const dynamicPos = useTransform(x, (latest) => latest + itemOffset);

  const scale = useTransform(
    dynamicPos,
    [-ITEM_STRIDE, 0, ITEM_STRIDE],
    [0.85, 1.1, 0.85]
  );
  const opacity = useTransform(
    dynamicPos,
    [-ITEM_STRIDE, 0, ITEM_STRIDE],
    [0.5, 1, 0.5]
  );
  const blurValue = useTransform(
    dynamicPos,
    [-ITEM_STRIDE, 0, ITEM_STRIDE],
    [3, 0, 3]
  );
  const blurFilter = useTransform(blurValue, (v) => `blur(${v}px)`);
  const zIndex = useTransform(dynamicPos, (val) => {
    return Math.abs(val) < ITEM_STRIDE / 2 ? 10 : 1;
  });

  return (
    <motion.div
      style={{
        width: CARD_WIDTH,
        scale,
        opacity,
        filter: blurFilter,
        zIndex,
      }}
      className="flex-shrink-0 relative transition-colors duration-300"
    >
      <motion.div
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        transition={{ type: "spring", stiffness: 400, damping: 17 }}
        // IMPORTANT: Prevent default drag behavior to avoid ghost image
        onDragStart={(e) => e.preventDefault()}
        className="w-full h-full block"
      >
        <Link
          to={`/shop/${product._id || product.id}`}
          className="block w-full h-full"
          draggable={false}
          onClick={(e) => {
            if (isClickBlockedRef.current) {
              e.preventDefault();
            }
          }}
        >
          <ProductCard
            _id={product._id || product.id}
            title={product.title}
            price={product.price}
            category={product.category}
            image1={product.visuals?.[0]?.images?.[0] || product.image1}
            image2={product.visuals?.[0]?.images?.[1] || product.image2}
            badge={product.badge}
            visuals={product.visuals}
          />
        </Link>
      </motion.div>
    </motion.div>
  );
};

export default function Home() {
  const { theme } = useContext(ThemeContext);
  const navigate = useNavigate();

  // --- STATE ---
  const [currentSection, setCurrentSection] = useState(0);
  const [direction, setDirection] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isZooming, setIsZooming] = useState(false);

  // --- DATA STATE ---
  const [trendingProducts, setTrendingProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // --- HORIZONTAL SCROLL LOGIC ---
  const productTrackRef = useRef(null);
  const horizontalX = useMotionValue(0);
  const springX = useSpring(horizontalX, { stiffness: 120, damping: 20 });

  // --- TEXT ANIMATION ---
  const textX = useTransform(springX, [0, -400], [0, -300]);
  const textOpacity = useTransform(springX, [0, -200], [1, 0]);
  const textBlur = useTransform(springX, [0, -200], [0, 20]);
  const textBlurFilter = useTransform(textBlur, (v) => `blur(${v}px)`);

  const sectionRef = useRef(0);
  const animatingRef = useRef(false);
  const xRef = useRef(0);
  const exitAccumulator = useRef(0);

  const touchStartY = useRef(0);
  const touchStartX = useRef(0);
  const isMouseDragging = useRef(false);
  const isClickBlocked = useRef(false);

  const TOTAL_SECTIONS = 3;
  const HORIZONTAL_BUFFER = 200;
  const EXIT_THRESHOLD = 350;

  // --- API FETCH EFFECT ---
  useEffect(() => {
    const fetchTrending = async () => {
      setLoading(true);
      try {
        const res = await getAllProducts();
        if (res.success) {
          // Filter products that have specific badges
          const trends = res.data.filter((p) => ["Trending"].includes(p.badge));
          // If no specific trends found, take the first 6 as fallback
          setTrendingProducts(
            trends.length > 0 ? trends : res.data.slice(0, 6)
          );
        }
      } catch (error) {
        console.error("Failed to fetch home products:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchTrending();
  }, []);

  const updateHorizontal = (val) => {
    xRef.current = val;
    horizontalX.set(val);
  };

  const triggerSectionChange = useCallback(
    (nextSec, dir) => {
      animatingRef.current = true;
      setIsAnimating(true);
      setDirection(dir);
      setCurrentSection(nextSec);
      sectionRef.current = nextSec;
      exitAccumulator.current = 0;

      if (nextSec === 1) {
        setTimeout(() => {
          updateHorizontal(0);
        }, 100);
      }
    },
    [horizontalX]
  );

  const processScroll = useCallback(
    (delta, sensitivity = 0.8) => {
      if (animatingRef.current) return;

      if (sectionRef.current === 0 || sectionRef.current === 2) {
        if (delta > 0) {
          if (sectionRef.current < TOTAL_SECTIONS - 1) {
            triggerSectionChange(sectionRef.current + 1, 1);
          } else {
            // --- SECTION 2 END LOGIC: TRIGGER ZOOM ---
            exitAccumulator.current += delta;
            if (exitAccumulator.current > EXIT_THRESHOLD && !isZooming) {
              setIsZooming(true);
            }
          }
        } else if (delta < 0) {
          exitAccumulator.current = 0;
          if (sectionRef.current > 0) {
            triggerSectionChange(sectionRef.current - 1, -1);
          }
        }
        return;
      }

      if (sectionRef.current === 1) {
        // Only process horizontal scroll if data exists and is loaded
        const track = productTrackRef.current;
        if (!track || loading || trendingProducts.length === 0) {
          // Allow vertical escape if content isn't scrollable
          if (delta > 0) triggerSectionChange(2, 1);
          else triggerSectionChange(0, -1);
          return;
        }

        const trackScrollWidth = track.scrollWidth;
        const contentMaxScroll = -(trackScrollWidth - window.innerWidth);
        // Small buffer to ensure we see the last item
        const triggerPoint = contentMaxScroll - HORIZONTAL_BUFFER;

        let newX = xRef.current - delta * sensitivity;

        // Logic to exit Section 1
        if (newX > 150) {
          if (delta < 0) {
            triggerSectionChange(0, -1);
          } else {
            updateHorizontal(150);
          }
        } else if (newX < contentMaxScroll - 150) {
          triggerSectionChange(2, 1);
        } else {
          updateHorizontal(newX);
        }
      }
    },
    [triggerSectionChange, isZooming, loading, trendingProducts.length]
  );

  // --- NAVIGATE AFTER ZOOM COMPLETES ---
  useEffect(() => {
    if (isZooming) {
      const timeout = setTimeout(() => {
        navigate("/shop", { state: { fromZoom: true } });
      }, 800);
      return () => clearTimeout(timeout);
    }
  }, [isZooming, navigate]);

  const handleMouseDown = useCallback((e) => {
    if (sectionRef.current === 1) {
      isMouseDragging.current = true;
      touchStartX.current = e.clientX;
      document.body.style.cursor = "grabbing";
      isClickBlocked.current = false;
    }
  }, []);

  const handleMouseMoveDrag = useCallback(
    (e) => {
      if (!isMouseDragging.current) return;
      e.preventDefault();
      const deltaX = touchStartX.current - e.clientX;

      if (Math.abs(deltaX) > 0) {
        processScroll(deltaX, 1.5);
        touchStartX.current = e.clientX;

        if (Math.abs(deltaX) > 5 || Math.abs(xRef.current) > 5) {
          isClickBlocked.current = true;
        }
      }
    },
    [processScroll]
  );

  const handleMouseUpDrag = useCallback(() => {
    isMouseDragging.current = false;
    document.body.style.cursor = "";
    setTimeout(() => {
      isClickBlocked.current = false;
    }, 100);
  }, []);

  const handleWheel = useCallback(
    (event) => {
      event.preventDefault();
      if (Math.abs(event.deltaY) < 2) return;
      processScroll(event.deltaY, 0.9);
    },
    [processScroll]
  );

  const handleTouchStart = useCallback((event) => {
    touchStartY.current = event.touches[0].clientY;
    touchStartX.current = event.touches[0].clientX;
    isClickBlocked.current = false;
  }, []);

  const handleTouchMove = useCallback(
    (event) => {
      event.preventDefault();
      const deltaY = touchStartY.current - event.touches[0].clientY;
      const deltaX = touchStartX.current - event.touches[0].clientX;

      if (sectionRef.current === 1) {
        if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
          isClickBlocked.current = true;
        }
        const dominantDelta =
          Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY;
        processScroll(dominantDelta, 2.0);
      } else {
        processScroll(deltaY, 2.0);
      }

      touchStartY.current = event.touches[0].clientY;
      touchStartX.current = event.touches[0].clientX;
    },
    [processScroll]
  );

  useEffect(() => {
    if (isAnimating) {
      const timeout = setTimeout(() => {
        setIsAnimating(false);
        animatingRef.current = false;
        exitAccumulator.current = 0;
      }, 1000);
      return () => clearTimeout(timeout);
    }
  }, [currentSection, isAnimating]);

  useEffect(() => {
    window.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("touchstart", handleTouchStart, { passive: false });
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    return () => {
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
    };
  }, [handleWheel, handleTouchStart, handleTouchMove]);

  return (
    <div
      className="relative w-full h-screen overflow-hidden -mt-[90px]"
      style={{
        backgroundColor: theme.bg || "#111",
        color: theme.text || "#fff",
      }}
    >
      <AnimatePresence mode="wait" initial={false} custom={direction}>
        {/* --- HERO --- */}
        {currentSection === 0 && (
          <motion.section
            key="hero"
            custom={direction}
            variants={sectionVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="absolute inset-0 w-full h-full"
          >
            <HeroCarousel slides={SLIDES_DATA} />
          </motion.section>
        )}

        {/* --- TRENDING (Horizontal) --- */}
        {currentSection === 1 && (
          <motion.section
            key="trending"
            custom={direction}
            variants={sectionVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMoveDrag}
            onMouseUp={handleMouseUpDrag}
            onMouseLeave={handleMouseUpDrag}
            className="absolute inset-0 w-full h-full flex flex-col justify-center z-20 cursor-grab active:cursor-grabbing"
          >
            {/* LEFT TEXT CONTAINER - Animates with Scroll */}
            <div className="absolute left-0 top-0 bottom-0 w-[30%] hidden md:flex flex-col justify-center px-12 z-30 pointer-events-none">
              <motion.div
                style={{
                  x: textX,
                  opacity: textOpacity,
                  filter: textBlurFilter,
                }}
                className="border-l-4 border-white/20 pl-6"
              >
                <motion.h2
                  initial={{ opacity: 0, x: -50 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3, duration: 0.8 }}
                  className="text-6xl font-black uppercase tracking-tighter leading-none"
                >
                  Trending
                  <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-500">
                    Now
                  </span>
                </motion.h2>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.6 }}
                  transition={{ delay: 0.5 }}
                  className="text-lg font-mono mt-4 tracking-widest"
                >
                  WINTER COLLECTION
                </motion.p>
              </motion.div>
            </div>

            {/* Mobile Header */}
            <div className="md:hidden w-full px-10 mb-10 mt-5 text-center relative z-30 pointer-events-none">
              <h2 className="text-3xl font-bold uppercase tracking-tighter">
                Trending Now
              </h2>
            </div>

            {/* Carousel Track */}
            <div className="w-full h-[60vh] flex items-center justify-center overflow-visible mt-4 relative z-20">
              {loading ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="animate-spin" size={40} />
                  <p className="opacity-50 text-sm font-mono">
                    Loading trends...
                  </p>
                </div>
              ) : trendingProducts.length > 0 ? (
                <motion.div
                  ref={productTrackRef}
                  style={{ x: springX }}
                  className="flex gap-8 items-center"
                  {...{
                    style: {
                      x: springX,
                      display: "flex",
                      gap: "2rem",
                      paddingLeft: "calc(50vw - 150px)",
                      paddingRight: "calc(50vw - 150px)",
                      alignItems: "center",
                    },
                  }}
                >
                  {trendingProducts.map((product, index) => (
                    <CarouselItem
                      key={product._id || product.id}
                      product={product}
                      index={index}
                      x={springX}
                      isClickBlockedRef={isClickBlocked}
                    />
                  ))}

                  <div
                    className="flex-shrink-0 flex items-center justify-center opacity-30 font-mono text-xl"
                    style={{ width: "200px" }}
                  >
                    <Link to="/shop">view all &rarr;</Link>
                  </div>
                </motion.div>
              ) : (
                <div className="text-center opacity-50">
                  <p>No trending items found.</p>
                </div>
              )}
            </div>
          </motion.section>
        )}

        {/* --- FEATURED --- */}
        {currentSection === 2 && (
          <motion.section
            key="featured"
            custom={direction}
            variants={sectionVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="absolute inset-0 w-full h-full flex flex-col items-center justify-center px-4 md:px-10 z-10"
          >
            {/* ZOOM TRANSITION CONTAINER */}
            <motion.div
              layout
              initial={{
                width: "100%",
                maxWidth: "72rem",
                height: "70vh",
                borderRadius: "1.5rem",
                marginTop: "90px",
                borderWidth: "2px",
              }}
              animate={
                isZooming
                  ? {
                      // ZOOM TO FULL SCREEN
                      width: "100vw",
                      maxWidth: "100vw",
                      height: "100vh",
                      borderRadius: 0,
                      marginTop: 0,
                      borderWidth: 0,
                      transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] },
                    }
                  : {
                      // NORMAL STATE
                      width: "100%",
                      maxWidth: "72rem",
                      height: "70vh",
                      borderRadius: "1.5rem",
                      marginTop: "90px",
                      borderWidth: "2px",
                    }
              }
              className={`relative flex items-center justify-center bg-white/5 backdrop-blur-sm overflow-hidden group border-dashed border-gray-700/50 ${
                isZooming ? "z-50" : ""
              }`}
            >
              <div className="absolute inset-0">
                <img
                  // Matches Shop.jsx first slide
                  src="https://images.unsplash.com/photo-1552346154-21d32810aba3?q=80&w=1600&auto=format&fit=crop"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000"
                  style={{ opacity: isZooming ? 1 : 0.4 }}
                  alt="Collection"
                />
                <div
                  className="absolute inset-0 bg-black/50"
                  style={{
                    opacity: isZooming ? 0 : 1,
                    transition: "opacity 0.5s",
                  }}
                />
              </div>

              {/* Text fades out when zooming starts */}
              <motion.div
                animate={{ opacity: isZooming ? 0 : 1 }}
                transition={{ duration: 0.3 }}
                className="text-center relative z-10"
              >
                <h2 className="text-5xl md:text-8xl font-black uppercase mb-4 drop-shadow-2xl">
                  Featured
                  <br />
                  Collection
                </h2>
                <button
                  onClick={() => navigate("/shop")}
                  className="px-10 py-4 bg-white text-black font-bold text-lg rounded-full hover:scale-105 transition-transform"
                >
                  Discover Now
                </button>
              </motion.div>
            </motion.div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}
