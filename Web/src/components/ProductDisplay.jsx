import React, { useState, useContext, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Star,
  Truck,
  ShieldCheck,
  Minus,
  Plus,
  Check,
  ArrowLeft,
  Loader2,
  Info,
  ChevronDown,
  ShoppingBag,
  MessageSquare,
  Ruler,
} from "lucide-react";
import { ThemeContext } from "@/context/ThemeContext";
import { useApp } from "@/context/Appcontext";
import { getProductById, addToCart, updateCartItem } from "@/services/api";
import toast from "react-hot-toast";

const getImageUrl = (path) => {
  if (!path) return "";
  if (path.startsWith("http") || path.startsWith("blob")) return path;
  return `${import.meta.env.VITE_API_URL}${path}`;
};

const formatINR = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);

const ProductDisplay = () => {
  const { theme } = useContext(ThemeContext);
  const { refreshCart, cart } = useApp();
  const { id } = useParams();
  const navigate = useNavigate();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);

  // Selections
  const [selectedColor, setSelectedColor] = useState(null);
  const [selectedSize, setSelectedSize] = useState(null);

  // UI State
  const [currentImages, setCurrentImages] = useState([]);
  const [activeImage, setActiveImage] = useState(0);
  const [expandedSection, setExpandedSection] = useState("desc");
  const [quantity, setQuantity] = useState(1);
  const [addingToCart, setAddingToCart] = useState(false);
  const [cartItemMatch, setCartItemMatch] = useState(null);

  // --- 1. Load Data ---
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const res = await getProductById(id);
      if (res.success) {
        setProduct(res.data);
        if (res.data.visuals?.length > 0) {
          // Default selection
          const firstColor = res.data.visuals[0];
          setSelectedColor(firstColor);
          setCurrentImages(firstColor.images || []);

          // Auto-select first available size for this color
          const availableSizes = res.data.stock.filter(
            (s) => s.colorName === firstColor.colorName && s.quantity > 0
          );
          if (availableSizes.length > 0) {
            setSelectedSize(availableSizes[0].size);
          }
        }
      }
      setLoading(false);
    };
    if (id) loadData();
  }, [id]);

  // --- 2. Update Images & Sizes on Color Change ---
  useEffect(() => {
    if (selectedColor && product) {
      setCurrentImages(selectedColor.images || []);
      setActiveImage(0);

      // Reset size if current selected size isn't available in new color
      const isAvailable = product.stock.some(
        (s) =>
          s.colorName === selectedColor.colorName &&
          s.size === selectedSize &&
          s.quantity > 0
      );
      if (!isAvailable) setSelectedSize(null);
    }
  }, [selectedColor]);

  // --- 3. Sync with Cart ---
  useEffect(() => {
    if (cart && product) {
      const match = cart.items.find((item) => {
        const itemProdId =
          typeof item.product === "object" ? item.product._id : item.product;
        const idMatch = itemProdId === product._id;
        const colorMatch = selectedColor
          ? item.color === selectedColor.colorName
          : true;
        const sizeMatch = selectedSize ? item.size === selectedSize : true;
        return idMatch && colorMatch && sizeMatch;
      });

      setCartItemMatch(match);
      if (match) setQuantity(match.quantity);
      else setQuantity(1);
    }
  }, [cart, product, selectedColor, selectedSize]);

  // --- 4. Handle Add/Update ---
  const handleCartAction = async () => {
    if (!selectedColor) return toast.error("Please select a color");
    if (!selectedSize) return toast.error("Please select a size");

    setAddingToCart(true);
    try {
      if (cartItemMatch) {
        const res = await updateCartItem(cartItemMatch._id, quantity);
        if (res.success) {
          await refreshCart();
          toast.success("Cart updated");
        }
      } else {
        const res = await addToCart(
          product._id,
          selectedColor.colorName,
          selectedSize,
          quantity
        );
        if (res.success) {
          await refreshCart();
          toast.success("Added to cart");
        }
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to update cart");
    } finally {
      setAddingToCart(false);
    }
  };

  // Helper to get available sizes for current color
  const getAvailableSizes = () => {
    if (!product || !selectedColor) return [];
    return (
      product.sizeInfo?.chart?.map((sizeKey) => {
        const stockItem = product.stock.find(
          (s) => s.colorName === selectedColor.colorName && s.size === sizeKey
        );
        return {
          size: sizeKey,
          available: stockItem ? stockItem.quantity > 0 : false,
          quantity: stockItem ? stockItem.quantity : 0,
        };
      }) || []
    );
  };

  if (loading)
    return (
      <div className="min-h-screen flex center">
        <Loader2 className="animate-spin" />
      </div>
    );
  if (!product) return <div>Product Not Found</div>;

  return (
    <div
      className="min-h-screen w-full transition-colors duration-500 pt-10 pb-24 relative"
      style={{ backgroundColor: theme.bg, color: theme.text }}
    >
      <div className="max-w-[1400px] mx-auto px-6 md:px-12">
        <button
          onClick={() => navigate(-1)}
          className="mb-8 flex items-center gap-2 hover:opacity-70"
        >
          <ArrowLeft size={20} />{" "}
          <span className="font-bold text-xs uppercase">Back</span>
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20 mb-24">
          {/* LEFT: Images */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <div
              className="relative aspect-square w-full overflow-hidden rounded-3xl"
              style={{ backgroundColor: theme.card.imgBg }}
            >
              <AnimatePresence mode="wait">
                <motion.img
                  key={currentImages[activeImage] || "def"}
                  src={getImageUrl(currentImages[activeImage])}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="w-full h-full object-cover"
                />
              </AnimatePresence>
            </div>
            <div className="grid grid-cols-4 gap-4">
              {currentImages.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveImage(idx)}
                  className={`relative aspect-square rounded-xl overflow-hidden border-2 ${
                    activeImage === idx
                      ? "border-current"
                      : "border-transparent opacity-60"
                  }`}
                >
                  <img
                    src={getImageUrl(img)}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>

          {/* RIGHT: Info */}
          <div className="lg:col-span-5 relative">
            <div className="sticky top-32 flex flex-col gap-8">
              {/* Header */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold uppercase opacity-60">
                    {product.category}
                  </span>
                  <div className="flex items-center gap-1">
                    <Star size={16} className="text-yellow-500 fill-current" />
                    <span>{product.rating || "New"}</span>
                    <span className="opacity-50 text-xs">
                      ({product.reviewsCount} reviews)
                    </span>
                  </div>
                </div>
                <h1 className="text-4xl md:text-5xl font-black uppercase leading-none">
                  {product.title}
                </h1>
                <div className="flex items-center gap-4">
                  <div className="text-3xl font-medium">
                    {formatINR(product.price)}
                  </div>
                  {product.discountPrice > 0 && (
                    <div className="text-xl font-medium opacity-50 line-through">
                      {formatINR(product.discountPrice)}
                    </div>
                  )}
                </div>
              </div>

              <div className="h-px w-full bg-current opacity-10" />

              {/* Color Selection */}
              <div>
                <label className="text-sm font-bold uppercase mb-3 block opacity-80">
                  Color: {selectedColor?.colorName}
                </label>
                <div className="flex gap-3 flex-wrap">
                  {product.visuals.map((c) => (
                    <button
                      key={c.colorName}
                      onClick={() => setSelectedColor(c)}
                      className={`w-10 h-10 rounded-full flex items-center justify-center border transition-transform ${
                        selectedColor?.colorName === c.colorName
                          ? "scale-110 ring-2 ring-offset-2 ring-current"
                          : ""
                      }`}
                      style={{
                        backgroundColor: c.hexCode,
                        borderColor: theme.navbar.border,
                      }}
                    >
                      {selectedColor?.colorName === c.colorName && (
                        <Check
                          size={14}
                          className="text-white mix-blend-difference"
                        />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Size Selection */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <label className="text-sm font-bold uppercase opacity-80">
                    Size: {selectedSize || "Select"}
                  </label>
                  <button className="text-xs font-bold underline opacity-60 hover:opacity-100 flex items-center gap-1">
                    <Ruler size={12} /> Size Guide ({product.sizeInfo?.unit})
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {getAvailableSizes().map(({ size, available }) => (
                    <button
                      key={size}
                      onClick={() => available && setSelectedSize(size)}
                      disabled={!available}
                      className={`py-3 rounded-xl border text-sm font-bold uppercase transition-all ${
                        selectedSize === size
                          ? "bg-current text-white dark:text-black"
                          : available
                          ? "hover:border-current opacity-70 hover:opacity-100"
                          : "opacity-20 cursor-not-allowed decoration-slice line-through"
                      }`}
                      style={
                        selectedSize !== size
                          ? { borderColor: theme.navbar.border }
                          : {}
                      }
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-4 pt-4">
                <div
                  className="flex items-center border rounded-full px-4 py-3"
                  style={{ borderColor: theme.navbar.border }}
                >
                  <button
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    disabled={addingToCart}
                  >
                    <Minus size={16} />
                  </button>
                  <span className="mx-4 font-bold min-w-[20px] text-center">
                    {quantity}
                  </span>
                  <button
                    onClick={() => setQuantity((q) => q + 1)}
                    disabled={addingToCart}
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <button
                  onClick={handleCartAction}
                  disabled={addingToCart || !selectedSize}
                  className={`flex-1 rounded-full font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                    cartItemMatch ? "bg-green-600 text-white" : ""
                  }`}
                  style={
                    !cartItemMatch
                      ? { backgroundColor: theme.text, color: theme.bg }
                      : {}
                  }
                >
                  {addingToCart ? (
                    <Loader2 className="animate-spin" />
                  ) : cartItemMatch ? (
                    <>Update Cart</>
                  ) : (
                    <>Add to Cart</>
                  )}
                </button>
              </div>

              {/* Accordions */}
              <div className="pt-8 space-y-2">
                <AccordionItem
                  title="Description"
                  icon={Info}
                  isOpen={expandedSection === "desc"}
                  onClick={() =>
                    setExpandedSection(
                      expandedSection === "desc" ? null : "desc"
                    )
                  }
                  theme={theme}
                  content={product.description}
                />

                <AccordionItem
                  title="Delivery & Returns"
                  icon={Truck}
                  isOpen={expandedSection === "ship"}
                  onClick={() =>
                    setExpandedSection(
                      expandedSection === "ship" ? null : "ship"
                    )
                  }
                  theme={theme}
                  content={
                    <div className="space-y-2 text-sm">
                      <p>
                        <strong>Estimated:</strong>{" "}
                        {product.deliveryInfo?.estimatedDays}
                      </p>
                      <p>
                        <strong>Shipping:</strong>{" "}
                        {product.deliveryInfo?.shippingCost > 0
                          ? formatINR(product.deliveryInfo.shippingCost)
                          : "Free"}
                      </p>
                      <p className="opacity-60">
                        {product.deliveryInfo?.returnPolicy}
                      </p>
                    </div>
                  }
                />

                <AccordionItem
                  title={`Reviews (${product.reviewsCount})`}
                  icon={MessageSquare}
                  isOpen={expandedSection === "reviews"}
                  onClick={() =>
                    setExpandedSection(
                      expandedSection === "reviews" ? null : "reviews"
                    )
                  }
                  theme={theme}
                  content={
                    <div className="space-y-4">
                      <div className="flex items-center gap-4 bg-white/5 p-4 rounded-xl">
                        <div className="text-center">
                          <span className="text-3xl font-black block">
                            {product.rating}
                          </span>
                          <div className="flex text-yellow-500 text-xs">
                            <Star fill="currentColor" size={10} />
                            <Star fill="currentColor" size={10} />
                            <Star fill="currentColor" size={10} />
                            <Star fill="currentColor" size={10} />
                            <Star size={10} />
                          </div>
                        </div>
                        <div className="h-8 w-px bg-current opacity-20"></div>
                        <div className="text-xs opacity-70">
                          Based on {product.reviewsCount} reviews.
                          <br />
                          Most customers are satisfied.
                        </div>
                      </div>

                      {/* Placeholder for actual reviews list */}
                      <div className="space-y-3">
                        <div className="border-b pb-3 border-dashed border-white/10">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="font-bold">John Doe</span>
                            <span className="opacity-50">2 days ago</span>
                          </div>
                          <p className="text-xs opacity-70">
                            Great quality! The fit is perfect.
                          </p>
                        </div>
                        <button className="text-xs font-bold underline w-full text-center pt-2">
                          View All Reviews
                        </button>
                      </div>
                    </div>
                  }
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const AccordionItem = ({
  title,
  icon: Icon,
  isOpen,
  onClick,
  content,
  theme,
}) => (
  <div className="border-b" style={{ borderColor: theme.navbar.border }}>
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between py-4 font-bold text-sm uppercase hover:opacity-70 transition-opacity"
    >
      <div className="flex items-center gap-3">
        <Icon size={18} /> {title}
      </div>
      <ChevronDown
        size={16}
        className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
      />
    </button>
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="overflow-hidden"
        >
          <div className="pb-6 text-sm opacity-70 leading-relaxed">
            {content}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);

export default ProductDisplay;
