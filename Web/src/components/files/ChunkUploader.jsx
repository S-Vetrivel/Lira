import React, { useState, useRef, useEffect } from "react";
import {
  UploadCloud,
  Pause,
  Play,
  X,
  CheckCircle2,
  AlertCircle,
  Gauge,
  FileText,
  Clock,
  Wifi,
} from "lucide-react";
import { getChunkStatus, uploadSingleChunk } from "../../services/api";
import { useApp } from "../../context/Appcontext";

const CHUNK_SIZE = 1 * 1024 * 1024; // 1MB chunks

export default function ChunkUploader({ onUploadComplete, onClose, accept = "*/*" }) {
  const { theme } = useApp();
  const isDark = theme === "dark";
  const [file, setFile] = useState(null);
  const [uploadId, setUploadId] = useState("");
  const [speedLimit, setSpeedLimit] = useState(0); // 0 = unlimited, in KB/s
  const [status, setStatus] = useState("idle"); // idle, uploading, paused, completed, error
  const [progress, setProgress] = useState(0);
  const [currentChunk, setCurrentChunk] = useState(0);
  const [totalChunks, setTotalChunks] = useState(0);
  const [uploadSpeed, setUploadSpeed] = useState(0); // current KB/s
  const [errorMessage, setErrorMessage] = useState("");

  const isPausedRef = useRef(false);
  const isCancelledRef = useRef(false);
  const fileInputRef = useRef(null);

  const speedOptions = [
    { label: "Uncapped (Maximum)", value: 0 },
    { label: "5.0 MB/s (Office Fast)", value: 5120 },
    { label: "1.0 MB/s (Standard)", value: 1024 },
    { label: "256 KB/s (Background Eco)", value: 256 },
  ];

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setFile(selected);
    const generatedId = `up_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    setUploadId(generatedId);
    setTotalChunks(Math.ceil(selected.size / CHUNK_SIZE));
    setProgress(0);
    setCurrentChunk(0);
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
      // 1. Check existing chunks for resumption
      const statusRes = await getChunkStatus(uploadId);
      const uploadedSet = new Set(statusRes.uploadedChunks || []);

      const tChunks = Math.ceil(file.size / CHUNK_SIZE);
      let uploadedBytes = uploadedSet.size * CHUNK_SIZE;

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
          setCurrentChunk(i + 1);
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
        formData.append("speedLimitKbps", speedLimit);

        const startTime = Date.now();
        const response = await uploadSingleChunk(formData);
        const durationSec = Math.max(0.1, (Date.now() - startTime) / 1000);
        const chunkKb = chunkBlob.size / 1024;
        setUploadSpeed(Math.round(chunkKb / durationSec));

        uploadedBytes += chunkBlob.size;
        setCurrentChunk(i + 1);
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
      console.error("Chunk upload failed:", err);
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
      className={`border rounded-2xl p-5 shadow-xl w-full max-w-lg mx-auto ${
        isDark
          ? "bg-[#14151c] border-white/10 text-slate-200"
          : "bg-white border-slate-200 text-slate-800"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <UploadCloud className="w-5 h-5" />
          </div>
          <div>
            <h3 className={`text-sm font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
              Resumable File Transfer
            </h3>
            <p className={`text-[11px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              Adaptive chunk upload with bandwidth governor
            </p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* File Drop / Select Area */}
      {!file ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-700 hover:border-blue-500/60 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors bg-slate-950/40 hover:bg-blue-500/5 group"
        >
          <UploadCloud className="w-10 h-10 text-slate-500 group-hover:text-blue-400 transition-colors mb-2" />
          <p className="text-xs font-semibold text-slate-200">
            Click to browse or drop office documents & deliverables
          </p>
          <span className="text-[10px] text-slate-400 mt-1">
            Files are transferred in 1MB chunks with SHA-256 integrity verification
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
          <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <FileText className="w-5 h-5 text-blue-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate">{file.name}</p>
                <p className="text-[10px] text-slate-400">
                  {(file.size / (1024 * 1024)).toFixed(2)} MB • {totalChunks} chunks
                </p>
              </div>
            </div>
            {status === "idle" && (
              <button
                onClick={() => setFile(null)}
                className="text-xs text-slate-400 hover:text-rose-400 px-2 py-1"
              >
                Change
              </button>
            )}
          </div>

          {/* Bandwidth Limiter Dropdown */}
          <div className="flex items-center justify-between gap-3 text-xs">
            <label className="flex items-center gap-1.5 font-medium text-slate-300">
              <Gauge className="w-3.5 h-3.5 text-blue-400" />
              <span>Bandwidth Limit:</span>
            </label>
            <select
              value={speedLimit}
              disabled={status === "completed"}
              onChange={(e) => setSpeedLimit(Number(e.target.value))}
              className="bg-slate-950 border border-slate-800 text-slate-200 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-blue-500"
            >
              {speedOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Progress Bar & Stats */}
          {status !== "idle" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  {status === "completed" ? (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Upload Completed
                    </span>
                  ) : status === "paused" ? (
                    <span className="text-amber-400 flex items-center gap-1">
                      <Pause className="w-3.5 h-3.5" /> Transfer Paused
                    </span>
                  ) : (
                    <span className="text-blue-400 flex items-center gap-1">
                      <Wifi className="w-3.5 h-3.5 animate-pulse" /> Uploading ({currentChunk}/{totalChunks} chunks)
                    </span>
                  )}
                </span>
                <span className="font-mono text-slate-400 font-bold">{progress}%</span>
              </div>

              {/* Bar */}
              <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                <div
                  className={`h-full transition-all duration-300 rounded-full ${
                    status === "completed"
                      ? "bg-emerald-500"
                      : status === "paused"
                      ? "bg-amber-500"
                      : "bg-blue-600"
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>

              {/* Speed Metric */}
              {status === "uploading" && (
                <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                  <span>Speed: {uploadSpeed} KB/s</span>
                  <span>{Math.round(((file.size * (progress / 100)) / (1024 * 1024)) * 10) / 10} MB uploaded</span>
                </div>
              )}
            </div>
          )}

          {/* Error display */}
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
                className="w-full py-2 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
              >
                <UploadCloud className="w-4 h-4" /> Start Resumable Upload
              </button>
            )}

            {(status === "uploading" || status === "paused") && (
              <>
                <button
                  onClick={togglePause}
                  className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
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
                  className="py-2 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 font-semibold text-xs transition-colors"
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
                className="w-full py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors"
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
