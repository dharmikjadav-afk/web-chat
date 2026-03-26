const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const upload = require("../middleware/upload");

const {
  sendMessage,
  getMessages,
} = require("../controllers/messageController");

const User = require("../models/User");

/*
==========================================================================
  Message Routes
  Base path : /api/messages
  Auth      : All routes require a valid JWT (authMiddleware)
==========================================================================
*/

// ─────────────────────────────────────────────────────────────────────────
// POST /api/messages
// Send a message — supports text, encrypted text, audio, image, and file.
// upload.mediaFields accepts:
//   • field "audio" — voice note (plain or encrypted blob)
//   • field "file"  — image or document (plain or encrypted blob)
// Both fields are optional; a plain text body needs no file at all.
// ─────────────────────────────────────────────────────────────────────────
router.post("/", authMiddleware, upload.mediaFields, sendMessage);

// ─────────────────────────────────────────────────────────────────────────
// GET /api/messages/:userId
// Fetch the full chat history between the current user and :userId,
// sorted oldest-first.
// ─────────────────────────────────────────────────────────────────────────
router.get("/:userId", authMiddleware, getMessages);

// ─────────────────────────────────────────────────────────────────────────
// GET /api/messages/:userId/public-key
// Return the RSA public key stored for :userId.
// The frontend needs this to encrypt the AES key before sending a message.
// ─────────────────────────────────────────────────────────────────────────
router.get("/:userId/public-key", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select("publicKey");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({ publicKey: user.publicKey || null });
  } catch (err) {
    console.error("[messageRoutes] public-key fetch error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
