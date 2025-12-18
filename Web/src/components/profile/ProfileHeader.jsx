import React, { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera,
  LogOut,
  X,
  Check,
  Loader2,
  User as UserIcon,
} from "lucide-react";
import Cropper from "react-easy-crop";
import GoogleIcon from "../GoogleIcon";

// Get API URL from env
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

// --- 1. Helper: Generate Cropped Image ---
const getCroppedImg = async (imageSrc, pixelCrop) => {
  const image = new Image();
  image.src = imageSrc;
  await new Promise((resolve) => {
    image.onload = resolve;
  });

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        resolve(blob);
      },
      "image/jpeg",
      0.95
    );
  });
};

// --- 2. Crop Modal ---
const CropModal = ({ imageSrc, onCancel, onSave, theme }) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const onCropComplete = useCallback((_, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels);
      await onSave(croppedBlob);
    } catch (e) {
      console.error(e);
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div
        className="relative w-full max-w-md rounded-3xl overflow-hidden flex flex-col max-h-[90vh]"
        style={{
          backgroundColor: theme.navbar?.modalBg || "#111",
          border: `1px solid ${theme.navbar?.border || "#333"}`,
        }}
      >
        <div className="p-4 flex justify-between items-center border-b border-white/10 z-10 bg-inherit">
          <h3 className="font-bold text-lg">Edit Photo</h3>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-white/10 rounded-full"
          >
            <X size={20} />
          </button>
        </div>

        <div className="relative h-64 sm:h-80 w-full bg-black">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            onCropChange={setCrop}
            onCropComplete={onCropComplete}
            onZoomChange={setZoom}
            cropShape="round"
            showGrid={false}
          />
        </div>

        <div className="p-6 space-y-6 bg-inherit z-10">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase opacity-50 ml-1">
              Zoom
            </label>
            <input
              type="range"
              value={zoom}
              min={1}
              max={3}
              step={0.1}
              aria-labelledby="Zoom"
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full accent-current h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 py-3 rounded-xl font-bold uppercase text-xs hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 py-3 rounded-xl font-bold uppercase text-xs bg-white text-black hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Check size={16} />
              )}
              Save Profile
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- 3. Main ProfileHeader ---
export default function ProfileHeader({
  user,
  theme,
  onLogoutClick,
  onUpdateProfileImage,
  isLoading = false,
}) {
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);

  // Image Loading State: 'loading' | 'loaded' | 'error'
  const [imgStatus, setImgStatus] = useState("loading");

  const handleCameraClick = () => fileInputRef.current?.click();

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.addEventListener("load", () => setSelectedFile(reader.result));
      reader.readAsDataURL(file);
    }
  };

  const handleSaveCrop = async (croppedBlob) => {
    const file = new File([croppedBlob], "profile.jpg", { type: "image/jpeg" });
    if (onUpdateProfileImage) await onUpdateProfileImage(file);
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // --- LOGIC: Resolve Image URL ---
  const getImageUrl = (path) => {
    if (!path) return null;
    if (path.startsWith("http") || path.startsWith("blob:")) {
      return path;
    }
    return `${API_BASE_URL}${path}`;
  };

  const profileSrc = getImageUrl(user?.profilePicture);

  // Effect: Reset to loading whenever the source changes
  useEffect(() => {
    if (profileSrc) {
      setImgStatus("loading");
    } else {
      setImgStatus("error");
    }
  }, [profileSrc]);

  // Note: Removed the global "if (isLoading)" return block.
  // Skeleton is now localized to the image container.

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row items-center md:items-end gap-8 mb-16"
      >
        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Avatar Section */}
        <div className="relative group">
          <div
            className="w-32 h-32 rounded-full overflow-hidden border-2 transition-transform group-hover:scale-105 flex items-center justify-center relative"
            style={{
              borderColor: theme.scrollbar.teeth || "rgba(255,255,255,0.1)",
              backgroundColor:
                theme.scrollbar.handleGradientStart ||
                (theme.bg === "#000000" ? "#18181b" : "#f3f4f6"),
            }}
          >
            <AnimatePresence mode="wait">
              {/* 1. GLASSMORPHIC SKELETON */}
              {/* Shows if global isLoading is true OR local image is downloading */}
              {(isLoading || imgStatus === "loading") && (
                <motion.div
                  key="skeleton"
                  initial={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-20 flex items-center justify-center"
                >
                  {/* The Glass Effect Layer */}
                  <div className="w-full h-full bg-gray-200/20 dark:bg-white/10 backdrop-blur-md animate-pulse" />
                </motion.div>
              )}

              {/* 2. ACTUAL IMAGE */}
              {/* Shows only if NOT global loading AND we have a valid image source */}
              {!isLoading && profileSrc && imgStatus !== "error" ? (
                <motion.img
                  key={profileSrc}
                  src={profileSrc}
                  alt="Profile"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: imgStatus === "loaded" ? 1 : 0 }}
                  transition={{ duration: 0.3 }}
                  className="w-full h-full object-cover absolute inset-0 z-10"
                  onLoad={() => setImgStatus("loaded")}
                  onError={() => setImgStatus("error")}
                  loading="eager"
                />
              ) : (
                // 3. FALLBACK ICON
                // Shows if not loading and no image available/error
                !isLoading && (
                  <UserIcon
                    className="w-12 h-12 opacity-50 z-0"
                    style={{ color: theme.text }}
                  />
                )
              )}
            </AnimatePresence>
          </div>

          <button
            onClick={handleCameraClick}
            className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white cursor-pointer backdrop-blur-[2px] z-30"
            title="Change Profile Picture"
          >
            <Camera size={24} strokeWidth={2.5} />
          </button>
        </div>

        {/* Info Section - Always Visible */}
        <div className="text-center md:text-left flex-1 min-w-0">
          <div className="flex items-center justify-center md:justify-start gap-3 flex-wrap">
            <span className="text-3xl sm:text-4xl font-black uppercase tracking-tight truncate max-w-full">
              {user?.fullname || "Welcome"}
            </span>
            {user?.role === "admin" && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-red-500 text-white tracking-widest shadow-sm">
                Admin
              </span>
            )}
          </div>

          <div className="flex items-center justify-center md:justify-start gap-2 mt-2">
            <p className="opacity-60 font-mono text-sm truncate">
              {user?.email}
            </p>
            {user?.googleId && (
              <div
                title="Linked via Google"
                className="opacity-80 hover:opacity-100 transition-opacity"
              >
                <GoogleIcon size={16} />
              </div>
            )}
          </div>

          {(user?.id || user?._id || user?.createdAt) && (
            <p className="text-[10px] uppercase font-bold tracking-wider opacity-40 mt-3 flex items-center justify-center md:justify-start gap-2">
              {user?._id && (
                <span className="font-mono">ID: {user._id.slice(-6)}</span>
              )}
              {user?.createdAt && (
                <>
                  <span>•</span>
                  <span>
                    Joined{" "}
                    {new Date(user.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </>
              )}
            </p>
          )}
        </div>

        {/* Logout Button */}
        <button
          onClick={onLogoutClick}
          className="flex items-center gap-2 px-6 py-3 rounded-full border hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/50 transition-all text-sm font-bold uppercase tracking-wider group shrink-0"
          style={{
            borderColor: theme.navbar?.border || "rgba(150,150,150,0.2)",
            color: theme.text,
          }}
        >
          <LogOut
            size={16}
            className="group-hover:-translate-x-1 transition-transform"
          />{" "}
          Sign Out
        </button>
      </motion.div>

      <AnimatePresence>
        {selectedFile && (
          <CropModal
            imageSrc={selectedFile}
            onCancel={() => {
              setSelectedFile(null);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
            onSave={handleSaveCrop}
            theme={theme}
          />
        )}
      </AnimatePresence>
    </>
  );
}
