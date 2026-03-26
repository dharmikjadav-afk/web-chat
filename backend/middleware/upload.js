const multer = require("multer");
const path = require("path");
const fs = require("fs");

/*
==========================================================================
  Upload Middleware — Multer Configuration
  Supports: Audio · Images · Documents
  Max size : 25 MB per file
  Strategy : Disk storage → Cloudinary (controller handles cloud upload)
==========================================================================
*/

// ─────────────────────────────────────────────────────────────────────────
// 1. Ensure upload directory exists at startup
// ─────────────────────────────────────────────────────────────────────────
const UPLOAD_DIR = path.join(__dirname, "..", "uploads");

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// ─────────────────────────────────────────────────────────────────────────
// 2. Allowed MIME types (grouped for readability + easy extension)
// ─────────────────────────────────────────────────────────────────────────
const ALLOWED_MIME_TYPES = new Set([
  // ── Audio ──────────────────────────────────────────────────────────────
  "audio/webm",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/ogg",
  "audio/aac",
  "audio/x-m4a",

  // ── Images ─────────────────────────────────────────────────────────────
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",

  // ── Documents ──────────────────────────────────────────────────────────
  "application/pdf",
  "text/plain",
  "application/msword", // .doc
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/vnd.ms-excel", // .xls
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "application/vnd.ms-powerpoint", // .ppt
  "application/vnd.openxmlformats-officedocument.presentationml.presentation", // .pptx
  "application/zip",
  "application/x-zip-compressed",

  // ── Encrypted blobs ────────────────────────────────────────────────────
  // Audio, image, and file ciphertext are all sent as raw binary because
  // AES-GCM output is not a recognisable media format.
  "application/octet-stream",
]);

// ─────────────────────────────────────────────────────────────────────────
// 3. Allowed file extensions (second layer of validation after MIME)
// ─────────────────────────────────────────────────────────────────────────
const ALLOWED_EXTENSIONS = new Set([
  // audio
  ".webm",
  ".mp3",
  ".wav",
  ".ogg",
  ".aac",
  ".m4a",
  // images
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".svg",
  // documents
  ".pdf",
  ".txt",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".zip",
  // encrypted blobs (no real extension — stored with .enc suffix by frontend)
  ".enc",
]);

// ─────────────────────────────────────────────────────────────────────────
// 4. Disk storage — temporary local files before Cloudinary upload
// ─────────────────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR);
  },

  filename: (_req, file, cb) => {
    // <timestamp>-<random>.<ext>  — avoids name collisions completely
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname).toLowerCase() || ".bin";
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

// ─────────────────────────────────────────────────────────────────────────
// 5. File filter — MIME type + extension double-check
// ─────────────────────────────────────────────────────────────────────────
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();

  const isMimeAllowed = ALLOWED_MIME_TYPES.has(file.mimetype);
  const isExtAllowed = ALLOWED_EXTENSIONS.has(ext) || ext === ""; // .enc blobs may have no ext

  if (isMimeAllowed && isExtAllowed) {
    return cb(null, true);
  }

  // Reject with a structured error the global error handler can forward
  const err = new Error(
    `File type not allowed: ${file.mimetype} (${ext || "no extension"})`,
  );
  err.statusCode = 415; // Unsupported Media Type
  cb(err, false);
};

// ─────────────────────────────────────────────────────────────────────────
// 6. Multer instance
// ─────────────────────────────────────────────────────────────────────────
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25 MB — matches WhatsApp media limit
    files: 1, // one file per request
    fieldSize: 10 * 1024 * 1024, // 10 MB for non-file fields (encrypted key strings)
  },
});

// ─────────────────────────────────────────────────────────────────────────
// 7. Named field configurations
//    Use these in routes instead of inline upload.fields([...])
//    so every route stays consistent.
// ─────────────────────────────────────────────────────────────────────────

/** Accepts both audio and file in the same multipart request */
upload.mediaFields = upload.fields([
  { name: "audio", maxCount: 1 },
  { name: "file", maxCount: 1 },
]);

/** Single audio field only (kept for any legacy routes) */
upload.audioOnly = upload.single("audio");

/** Single file/image field only */
upload.fileOnly = upload.single("file");

// ─────────────────────────────────────────────────────────────────────────
// 8. Utility — delete temp file after Cloudinary upload
//    Call this in the controller once the cloud upload completes.
// ─────────────────────────────────────────────────────────────────────────
upload.cleanupTempFile = (filePath) => {
  if (!filePath) return;
  fs.unlink(filePath, (err) => {
    if (err && err.code !== "ENOENT") {
      console.error("[upload] Failed to remove temp file:", err.message);
    }
  });
};

module.exports = upload;
