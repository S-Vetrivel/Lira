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
} from "lucide-react";
import { ThemeContext } from "@/context/ThemeContext";
import { useApp } from "@/context/Appcontext"; // Global Context
import { getProductById, addToCart, updateCartItem } from "@/services/api"; // Added updateCartItem
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
  const { refreshCart, cart } = useApp(); // Get global cart state
  const { id } = useParams();
  const navigate = useNavigate();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedColor, setSelectedColor] = useState(null);
  const [currentImages, setCurrentImages] = useState([]);
  const [activeImage, setActiveImage] = useState(0);
  const [expandedSection, setExpandedSection] = useState("desc");

  const [quantity, setQuantity] = useState(1);
  const [addingToCart, setAddingToCart] = useState(false);

  // Track if this item (Product + Color) is already in the cart
  const [cartItemMatch, setCartItemMatch] = useState(null);

  // --- 1. Load Product Data ---
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const res = await getProductById(id);
      if (res.success) {
        setProduct(res.data);
        if (res.data.visuals?.length > 0) {
          // Default to first visual to match ProductCard logic
          setSelectedColor(res.data.visuals[0]);
          setCurrentImages(res.data.visuals[0].images || []);
        }
      }
      setLoading(false);
    };
    if (id) loadData();
  }, [id]);

  // --- 2. Update Images when Color Changes ---
  useEffect(() => {
    if (selectedColor) {
      setCurrentImages(selectedColor.images || []);
      setActiveImage(0);
    }
  }, [selectedColor]);

  // --- 3. SYNC WITH CART STATE ---
  // This logic finds if the current selection exists in the cart and updates the button/counter
  useEffect(() => {
    if (cart && product) {
      const match = cart.items.find((item) => {
        const itemProdId =
          typeof item.product === "object" ? item.product._id : item.product;
        // Check ID
        const idMatch = itemProdId === product._id;
        // Check Color (if visuals exist, strict match; else lax match)
        const colorMatch =
          product.visuals?.length > 0
            ? item.color === selectedColor?.colorName
            : true;

        return idMatch && colorMatch;
      });

      setCartItemMatch(match);

      // If matched, sync the counter to what is currently in the cart
      if (match) {
        setQuantity(match.quantity);
      } else {
        // Only reset to 1 if we switched to a variant NOT in the cart
        setQuantity(1);
      }
    }
  }, [cart, product, selectedColor]);

  // --- 4. HANDLE ACTION (ADD or UPDATE) ---
  const handleCartAction = async () => {
    if (!product) return;

    if (product.visuals?.length > 0 && !selectedColor) {
      toast.error("Please select a color");
      return;
    }

    setAddingToCart(true);
    try {
      console.log("Cart Action Triggered. Match found?", !!cartItemMatch);

      if (cartItemMatch) {
        // --- MODE: UPDATE EXISTING ---
        console.log("Updating Item:", cartItemMatch._id, "Quantity:", quantity);
        const res = await updateCartItem(cartItemMatch._id, quantity);

        if (res.success) {
          await refreshCart();
          toast.success("Cart updated");
        } else {
          toast.error(res.message || "Update failed");
        }
      } else {
        // --- MODE: ADD NEW ---
        console.log("Adding New Item");
        const res = await addToCart(
          product._id,
          selectedColor?.colorName,
          "M", // Hardcoded size for now
          quantity
        );
        if (res.success) {
          await refreshCart();
        }
      }
    } catch (error) {
      console.error("Cart Action Error:", error);
      toast.error("Operation failed");
    } finally {
      setAddingToCart(false);
    }
  };

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin" />
      </div>
    );
  if (!product)
    return (
      <div className="min-h-screen flex items-center justify-center">
        Product Not Found
      </div>
    );

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
          <ArrowLeft size={20} />
          <span className="font-bold text-xs uppercase">Back</span>
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20 mb-24">
          {/* --- LEFT: IMAGES --- */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <div
              className="relative aspect-square w-full overflow-hidden rounded-3xl"
              style={{ backgroundColor: theme.card.imgBg }}
            >
              <AnimatePresence mode="wait">
                <motion.img
                  key={currentImages[activeImage] || "def"}
                  src={
                    getImageUrl(currentImages[activeImage]) ||
                    "https://via.placeholder.com/600"
                  }
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

          {/* --- RIGHT: INFO & ACTIONS --- */}
          <div className="lg:col-span-5 relative">
            <div className="sticky top-32 flex flex-col gap-8">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold uppercase opacity-60">
                    {product.category}
                  </span>
                  <div className="flex items-center gap-1">
                    <Star size={16} className="text-yellow-500 fill-current" />
                    <span>{product.rating || "New"}</span>
                  </div>
                </div>
                <h1 className="text-4xl md:text-5xl font-black uppercase leading-none">
                  {product.title}
                </h1>
                <div className="flex items-center gap-4">
                  <div className="text-3xl font-medium">
                    {formatINR(product.price)}
                  </div>
                  {product.discountPrice && (
                    <div className="text-xl font-medium opacity-50 line-through">
                      {formatINR(product.discountPrice)}
                    </div>
                  )}
                </div>
              </div>

              <div className="h-px w-full bg-current opacity-10" />

              {/* Color Selection */}
              {product.visuals?.length > 0 && (
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
              )}

              {/* Quantity & Action Button */}
              <div className="flex gap-4 pt-4">
                <div
                  className="flex items-center border rounded-full px-4 py-3"
                  style={{ borderColor: theme.navbar.border }}
                >
                  <button
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    disabled={addingToCart}
                    className="disabled:opacity-50"
                  >
                    <Minus size={16} />
                  </button>
                  <span className="mx-4 font-bold min-w-[20px] text-center">
                    {quantity}
                  </span>
                  <button
                    onClick={() => setQuantity((q) => q + 1)}
                    disabled={addingToCart}
                    className="disabled:opacity-50"
                  >
                    <Plus size={16} />
                  </button>
                </div>

                <button
                  onClick={handleCartAction}
                  disabled={addingToCart}
                  className={`flex-1 rounded-full font-bold uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed hover:opacity-90 transition-opacity ${
                    cartItemMatch ? "bg-green-600 text-white" : ""
                  }`}
                  style={
                    cartItemMatch
                      ? {} // Use green bg class
                      : { backgroundColor: theme.text, color: theme.bg }
                  }
                >
                  {addingToCart ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : cartItemMatch ? (
                    <>
                      <Check size={20} /> Update Cart
                    </>
                  ) : (
                    <>
                      <ShoppingBag size={20} /> Add to Cart
                    </>
                  )}
                </button>
              </div>

              {/* Description Accordions */}
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
                    <div className="space-y-2">
                      <p>
                        <strong>Estimated Delivery:</strong>{" "}
                        {product.deliveryInfo?.estimatedDays ||
                          "3-5 Business Days"}
                      </p>
                      <p>
                        <strong>Shipping Cost:</strong>{" "}
                        {product.deliveryInfo?.shippingCost > 0
                          ? formatINR(product.deliveryInfo.shippingCost)
                          : "Free"}
                      </p>
                      <p className="text-xs opacity-60">
                        {product.deliveryInfo?.returnPolicy ||
                          "Standard Policy"}
                      </p>
                    </div>
                  }
                />
                <AccordionItem
                  title="Features"
                  icon={ShieldCheck}
                  isOpen={expandedSection === "feat"}
                  onClick={() =>
                    setExpandedSection(
                      expandedSection === "feat" ? null : "feat"
                    )
                  }
                  theme={theme}
                  content={
                    <ul className="list-disc pl-4">
                      {product.features?.map((f) => <li key={f}>{f}</li>) ||
                        "N/A"}
                    </ul>
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
      className="w-full flex items-center justify-between py-4 font-bold text-sm uppercase"
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
