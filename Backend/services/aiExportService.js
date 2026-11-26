const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const PDFDocument = require("pdfkit");
const PptxGenJS = require("pptxgenjs");
const { PDFParse } = require("pdf-parse");

const MAX_DOC_TEXT_CHARS = 12000;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB inline multimodal threshold
const AI_ATTACH_DIR = path.resolve(__dirname, "../uploads/ai-attachments");

/**
 * Generates a small inline preview data URL so message thumbnails stay visible
 * even after temporary disk files are cleaned post-inference.
 */
async function buildCompactThumbDataUrl(filePath) {
  try {
    const thumbBuf = await sharp(filePath)
      .rotate()
      .resize({ width: 160, height: 160, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 72 })
      .toBuffer();
    if (thumbBuf.length > 0 && thumbBuf.length <= 28 * 1024) {
      return `data:image/webp;base64,${thumbBuf.toString("base64")}`;
    }
  } catch {}
  return "";
}

/**
 * Safely deletes a single uploaded Copilot temporary attachment from uploads/ai-attachments.
 */
function deleteAttachmentFileSafe(filePathOrName) {
  if (!filePathOrName || typeof filePathOrName !== "string") return false;
  try {
    const baseName = path.basename(filePathOrName.trim());
    if (!baseName || baseName === "." || baseName === "..") return false;
    const resolved = path.resolve(AI_ATTACH_DIR, baseName);
    if (!resolved.startsWith(AI_ATTACH_DIR + path.sep)) return false;
    if (fs.existsSync(resolved)) {
      fs.unlinkSync(resolved);
      return true;
    }
  } catch {}
  return false;
}

/**
 * Cleans up attachment files referenced by a completed Copilot message once inference finishes.
 */
function cleanupAttachmentFiles(attachments = []) {
  let removed = 0;
  for (const att of attachments || []) {
    if (!att) continue;
    const target = att.filePath || att.url || "";
    if (target && deleteAttachmentFileSafe(target)) {
      removed += 1;
    }
  }
  if (removed > 0) {
    console.log(`[LIRA COPILOT] ATTACH_CLEANUP removed=${removed} temporary file(s) after inference`);
  }
  return removed;
}

/**
 * Periodic sweeper removing abandoned or orphaned AI attachments older than maxAgeMs.
 */
function purgeStaleAIAttachments(maxAgeMs = 20 * 60 * 1000) {
  try {
    if (!fs.existsSync(AI_ATTACH_DIR)) return 0;
    const now = Date.now();
    let purged = 0;
    for (const entry of fs.readdirSync(AI_ATTACH_DIR)) {
      const full = path.join(AI_ATTACH_DIR, entry);
      try {
        const stat = fs.statSync(full);
        if (stat.isFile() && now - stat.mtimeMs > maxAgeMs) {
          fs.unlinkSync(full);
          purged += 1;
        }
      } catch {}
    }
    if (purged > 0) {
      console.log(`[LIRA COPILOT] ATTACH_PERIODIC_PURGE removed=${purged} stale file(s)`);
    }
    return purged;
  } catch {
    return 0;
  }
}

let cleanupTimerStarted = false;
function startAIAttachmentCleanupScheduler() {
  if (cleanupTimerStarted) return;
  cleanupTimerStarted = true;
  purgeStaleAIAttachments();
  const timer = setInterval(() => purgeStaleAIAttachments(), 15 * 60 * 1000);
  if (typeof timer.unref === "function") timer.unref();
}

/**
 * Extracts safe metadata & text content from uploaded Copilot attachments.
 */
async function processUploadedAttachment(file) {
  if (!file || !file.path) return null;
  const ext = path.extname(file.originalname || "").toLowerCase();
  const mime = String(file.mimetype || "").toLowerCase();
  const relUrl = `/uploads/ai-attachments/${path.basename(file.path)}`;

  const isImage =
    mime.startsWith("image/") || [".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(ext);

  if (isImage) {
    const thumbDataUrl = await buildCompactThumbDataUrl(file.path);
    return {
      name: file.originalname,
      filename: path.basename(file.path),
      mimeType: mime || "image/png",
      size: file.size || 0,
      url: thumbDataUrl || relUrl,
      previewUrl: relUrl,
      thumbDataUrl,
      filePath: file.path,
      kind: "image",
      extractedText: "",
    };
  }

  let extractedText = "";
  try {
    if (mime === "application/pdf" || ext === ".pdf") {
      const buf = fs.readFileSync(file.path);
      const parser = new PDFParse({ data: buf });
      const parsed = await parser.getText();
      await parser.destroy?.().catch(() => {});
      extractedText = String(parsed?.text || "").replace(/\s+\n/g, "\n").trim();
    } else if (
      mime.startsWith("text/") ||
      [".txt", ".md", ".csv", ".json", ".log", ".tsv", ".xml", ".yaml", ".yml"].includes(ext)
    ) {
      extractedText = fs.readFileSync(file.path, "utf8");
    } else {
      extractedText = `[Binary document attached: ${file.originalname} (${mime || ext || "file"}, ${Math.round((file.size || 0) / 1024)} KB)]`;
    }
  } catch (err) {
    extractedText = `[Could not parse text from ${file.originalname}: ${err.message}]`;
  }

  if (extractedText.length > MAX_DOC_TEXT_CHARS) {
    extractedText = `${extractedText.slice(0, MAX_DOC_TEXT_CHARS)}\n...[truncated]`;
  }

  return {
    name: file.originalname,
    filename: path.basename(file.path),
    mimeType: mime || "application/octet-stream",
    size: file.size || 0,
    url: relUrl,
    filePath: file.path,
    kind: "document",
    extractedText,
  };
}

/**
 * Reads image attachment base64 lazily in worker right before LLM call (keeps Redis jobs tiny).
 */
function hydrateAttachmentsForModel(attachments = []) {
  const ready = [];
  for (const att of attachments || []) {
    if (!att) continue;
    if (att.kind === "image" && att.filePath && fs.existsSync(att.filePath)) {
      try {
        const stat = fs.statSync(att.filePath);
        if (stat.size <= MAX_IMAGE_BYTES) {
          const base64 = fs.readFileSync(att.filePath).toString("base64");
          ready.push({ ...att, base64 });
          continue;
        }
      } catch {}
    }
    ready.push(att);
  }
  return ready;
}

/**
 * Generates a formatted corporate PDF Buffer using PDFKit.
 */
function generatePDFBuffer({ title = "Lira Workspace Report", subtitle = "", sections = [], table = null, generatedBy = "Lira Copilot" }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: "A4" });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Header band
    doc.rect(0, 0, doc.page.width, 84).fill("#11131a");
    doc.fillColor("#ffffff").fontSize(18).font("Helvetica-Bold").text(String(title), 48, 26);
    if (subtitle) {
      doc.fillColor("#cbd5e1").fontSize(10).font("Helvetica").text(String(subtitle), 48, 52);
    }
    doc.moveDown(3.2);
    doc.fillColor("#64748b").fontSize(8.5).text(`Generated by ${generatedBy} • ${new Date().toLocaleString()}`);
    doc.moveDown(1);

    for (const sec of sections || []) {
      if (sec.heading) {
        doc.fillColor("#0f172a").fontSize(12.5).font("Helvetica-Bold").text(String(sec.heading));
        doc.moveDown(0.35);
      }
      if (sec.body) {
        doc.fillColor("#334155").fontSize(10).font("Helvetica").text(String(sec.body), { lineGap: 3 });
        doc.moveDown(0.5);
      }
      if (Array.isArray(sec.bullets)) {
        for (const b of sec.bullets) {
          doc.fillColor("#1e293b").fontSize(10).font("Helvetica").text(`• ${String(b)}`, { indent: 12, lineGap: 2 });
        }
        doc.moveDown(0.6);
      }
    }

    if (table && Array.isArray(table.headers) && table.headers.length > 0) {
      doc.moveDown(0.5);
      doc.fillColor("#0f172a").fontSize(11).font("Helvetica-Bold").text(table.title || "Data Summary");
      doc.moveDown(0.3);
      const colW = Math.floor((doc.page.width - 96) / Math.min(table.headers.length, 6));
      const startX = 48;
      let y = doc.y;
      doc.fontSize(8.5).font("Helvetica-Bold").fillColor("#0f172a");
      table.headers.slice(0, 6).forEach((h, i) => {
        doc.text(String(h), startX + i * colW, y, { width: colW - 6, ellipsis: true });
      });
      y += 16;
      doc.moveTo(startX, y - 3).lineTo(doc.page.width - 48, y - 3).stroke("#cbd5e1");
      doc.font("Helvetica").fillColor("#334155");
      for (const row of (table.rows || []).slice(0, 40)) {
        if (y > doc.page.height - 64) {
          doc.addPage();
          y = 48;
        }
        (row || []).slice(0, 6).forEach((cell, i) => {
          doc.text(String(cell ?? ""), startX + i * colW, y, { width: colW - 6, ellipsis: true });
        });
        y += 15;
      }
    }

    doc.end();
  });
}

/**
 * Generates a widescreen 16:9 PowerPoint (.pptx) presentation Buffer using PptxGenJS.
 */
async function generatePPTXBuffer({ title = "Lira Workspace Presentation", subtitle = "", slides = [], generatedBy = "Lira Copilot" }) {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_16x9";
  pptx.author = generatedBy;
  pptx.title = String(title);

  // Slide 1: Cover
  const cover = pptx.addSlide();
  cover.background = { color: "0E1017" };
  cover.addText("LIRA WORKSPACE", {
    x: 0.7,
    y: 0.9,
    fontSize: 11,
    bold: true,
    color: "A855F7",
    fontFace: "Arial",
  });
  cover.addText(String(title), {
    x: 0.7,
    y: 1.5,
    w: 8.6,
    fontSize: 32,
    bold: true,
    color: "F8FAFC",
    fontFace: "Arial",
  });
  if (subtitle) {
    cover.addText(String(subtitle), {
      x: 0.7,
      y: 2.9,
      w: 8.6,
      fontSize: 15,
      color: "94A3B8",
      fontFace: "Arial",
    });
  }
  cover.addText(`Prepared by ${generatedBy} • ${new Date().toLocaleDateString()}`, {
    x: 0.7,
    y: 4.8,
    fontSize: 11,
    color: "64748B",
  });

  for (const s of slides || []) {
    const slide = pptx.addSlide();
    slide.background = { color: "131620" };
    slide.addText(String(s.title || "Overview"), {
      x: 0.7,
      y: 0.5,
      w: 8.6,
      fontSize: 22,
      bold: true,
      color: "F8FAFC",
    });

    if (Array.isArray(s.bullets) && s.bullets.length > 0) {
      slide.addText(
        s.bullets.map((b) => ({ text: String(b), options: { bullet: true, breakLine: true } })),
        {
          x: 0.7,
          y: 1.35,
          w: 8.6,
          h: 3.6,
          fontSize: 14,
          color: "E2E8F0",
          paraSpaceAfter: 8,
        }
      );
    } else if (s.body) {
      slide.addText(String(s.body), {
        x: 0.7,
        y: 1.35,
        w: 8.6,
        fontSize: 14,
        color: "E2E8F0",
      });
    }

    if (s.table && Array.isArray(s.table.headers)) {
      const tableRows = [
        s.table.headers.map((h) => ({ text: String(h), options: { bold: true, fill: "1E293B", color: "F8FAFC" } })),
        ...(s.table.rows || []).slice(0, 10).map((r) => (r || []).map((c) => ({ text: String(c ?? ""), options: { color: "CBD5E1" } }))),
      ];
      slide.addTable(tableRows, {
        x: 0.7,
        y: 2.3,
        w: 8.6,
        fontSize: 11,
        border: { pt: 1, color: "334155" },
      });
    }
  }

  return await pptx.write({ outputType: "nodebuffer" });
}

function generateCSVString({ headers = [], rows = [] }) {
  const esc = (v) => {
    const s = String(v ?? "");
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [];
  if (headers.length > 0) lines.push(headers.map(esc).join(","));
  for (const r of rows || []) lines.push((r || []).map(esc).join(","));
  return lines.join("\n");
}

module.exports = {
  processUploadedAttachment,
  hydrateAttachmentsForModel,
  deleteAttachmentFileSafe,
  cleanupAttachmentFiles,
  purgeStaleAIAttachments,
  startAIAttachmentCleanupScheduler,
  generatePDFBuffer,
  generatePPTXBuffer,
  generateCSVString,
};
