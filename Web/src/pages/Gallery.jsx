import { useEffect, useState } from "react";
import DomeGallery from "../components/gallery/DomeGallery";
// 1. 👇 UPDATE IMPORT: Import 'getallGallery' instead of 'getGallery'
import { getallGallery } from "../services/api";

export default function Gallery() {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);

  // Use import.meta.env for Vite, with a localhost fallback
  const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

  useEffect(() => {
    const fetchImages = async () => {
      try {
        // 2. 👇 UPDATE CALL: Use the new function here
        const response = await getallGallery();
        console.log("Public Gallery Response:", response);

        if (response.success && Array.isArray(response.data)) {
          // 3. Map Backend Data -> DomeGallery Format
          const formattedImages = response.data.map((img) => ({
            src:
              img.url.startsWith("http") || img.url.startsWith("blob:")
                ? img.url
                : `${API_BASE_URL}${img.url}`,
            alt: img.title || "Gallery Image",
          }));

          setImages(formattedImages);
        } else {
          console.warn("API returned success: false or invalid data", response);
        }
      } catch (error) {
        console.error("Failed to load gallery images", error);
      } finally {
        setLoading(false);
      }
    };

    fetchImages();
  }, []);

  return (
    <div
      style={{
        width: "100vw",
        height: "105vh",

      }}
    >
      {!loading && (
        <DomeGallery images={images.length > 0 ? images : undefined} />
      )}
    </div>
  );
}
