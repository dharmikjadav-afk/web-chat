const mongoose = require("mongoose");
const Message   = require("../models/Message");
const cloudinary = require("../config/cloudinary");
const upload     = require("../middleware/upload");

/*
==========================================================================
  Message Controller
  POST /api/messages   — send text · audio · image · file (all E2EE-aware)
  GET  /api/messages/:userId — fetch conversation history
==========================================================================
*/

// ─────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────

/**
 * Normalise the isEncrypted flag.
 * FormData always sends booleans as strings, so we handle both forms.
 */
const toBool = (val) => val === true || val === "true";

/**
 * Upload a single local file to Cloudinary and delete the temp file.
 * @param {string} localPath   — absolute path from multer diskStorage
 * @param {string} resourceType — "video" | "image" | "raw"
 * @returns {Promise<string>}  — secure_url
 */
const uploadToCloudinary = async (localPath, resourceType) => {
  try {
    const result = await cloudinary.uploader.upload(localPath, {
      resource_type: resourceType,
    });
    return result.secure_url;
  } finally {
    // Always remove the temp file — even if Cloudinary throws
    upload.cleanupTempFile(localPath);
  }
};

/**
 * Validate that an encrypted payload contains the required fields.
 * Returns an error message string, or null if valid.
 */
const validateEncryptedPayload = ({ iv, encryptedAesKeyReceiver, encryptedAesKeySender, encryptedAesKey, encryptedMessage, messageType }) => {
  if (!iv) {
    return `Missing IV for encrypted ${messageType} message`;
  }

  const hasAesKey =
    encryptedAesKeyReceiver || encryptedAesKeySender || encryptedAesKey;

  if (!hasAesKey) {
    return `Missing AES key for encrypted ${messageType} message`;
  }

  if (messageType === "text" && !encryptedMessage) {
    return "Missing encryptedMessage for encrypted text message";
  }

  return null;
};

// ─────────────────────────────────────────────────────────────────────────
// POST /api/messages
// ─────────────────────────────────────────────────────────────────────────
exports.sendMessage = async (req, res) => {
  try {
    const sender = req.user.id;

    const {
      receiver,
      text,
      encryptedMessage,
      encryptedAesKey,
      encryptedAesKeyReceiver,
      encryptedAesKeySender,
      iv,
      isEncrypted,
    } = req.body;

    // ── 1. Basic guard ────────────────────────────────────────────────────
    if (!receiver) {
      return res.status(400).json({ message: "Receiver is required" });
    }

    if (!mongoose.Types.ObjectId.isValid(receiver)) {
      return res.status(400).json({ message: "Invalid receiver ID" });
    }

    const isEncryptedBool = toBool(isEncrypted);

    // ── 2. Resolve uploaded files from upload.fields() ────────────────────
    // req.files is { audio: [file], file: [file] } when using upload.fields()
    const audioFile = req.files?.audio?.[0] || null;
    const mediaFile = req.files?.file?.[0]  || null;

    // ── 3. Upload media and determine messageType ─────────────────────────
    let audioUrl    = null;
    let imageUrl    = null;
    let fileUrl     = null;
    let fileName    = null;
    let fileSize    = null;
    let messageType = "text";

    if (audioFile) {
      // Encrypted blobs are raw binary — Cloudinary can't process them as video
      const resourceType = isEncryptedBool ? "raw" : "video";
      audioUrl    = await uploadToCloudinary(audioFile.path, resourceType);
      messageType = "audio";
    } else if (mediaFile) {
      const isImage = mediaFile.mimetype.startsWith("image/");
      fileName = mediaFile.originalname;
      fileSize = mediaFile.size;

      if (isImage && !isEncryptedBool) {
        // Plain images: let Cloudinary optimise and transform them
        imageUrl    = await uploadToCloudinary(mediaFile.path, "image");
        messageType = "image";
      } else if (isImage && isEncryptedBool) {
        // Encrypted images: ciphertext bytes — must use "raw"
        imageUrl    = await uploadToCloudinary(mediaFile.path, "raw");
        messageType = "image";
      } else {
        // Documents and all other files always use "raw"
        fileUrl     = await uploadToCloudinary(mediaFile.path, "raw");
        messageType = "file";
      }
    }

    // ── 4. Payload validation ─────────────────────────────────────────────

    // Plain text must not be empty
    if (messageType === "text" && !isEncryptedBool) {
      if (!text || !text.trim()) {
        return res.status(400).json({ message: "Message text is required" });
      }
    }

    // Encrypted messages must carry all crypto fields
    if (isEncryptedBool) {
      const validationError = validateEncryptedPayload({
        iv,
        encryptedAesKeyReceiver,
        encryptedAesKeySender,
        encryptedAesKey,
        encryptedMessage,
        messageType,
      });

      if (validationError) {
        return res.status(400).json({ message: validationError });
      }
    }

    // ── 5. Normalise AES key (backward-compat fallback) ───────────────────
    // Prefer the per-user keys; fall back to the legacy single-key field
    // so messages from before the dual-key update still round-trip correctly.
    const finalAesKey =
      encryptedAesKey || encryptedAesKeyReceiver || encryptedAesKeySender || null;

    // ── 6. Persist ────────────────────────────────────────────────────────
    const message = await Message.create({
      sender,
      receiver,

      // Text is empty for all non-plain-text messages
      text: messageType === "text" && !isEncryptedBool ? (text || "").trim() : "",

      // Media URLs — only one will be set per message
      audio:    audioUrl,
      image:    imageUrl,
      file:     fileUrl,
      fileName: fileName,
      fileSize: fileSize,

      // Message classification
      messageType,

      // Encryption envelope
      encryptedMessage:        encryptedMessage        || null,
      encryptedAesKeyReceiver: encryptedAesKeyReceiver || null,
      encryptedAesKeySender:   encryptedAesKeySender   || null,
      encryptedAesKey:         finalAesKey,
      iv:                      iv                      || null,
      isEncrypted:             isEncryptedBool,
    });

    // ── 7. Populate and respond ───────────────────────────────────────────
    const populated = await message.populate("sender", "name email");
    return res.status(201).json(populated);

  } catch (error) {
    console.error("[messageController] sendMessage error:", error);

    // Mongoose validation errors (from Message pre-save hook) → 400
    if (error.name === "ValidationError") {
      return res.status(400).json({ message: error.message });
    }

    return res.status(500).json({ message: "Server error while sending message" });
  }
};

// ─────────────────────────────────────────────────────────────────────────
// GET /api/messages/:userId
// ─────────────────────────────────────────────────────────────────────────
exports.getMessages = async (req, res) => {
  try {
    const currentUser = req.user.id;
    const otherUser   = req.params.userId;

    if (!otherUser) {
      return res.status(400).json({ message: "User ID is required" });
    }

    if (!mongoose.Types.ObjectId.isValid(otherUser)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const messages = await Message.find({
      $or: [
        { sender: currentUser, receiver: otherUser },
        { sender: otherUser,   receiver: currentUser },
      ],
    })
      .sort({ createdAt: 1 })
      .populate("sender",   "name email")
      .populate("receiver", "name email")
      .lean(); // plain JS objects — faster when you don't need Mongoose methods

    return res.status(200).json(messages);

  } catch (error) {
    console.error("[messageController] getMessages error:", error);
    return res.status(500).json({ message: "Server error while fetching messages" });
  }
};