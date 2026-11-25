import React, { useState, useRef } from "react";
import {
  UploadCloud,
  Pause,
  Play,
  X,
  CheckCircle2,
  AlertCircle,
  FileText,
  Wifi,
} from "lucide-react";
import { getChunkStatus, uploadSingleChunk } from "../../services/api";
import { useApp } from "../../context/Appcontext";
import { formatFileSize } from "../../utils/formatters";
import { getGlassTokens } from "../../styles/glassTheme";

const CHUNK_SIZE = 1 * 1024 * 1024;

export default function ChunkUploader({ onUploadComplete, onClose, accept = "*/*" }) {
  const { theme } = useApp();
  const isDark = theme === "dark";
  const g = getGlassTokens(isDark);

  const [file, setFile] = useState(null);
  const [uploadId, setUploadId] = useState("");
  const [status, setStatus] = useState("idle"); // idle, uploading, paused, completed, error
  const [progress, setProgress] = useState(0);
  const [uploadSpeed, setUploadSpeed] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");

  const isPausedRef = useRef(false);
  const isCancelledRef = useRef(false);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setFile(selected);
    const generatedId = `up_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    setUploadId(generatedId);
    setProgress(0);
    setStatus("idle");
    setErrorMessage("");
  };

  const startUpload = async () => {
    if (!file || !uploadId) return;

    setStatus("uploading");
    isPausedRef.current = false;
    isCancelledRef.current = false;
    setErrorMessage("");

    try {
      const statusRes = await getChunkStatus(uploadId);
      const uploadedSet = new Set(statusRes.uploadedChunks || []);
      const tChunks = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));

      for (let i = 0; i < tChunks; i++) {
        if (isCancelledRef.current) {
          setStatus("idle");
          return;
        }

        while (isPausedRef.current) {
          await new Promise((resolve) => setTimeout(resolve, 300));
          if (isCancelledRef.current) return;
        }

        if (uploadedSet.has(i)) {
          setProgress(Math.round(((i + 1) / tChunks) * 100));
          continue;
        }

        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunkBlob = file.slice(start, end);

        const formData = new FormData();
        formData.append("chunk", chunkBlob, `part_${i}`);
        formData.append("uploadId", uploadId);
        formData.append("chunkIndex", i);
        formData.append("totalChunks", tChunks);
        formData.append("fileName", file.name);
        formData.append("fileSize", file.size);
        formData.append("mimeType", file.type || "application/octet-stream");

        const startTime = Date.now();
        const response = await uploadSingleChunk(formData);
        const durationSec = Math.max(0.1, (Date.now() - startTime) / 1000);
        const chunkKb = chunkBlob.size / 1024;
        setUploadSpeed(Math.round(chunkKb / durationSec));

        const currentProgress = Math.min(100, Math.round(((i + 1) / tChunks) * 100));
        setProgress(currentProgress);

        if (response.data.completed) {
          setStatus("completed");
          if (onUploadComplete) {
            onUploadComplete(response.data);
          }
          return;
        }
      }
    } catch (err) {
      console.error("File upload failed:", err);
      setStatus("error");
      setErrorMessage(err.response?.data?.message || err.message || "Upload interrupted");
    }
  };

  const togglePause = () => {
    if (status === "uploading") {
      isPausedRef.current = true;
      setStatus("paused");
    } else if (status === "paused") {
      isPausedRef.current = false;
      setStatus("uploading");
      startUpload();
    }
  };

  const cancelUpload = () => {
    isCancelledRef.current = true;
    isPausedRef.current = false;
    setFile(null);
    setProgress(0);
    setStatus("idle");
    if (onClose) onClose();
  };

  return (
    <div
      className={`border rounded-2xl p-5 shadow-xl w-full max-w-lg mx-auto ${g.card}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className={`w-9 h-9 rounded-xl border flex items-center justify-center ${g.badge}`}>
            <UploadCloud className="w-5 h-5" />
          </div>
          <div>
            <h3 className={`text-sm font-bold ${g.heading}`}>
              Upload & Share File
            </h3>
            <p className={`text-[11px] ${g.muted}`}>
              Send documents, screenshots, and deliverables to your team
            </p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${g.iconBtn}`}
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* File Drop / Select Area */}
      {!file ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors group ${g.subtleSurface} ${g.rowHover}`}
        >
          <UploadCloud className={`w-10 h-10 transition-colors mb-2 ${g.muted}`} />
          <p className={`text-xs font-semibold ${g.heading}`}>
            Click to select a file to share
          </p>
          <span className={`text-[10px] mt-1 ${g.muted}`}>
            Supports documents, images, PDFs, and archives
          </span>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept={accept}
            className="hidden"
          />
        </div>
      ) : (
        <div className="space-y-4">
          {/* File Card */}
          <div className={`p-3 rounded-xl border flex items-center justify-between ${g.subtleSurface}`}>
            <div className="flex items-center gap-3 min-w-0">
              <FileText className={`w-5 h-5 shrink-0 ${g.accentIcon}`} />
              <div className="min-w-0">
                <p className={`text-xs font-bold truncate ${g.heading}`}>
                  {file.name}
                </p>
                <p className={`text-[10px] ${g.muted}`}>{formatFileSize(file.size)}</p>
              </div>
            </div>
            {status === "idle" && (
              <button
                onClick={() => setFile(null)}
                className="text-xs text-zinc-400 hover:text-rose-400 px-2 py-1 cursor-pointer"
              >
                Change
              </button>
            )}
          </div>

          {/* Progress Bar & Stats */}
          {status !== "idle" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold flex items-center gap-1.5">
                  {status === "completed" ? (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Upload Completed
                    </span>
                  ) : status === "paused" ? (
                    <span className="text-amber-400 flex items-center gap-1">
                      <Pause className="w-3.5 h-3.5" /> Paused
                    </span>
                  ) : (
                    <span className={`flex items-center gap-1 ${g.heading}`}>
                      <Wifi className="w-3.5 h-3.5 animate-pulse" /> Uploading...
                    </span>
                  )}
                </span>
                <span className={`font-mono font-bold ${g.muted}`}>{progress}%</span>
              </div>

              <div className={`h-2 w-full rounded-full overflow-hidden border ${g.progressTrack} ${g.border}`}>
                <div
                  className={`h-full transition-all duration-300 rounded-full ${
                    status === "completed"
                      ? "bg-emerald-500"
                      : status === "paused"
                      ? "bg-amber-500"
                      : g.progressFill
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>

              {status === "uploading" && (
                <div className={`flex justify-between text-[11px] font-mono ${g.muted}`}>
                  <span>Transfer rate: {uploadSpeed} KB/s</span>
                  <span>{formatFileSize(file.size * (progress / 100))} sent</span>
                </div>
              )}
            </div>
          )}

          {status === "error" && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Controls */}
          <div className="flex items-center justify-end gap-2 pt-2">
            {status === "idle" && (
              <button
                onClick={startUpload}
                className={`w-full py-2.5 px-4 rounded-xl text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer ${g.btnPrimary}`}
              >
                <UploadCloud className="w-4 h-4" /> Upload & Share File
              </button>
            )}

            {(status === "uploading" || status === "paused") && (
              <>
                <button
                  onClick={togglePause}
                  className={`flex-1 py-2 px-3 rounded-xl font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                    isDark ? "bg-white/10 hover:bg-white/15 text-slate-200" : "bg-slate-200 hover:bg-slate-300 text-slate-800"
                  }`}
                >
                  {status === "uploading" ? (
                    <>
                      <Pause className="w-3.5 h-3.5 text-amber-400" /> Pause
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 text-emerald-400" /> Resume
                    </>
                  )}
                </button>
                <button
                  onClick={cancelUpload}
                  className="py-2 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 font-semibold text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </>
            )}

            {status === "completed" && (
              <button
                onClick={() => {
                  setFile(null);
                  setStatus("idle");
                  if (onClose) onClose();
                }}
                className="w-full py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors cursor-pointer"
              >
                Done
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
