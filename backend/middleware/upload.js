const multer = require("multer");
const path = require("path");

// ─────────────────────────────────────────────
// Storage (temporary local storage)
// ─────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/"); // make sure this folder exists
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueName + path.extname(file.originalname));
  },
});

// ─────────────────────────────────────────────
// File Filter (VERY IMPORTANT)
// ─────────────────────────────────────────────
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    "audio/webm",
    "audio/mpeg",
    "audio/wav",
    "audio/mp3",
    "audio/ogg",
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only audio files are allowed"), false);
  }
};

// ─────────────────────────────────────────────
// Multer Config
// ─────────────────────────────────────────────
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
});

module.exports = upload;
