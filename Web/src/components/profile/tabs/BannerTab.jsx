import React, { useState, useEffect, useContext } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Trash2,
  X,
  UploadCloud,
  Loader2,
  ImageIcon,
  Type,
  Maximize2,
  Layout,
} from "lucide-react";
import { ThemeContext } from "@/context/ThemeContext";
import toast from "react-hot-toast";
import { getBanners, createBanner, deleteBanner } from "@/services/api";

const getImageUrl = (path) => {
  if (!path) return "";
  if (path.startsWith("http") || path.startsWith("blob")) return path;
  return `${import.meta.env.VITE_API_URL}${path}`;
};

const BannerTab = () => {
  const { theme } = useContext(ThemeContext);
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Tab State: 'home' or 'shop'
  const [activeTab, setActiveTab] = useState("home");

  // Form State
  const [formData, setFormData] = useState({
    title: "",
    subtitle: "",
    page: "home", // Default upload page
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");

  const fetchBanners = async () => {
    setLoading(true);
    // Fetch ALL banners, we will filter in UI or you could fetch by activeTab
    // Here fetching all to count them easily
    const res = await getBanners();
    if (res.success) setBanners(res.data);
    setLoading(false);
  };

  useEffect(() => {
    fetchBanners();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this banner?")) return;
    const res = await deleteBanner(id);
    if (res.success) {
      toast.success("Banner deleted");
      fetchBanners();
    } else {
      toast.error(res.message);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async () => {
    if (!selectedFile) return toast.error("Please select an image");

    const tId = toast.loading("Uploading...");
    const data = new FormData();
    data.append("title", formData.title);
    data.append("subtitle", formData.subtitle);
    data.append("page", formData.page); // Send the selected page
    data.append("image", selectedFile);

    const res = await createBanner(data);
    toast.dismiss(tId);

    if (res.success) {
      toast.success("Banner created!");
      setIsModalOpen(false);
      // Reset form
      setFormData({ title: "", subtitle: "", page: activeTab });
      setSelectedFile(null);
      setPreviewUrl("");
      fetchBanners();
    } else {
      toast.error(res.message);
    }
  };

  // Filter banners based on active tab
  const filteredBanners = banners.filter((b) => b.page === activeTab);

  return (
    <div className="w-full min-h-screen pb-32" style={{ color: theme.text }}>
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-4xl font-black uppercase tracking-tight">
            Store Banners
          </h1>
          <p className="opacity-60 text-sm mt-1">
            Manage Carousel images for Home & Shop pages.
          </p>
        </div>
        <button
          onClick={() => {
            setFormData((prev) => ({ ...prev, page: activeTab })); // Set default to current tab
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-6 py-3 rounded-full font-bold text-sm text-white shadow-xl hover:scale-105 transition-transform"
          style={{ backgroundColor: theme.text, color: theme.bg }}
        >
          <Plus size={18} /> Add Banner
        </button>
      </div>

      {/* TABS */}
      <div
        className="flex gap-6 mb-8 border-b"
        style={{ borderColor: theme.navbar.border }}
      >
        {["home", "shop"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-3 text-sm font-bold uppercase tracking-wider transition-all border-b-2 ${
              activeTab === tab
                ? "border-current opacity-100"
                : "border-transparent opacity-40 hover:opacity-70"
            }`}
          >
            {tab} Page
          </button>
        ))}
      </div>

      {/* BANNER GRID */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin opacity-50" size={40} />
        </div>
      ) : filteredBanners.length === 0 ? (
        <div
          className="text-center py-20 opacity-50 border-2 border-dashed rounded-3xl"
          style={{ borderColor: theme.navbar.border }}
        >
          <ImageIcon size={48} className="mx-auto mb-2" />
          <p>No banners for {activeTab} page yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredBanners.map((banner, index) => (
            <div
              key={banner._id || index}
              className="relative group rounded-3xl overflow-hidden shadow-lg border"
              style={{ borderColor: theme.navbar.border }}
            >
              <div className="aspect-video relative">
                <img
                  src={getImageUrl(banner.image)}
                  alt={banner.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/40 flex flex-col justify-end p-6">
                  <h3 className="text-white font-black text-2xl uppercase leading-none">
                    {banner.title}
                  </h3>
                  <p className="text-white/80 font-mono text-xs mt-1">
                    {banner.subtitle}
                  </p>
                </div>
              </div>

              <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleDelete(banner._id || banner.id)}
                  className="p-2 bg-white text-red-600 rounded-full shadow-lg hover:scale-110 transition-transform"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <div className="absolute top-4 left-4 bg-black/60 backdrop-blur px-3 py-1 rounded-full text-[10px] font-bold text-white uppercase tracking-widest">
                Slide {index + 1}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* UPLOAD MODAL */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl p-8"
              style={{ backgroundColor: theme.modalBg || theme.bg }}
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-black uppercase">Upload Banner</h2>
                <button onClick={() => setIsModalOpen(false)}>
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-6">
                {/* Image Upload */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase opacity-60">
                    Banner Image
                  </label>
                  <label
                    className="w-full aspect-video flex flex-col items-center justify-center border-2 border-dashed rounded-2xl cursor-pointer hover:bg-black/5 transition-colors overflow-hidden relative"
                    style={{ borderColor: theme.navbar.border }}
                  >
                    {previewUrl ? (
                      <img
                        src={previewUrl}
                        className="w-full h-full object-cover"
                        alt="Preview"
                      />
                    ) : (
                      <>
                        <UploadCloud size={32} className="opacity-40 mb-2" />
                        <span className="text-xs font-bold opacity-60">
                          Click to Upload
                        </span>
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* Page Selection */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase opacity-60">
                    Target Page
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    {["home", "shop"].map((p) => (
                      <button
                        key={p}
                        onClick={() => setFormData({ ...formData, page: p })}
                        className={`py-3 rounded-xl text-sm font-bold uppercase border-2 transition-all ${
                          formData.page === p
                            ? "border-blue-500 text-blue-500 bg-blue-500/10"
                            : "border-transparent bg-black/5 opacity-50 hover:opacity-100"
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Text Fields */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase opacity-60">
                      Title
                    </label>
                    <div className="relative">
                      <Type
                        size={16}
                        className="absolute left-4 top-1/2 -translate-y-1/2 opacity-40"
                      />
                      <input
                        value={formData.title}
                        onChange={(e) =>
                          setFormData({ ...formData, title: e.target.value })
                        }
                        className="w-full pl-10 pr-4 py-3 rounded-xl border bg-transparent outline-none focus:ring-2 focus:ring-current"
                        placeholder="e.g. SUMMER SALE"
                        style={{ borderColor: theme.navbar.border }}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase opacity-60">
                      Subtitle
                    </label>
                    <div className="relative">
                      <Maximize2
                        size={16}
                        className="absolute left-4 top-1/2 -translate-y-1/2 opacity-40"
                      />
                      <input
                        value={formData.subtitle}
                        onChange={(e) =>
                          setFormData({ ...formData, subtitle: e.target.value })
                        }
                        className="w-full pl-10 pr-4 py-3 rounded-xl border bg-transparent outline-none focus:ring-2 focus:ring-current"
                        placeholder="e.g. Up to 50% Off"
                        style={{ borderColor: theme.navbar.border }}
                      />
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleSubmit}
                  className="w-full py-4 rounded-xl font-bold uppercase tracking-widest text-white shadow-lg hover:opacity-90 transition-opacity mt-4"
                  style={{ backgroundColor: theme.text, color: theme.bg }}
                >
                  Save Banner
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BannerTab;
