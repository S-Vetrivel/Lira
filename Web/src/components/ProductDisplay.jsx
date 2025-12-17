import React, { useState, useContext, useEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Star,
  ShoppingBag,
  Heart,
  ChevronDown,
  Truck,
  ShieldCheck,
  Minus,
  Plus,
  Check,
  ArrowLeft,
  Loader2,
  Info,
} from "lucide-react";
import { ThemeContext } from "@/context/ThemeContext";
import { getProductById, getProductRecommendations } from "@/services/api";

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
  const { id } = useParams();
  const navigate = useNavigate();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedColor, setSelectedColor] = useState(null);
  const [currentImages, setCurrentImages] = useState([]);
  const [activeImage, setActiveImage] = useState(0);
  const [expandedSection, setExpandedSection] = useState("desc");
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const res = await getProductById(id);
      if (res.success) {
        setProduct(res.data);
        if (res.data.visuals?.length > 0) {
          setSelectedColor(res.data.visuals[0]);
          setCurrentImages(res.data.visuals[0].images || []);
        }
      }
      setLoading(false);
    };
    if (id) loadData();
  }, [id]);

  useEffect(() => {
    if (selectedColor) {
      setCurrentImages(selectedColor.images || []);
      setActiveImage(0);
    }
  }, [selectedColor]);

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

              <div className="flex gap-4 pt-4">
                <div
                  className="flex items-center border rounded-full px-4 py-3"
                  style={{ borderColor: theme.navbar.border }}
                >
                  <button
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  >
                    <Minus size={16} />
                  </button>
                  <span className="mx-4 font-bold">{quantity}</span>
                  <button onClick={() => setQuantity((q) => q + 1)}>
                    <Plus size={16} />
                  </button>
                </div>
                <button
                  className="flex-1 bg-current text-white dark:text-black rounded-full font-bold uppercase tracking-wider"
                  style={{ backgroundColor: theme.text, color: theme.bg }}
                >
                  Add to Cart
                </button>
              </div>

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
