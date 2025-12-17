import React, { useState, useEffect, useContext, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Plus,
  LayoutGrid,
  List as ListIcon,
  Edit2,
  Trash2,
  X,
  UploadCloud,
  Loader2,
  DollarSign,
  Package,
  Check,
  Image as ImageIcon,
  AlertCircle,
  Truck,
} from "lucide-react";
import { ThemeContext } from "@/context/ThemeContext";
import toast from "react-hot-toast";
import {
  getAlladminProducts,
  createProduct,
  updateProduct,
  deleteProduct,
} from "@/services/api";

const getImageUrl = (path) => {
  if (!path) return "";
  if (path.startsWith("http") || path.startsWith("blob")) return path;
  return `${import.meta.env.VITE_API_URL}${path}`;
};

const INITIAL_PRODUCT_STATE = {
  title: "",
  description: "",
  category: "",
  price: "",
  discountPrice: "",
  badge: "",
  features: [],
  sizeInfo: { unit: "US", chart: [] },
  visuals: [],
  stock: [],
  deliveryInfo: {
    estimatedDays: "3-5 Business Days",
    shippingCost: 0,
    returnPolicy: "7 Days Return Policy",
  },
};

const ProductsTab = () => {
  const { theme } = useContext(ThemeContext);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  const fetchProducts = async () => {
    setLoading(true);
    const res = await getAlladminProducts();
    if (res.success) setProducts(res.data);
    else toast.error("Failed to load products");
    setLoading(false);
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm("Delete product?")) return;
    const res = await deleteProduct(id);
    if (res.success) {
      setProducts((prev) => prev.filter((p) => (p._id || p.id) !== id));
      toast.success("Deleted");
    } else toast.error(res.message);
  };

  const handleFormSubmit = async (formDataPayload) => {
    let res;
    const tId = toast.loading("Saving...");
    if (editingProduct) {
      res = await updateProduct(
        editingProduct._id || editingProduct.id,
        formDataPayload
      );
    } else {
      res = await createProduct(formDataPayload);
    }
    toast.dismiss(tId);

    if (res.success) {
      setIsModalOpen(false);
      fetchProducts();
      toast.success("Success!");
    } else {
      toast.error(res.message);
    }
  };

  const filteredProducts = useMemo(
    () =>
      products.filter((p) =>
        p.title.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [products, searchQuery]
  );

  return (
    <div className="w-full min-h-screen pb-20">
      <div className="flex flex-col md:flex-row justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black uppercase">Inventory</h1>
        </div>
        <button
          onClick={() => {
            setEditingProduct(null);
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm text-white shadow-lg"
          style={{ backgroundColor: theme.text }}
        >
          <Plus size={18} /> Add Product
        </button>
      </div>

      <div
        className="sticky top-0 z-10 p-4 rounded-2xl border mb-6 flex justify-between bg-opacity-80 backdrop-blur-xl"
        style={{ backgroundColor: theme.bg, borderColor: theme.navbar.border }}
      >
        <input
          type="text"
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-4 py-2 bg-transparent outline-none"
        />
        <div
          className="flex bg-opacity-5 p-1 rounded-lg border ml-4"
          style={{ borderColor: theme.navbar.border }}
        >
          <button
            onClick={() => setViewMode("list")}
            className={`p-2 rounded-md ${
              viewMode === "list" ? "bg-white shadow text-black" : "opacity-50"
            }`}
          >
            <ListIcon size={18} />
          </button>
          <button
            onClick={() => setViewMode("tile")}
            className={`p-2 rounded-md ${
              viewMode === "tile" ? "bg-white shadow text-black" : "opacity-50"
            }`}
          >
            <LayoutGrid size={18} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20">
          <Loader2 className="animate-spin inline" />
        </div>
      ) : viewMode === "list" ? (
        <ListView
          products={filteredProducts}
          onEdit={(p) => {
            setEditingProduct(p);
            setIsModalOpen(true);
          }}
          onDelete={handleDelete}
          theme={theme}
        />
      ) : (
        <TileView
          products={filteredProducts}
          onEdit={(p) => {
            setEditingProduct(p);
            setIsModalOpen(true);
          }}
          onDelete={handleDelete}
          theme={theme}
        />
      )}

      <AnimatePresence>
        {isModalOpen && (
          <ProductFormModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            onSubmit={handleFormSubmit}
            initialData={editingProduct}
            theme={theme}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

const ListView = ({ products, onEdit, onDelete, theme }) => (
  <div
    className="w-full overflow-x-auto rounded-2xl border bg-opacity-40"
    style={{ borderColor: theme.navbar.border, backgroundColor: theme.card.bg }}
  >
    <table className="w-full text-left">
      <thead>
        <tr className="border-b text-xs font-bold uppercase opacity-60">
          <th className="p-4">Product</th>
          <th className="p-4">Price</th>
          <th className="p-4 text-right">Actions</th>
        </tr>
      </thead>
      <tbody>
        {products.map((p) => (
          <tr
            key={p._id || p.id}
            className="border-b last:border-0 hover:bg-black/5"
          >
            <td className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded bg-gray-100 overflow-hidden">
                <img
                  src={getImageUrl(p.visuals?.[0]?.images?.[0])}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="font-bold">{p.title}</div>
            </td>
            <td className="p-4 font-mono">₹{p.price}</td>
            <td className="p-4 text-right">
              <button onClick={() => onEdit(p)} className="p-2 text-blue-500">
                <Edit2 size={16} />
              </button>
              <button
                onClick={() => onDelete(p._id || p.id)}
                className="p-2 text-red-500"
              >
                <Trash2 size={16} />
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const TileView = ({ products, onEdit, onDelete, theme }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
    {products.map((p) => (
      <div
        key={p._id || p.id}
        className="group relative rounded-2xl border overflow-hidden hover:shadow-xl transition-all"
        style={{
          borderColor: theme.navbar.border,
          backgroundColor: theme.card.bg,
        }}
      >
        <div className="absolute top-3 right-3 z-10 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onEdit(p)}
            className="p-2 bg-white rounded-full shadow hover:text-blue-600"
          >
            <Edit2 size={14} />
          </button>
          <button
            onClick={() => onDelete(p._id || p.id)}
            className="p-2 bg-white rounded-full shadow hover:text-red-600"
          >
            <Trash2 size={14} />
          </button>
        </div>
        <div className="aspect-square bg-gray-100">
          <img
            src={getImageUrl(p.visuals?.[0]?.images?.[0])}
            className="w-full h-full object-cover"
          />
        </div>
        <div className="p-4">
          <div className="font-bold truncate">{p.title}</div>
          <div className="text-sm opacity-60">₹{p.price}</div>
        </div>
      </div>
    ))}
  </div>
);

const ProductFormModal = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  theme,
}) => {
  const [formData, setFormData] = useState(
    initialData || INITIAL_PRODUCT_STATE
  );
  const [tab, setTab] = useState("basic");
  const [visualFiles, setVisualFiles] = useState({});

  const handleChange = (e) =>
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  const handleDelivery = (e) =>
    setFormData((prev) => ({
      ...prev,
      deliveryInfo: { ...prev.deliveryInfo, [e.target.name]: e.target.value },
    }));

  const addVisual = () =>
    setFormData((prev) => ({
      ...prev,
      visuals: [
        ...prev.visuals,
        { colorName: "", hexCode: "#000000", images: [] },
      ],
    }));
  const updateVisual = (idx, field, val) => {
    const v = [...formData.visuals];
    v[idx][field] = val;
    setFormData({ ...formData, visuals: v });
  };
  const removeVisual = (idx) => {
    setFormData((prev) => ({
      ...prev,
      visuals: prev.visuals.filter((_, i) => i !== idx),
    }));
    const newFiles = { ...visualFiles };
    delete newFiles[idx];
    setVisualFiles(newFiles);
  };

  const handleFileChange = (e, idx) => {
    if (!e.target.files.length) return;
    const files = Array.from(e.target.files);
    setVisualFiles((prev) => ({
      ...prev,
      [idx]: [...(prev[idx] || []), ...files],
    }));
    const previewUrls = files.map((f) => URL.createObjectURL(f));
    const newVisuals = [...formData.visuals];
    newVisuals[idx].previewImages = [
      ...(newVisuals[idx].previewImages || []),
      ...previewUrls,
    ];
    setFormData({ ...formData, visuals: newVisuals });
  };

  const removeImage = (visualIdx, imgIdx, isPreview = false) => {
    const newVisuals = [...formData.visuals];
    if (isPreview) {
      newVisuals[visualIdx].previewImages.splice(imgIdx, 1);
      setVisualFiles((prev) => {
        const updated = [...prev[visualIdx]];
        updated.splice(imgIdx, 1);
        return { ...prev, [visualIdx]: updated };
      });
    } else {
      newVisuals[visualIdx].images.splice(imgIdx, 1);
    }
    setFormData({ ...formData, visuals: newVisuals });
  };

  const addSize = () =>
    setFormData((prev) => ({
      ...prev,
      sizeInfo: { ...prev.sizeInfo, chart: [...prev.sizeInfo.chart, ""] },
    }));
  const updateSize = (i, val) => {
    const c = [...formData.sizeInfo.chart];
    c[i] = val;
    setFormData((prev) => ({
      ...prev,
      sizeInfo: { ...prev.sizeInfo, chart: c },
    }));
  };

  const generateStock = () => {
    const newStock = [];
    formData.visuals.forEach((v) => {
      formData.sizeInfo.chart.forEach((s) => {
        const exist = formData.stock.find(
          (st) => st.colorName === v.colorName && st.size === s
        );
        newStock.push({
          colorName: v.colorName,
          size: s,
          quantity: exist ? exist.quantity : 0,
          sku: `${v.colorName}-${s}`.toUpperCase(),
        });
      });
    });
    setFormData((prev) => ({ ...prev, stock: newStock }));
    toast.success("Stock Generated");
  };

  const prepareSubmit = () => {
    if (!formData.title || !formData.price)
      return toast.error("Title & Price required");
    const data = new FormData();
    const cleanVisuals = formData.visuals.map((v) => {
      const { previewImages, ...rest } = v;
      return rest;
    });
    data.append(
      "productData",
      JSON.stringify({ ...formData, visuals: cleanVisuals })
    );
    Object.keys(visualFiles).forEach((index) => {
      visualFiles[index].forEach((file) =>
        data.append(`images_${index}`, file)
      );
    });
    onSubmit(data);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        className="w-full max-w-5xl max-h-[90vh] flex flex-col rounded-3xl overflow-hidden shadow-2xl"
        style={{ backgroundColor: theme.bg, color: theme.text }}
      >
        <div
          className="p-6 border-b flex justify-between items-center"
          style={{
            borderColor: theme.navbar.border,
            backgroundColor: theme.card.bg,
          }}
        >
          <h2 className="text-xl font-black uppercase">
            {initialData ? "Edit Product" : "New Product"}
          </h2>
          <button onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <div
          className="flex border-b px-6 gap-6 text-sm font-bold uppercase"
          style={{ borderColor: theme.navbar.border }}
        >
          {["basic", "delivery", "visuals", "stock"].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`py-4 border-b-2 ${
                tab === t ? "border-current" : "border-transparent opacity-50"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          {tab === "basic" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                label="Title"
                name="title"
                val={formData.title}
                onChange={handleChange}
                theme={theme}
              />
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase opacity-60">
                  Category
                </label>
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  className="w-full p-3 rounded-xl border bg-transparent outline-none"
                  style={{ borderColor: theme.navbar.border }}
                >
                  <option value="">Select...</option>
                  <option value="Men's Shoes">Men's Shoes</option>
                  <option value="Women's Shoes">Women's Shoes</option>
                  <option value="Accessories">Accessories</option>
                </select>
              </div>
              <Input
                label="Price (₹)"
                name="price"
                type="number"
                val={formData.price}
                onChange={handleChange}
                theme={theme}
              />
              <Input
                label="Discount Price (₹)"
                name="discountPrice"
                type="number"
                val={formData.discountPrice}
                onChange={handleChange}
                theme={theme}
              />
              <div className="col-span-2">
                <label className="text-xs font-bold uppercase opacity-60">
                  Description
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  className="w-full p-4 rounded-xl border bg-transparent outline-none h-32"
                  style={{ borderColor: theme.navbar.border }}
                />
              </div>
            </div>
          )}

          {tab === "delivery" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="col-span-2 flex items-center gap-2 p-4 bg-blue-500/10 rounded-xl">
                <Truck size={20} className="text-blue-500" />
                <p className="text-sm font-bold text-blue-500">
                  Shipping & Returns Configuration
                </p>
              </div>
              <Input
                label="Estimated Delivery"
                name="estimatedDays"
                val={formData.deliveryInfo?.estimatedDays}
                onChange={handleDelivery}
                theme={theme}
                placeholder="e.g. 3-5 Business Days"
              />
              <Input
                label="Shipping Cost (0 for Free)"
                name="shippingCost"
                type="number"
                val={formData.deliveryInfo?.shippingCost}
                onChange={handleDelivery}
                theme={theme}
              />
              <div className="col-span-2">
                <Input
                  label="Return Policy"
                  name="returnPolicy"
                  val={formData.deliveryInfo?.returnPolicy}
                  onChange={handleDelivery}
                  theme={theme}
                  placeholder="e.g. 7 Days Return Policy"
                />
              </div>
            </div>
          )}

          {tab === "visuals" && (
            <div className="space-y-6">
              <button
                onClick={addVisual}
                className="w-full py-3 border-2 border-dashed rounded-xl font-bold opacity-60 hover:opacity-100"
              >
                + Add Color Variant
              </button>
              {formData.visuals.map((visual, idx) => (
                <div
                  key={idx}
                  className="border p-6 rounded-2xl space-y-4"
                  style={{ borderColor: theme.navbar.border }}
                >
                  <div className="flex justify-between">
                    <h3 className="font-bold text-sm uppercase">
                      Variant #{idx + 1}
                    </h3>
                    <button
                      onClick={() => removeVisual(idx)}
                      className="text-red-500"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Color Name"
                      val={visual.colorName}
                      onChange={(e) =>
                        updateVisual(idx, "colorName", e.target.value)
                      }
                      theme={theme}
                    />
                    <Input
                      label="Hex Code"
                      val={visual.hexCode}
                      onChange={(e) =>
                        updateVisual(idx, "hexCode", e.target.value)
                      }
                      theme={theme}
                      type="color"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase opacity-60 mb-2 block">
                      Images
                    </label>
                    <div className="flex flex-wrap gap-4">
                      {visual.images?.map((img, i) => (
                        <div
                          key={`ex-${i}`}
                          className="w-20 h-20 rounded border overflow-hidden relative group"
                        >
                          <img
                            src={getImageUrl(img)}
                            className="w-full h-full object-cover"
                          />
                          <button
                            onClick={() => removeImage(idx, i, false)}
                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100"
                          >
                            <X size={10} />
                          </button>
                        </div>
                      ))}
                      {visual.previewImages?.map((img, i) => (
                        <div
                          key={`pre-${i}`}
                          className="w-20 h-20 rounded border border-blue-500 overflow-hidden relative group"
                        >
                          <img
                            src={img}
                            className="w-full h-full object-cover"
                          />
                          <button
                            onClick={() => removeImage(idx, i, true)}
                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1"
                          >
                            <X size={10} />
                          </button>
                        </div>
                      ))}
                      <label
                        className="w-20 h-20 flex flex-col items-center justify-center border-2 border-dashed rounded cursor-pointer hover:bg-black/5"
                        style={{ borderColor: theme.navbar.border }}
                      >
                        <UploadCloud size={20} className="opacity-50" />
                        <input
                          type="file"
                          multiple
                          accept="image/*"
                          onChange={(e) => handleFileChange(e, idx)}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === "stock" && (
            <div className="space-y-6">
              <div
                className="p-4 border rounded-xl"
                style={{ borderColor: theme.navbar.border }}
              >
                <div className="flex justify-between mb-2">
                  <label className="text-xs font-bold uppercase opacity-60">
                    Sizes
                  </label>
                  <button
                    onClick={addSize}
                    className="text-xs text-blue-500 font-bold"
                  >
                    + Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.sizeInfo.chart.map((s, i) => (
                    <div
                      key={i}
                      className="flex border rounded overflow-hidden"
                      style={{ borderColor: theme.navbar.border }}
                    >
                      <input
                        value={s}
                        onChange={(e) => {
                          const c = [...formData.sizeInfo.chart];
                          c[i] = e.target.value;
                          setFormData((p) => ({
                            ...p,
                            sizeInfo: { ...p.sizeInfo, chart: c },
                          }));
                        }}
                        className="w-16 p-2 bg-transparent text-center outline-none"
                      />
                    </div>
                  ))}
                </div>
              </div>
              <button
                onClick={generateStock}
                className="w-full py-3 bg-black text-white rounded-xl font-bold uppercase text-xs"
              >
                Regenerate Stock
              </button>
              {formData.stock.length > 0 && (
                <div
                  className="border rounded-xl overflow-hidden"
                  style={{ borderColor: theme.navbar.border }}
                >
                  <table className="w-full text-left text-sm">
                    <thead className="bg-black/5">
                      <tr>
                        <th className="p-3">Variant</th>
                        <th className="p-3">Size</th>
                        <th className="p-3">Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {formData.stock.map((st, i) => (
                        <tr
                          key={i}
                          className="border-t"
                          style={{ borderColor: theme.navbar.border }}
                        >
                          <td className="p-3 font-bold">{st.colorName}</td>
                          <td className="p-3">{st.size}</td>
                          <td className="p-3">
                            <input
                              type="number"
                              value={st.quantity}
                              onChange={(e) => {
                                const s = [...formData.stock];
                                s[i].quantity = parseInt(e.target.value);
                                setFormData({ ...formData, stock: s });
                              }}
                              className="w-20 p-1 border rounded bg-transparent"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        <div
          className="p-6 border-t flex justify-end gap-3"
          style={{
            borderColor: theme.navbar.border,
            backgroundColor: theme.card.bg,
          }}
        >
          <button
            onClick={onClose}
            className="px-6 py-3 rounded-xl font-bold text-sm border hover:bg-black/5"
            style={{ borderColor: theme.navbar.border }}
          >
            Cancel
          </button>
          <button
            onClick={prepareSubmit}
            className="px-8 py-3 rounded-xl font-bold text-sm text-white shadow-lg hover:opacity-90"
            style={{ backgroundColor: theme.text }}
          >
            Save Changes
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const Input = ({
  label,
  name,
  val,
  onChange,
  type = "text",
  theme,
  placeholder,
}) => (
  <div className="space-y-2">
    <label className="text-xs font-bold uppercase opacity-60">{label}</label>
    <input
      type={type}
      name={name}
      value={val}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full p-3 rounded-xl border bg-transparent outline-none focus:ring-1 focus:ring-current"
      style={{ borderColor: theme.navbar.border }}
    />
  </div>
);

export default ProductsTab;
