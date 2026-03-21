const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    text: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },

    // ─────────────────────────────────────────────
    // 🆕 Media fields (SAFE ADDITION)
    // ─────────────────────────────────────────────

    audio: {
      type: String, // Cloudinary URL
      default: null,
    },

    file: {
      type: String, // for future (file/image support)
      default: null,
    },

    // ─────────────────────────────────────────────
    // Encryption fields
    // ─────────────────────────────────────────────

    encryptedMessage: {
      type: String,
      default: null,
    },

    // AES key for receiver
    encryptedAesKeyReceiver: {
      type: String,
      default: null,
    },

    // AES key for sender
    encryptedAesKeySender: {
      type: String,
      default: null,
    },

    // Backward compatibility (OLD messages)
    encryptedAesKey: {
      type: String,
      default: null,
    },

    iv: {
      type: String,
      default: null,
    },

    isEncrypted: {
      type: Boolean,
      default: false,
      index: true,
    },

    // ─────────────────────────────────────────────
    // Message metadata
    // ─────────────────────────────────────────────

    messageType: {
      type: String,
      enum: ["text", "image", "file", "audio"],
      default: "text",
    },

    status: {
      type: String,
      enum: ["sent", "delivered", "seen"],
      default: "sent",
    },
  },
  {
    timestamps: true,
  },
);

// ─────────────────────────────────────────────
// Indexing (performance boost)
// ─────────────────────────────────────────────
messageSchema.index({ sender: 1, receiver: 1 });
messageSchema.index({ receiver: 1, createdAt: -1 });

// ─────────────────────────────────────────────
// Validation hook
// Using async style (no next callback) — compatible with Mongoose v7+
// ─────────────────────────────────────────────
messageSchema.pre("save", async function () {
  // 🔐 Encryption validation — only for text messages.
  // Encrypted audio messages store keys + iv but NOT encryptedMessage,
  // so we skip this check when messageType is "audio".
  if (this.isEncrypted && this.messageType !== "audio") {
    if (!this.encryptedMessage || !this.iv) {
      throw new Error("Encrypted message missing required fields");
    }
  }

  // 🎤 Audio validation
  if (this.messageType === "audio") {
    if (!this.audio) {
      throw new Error("Audio message missing audio URL");
    }
  }
});

module.exports = mongoose.model("Message", messageSchema);
