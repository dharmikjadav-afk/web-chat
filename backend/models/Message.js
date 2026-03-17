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
// Validation hook (important)
// ─────────────────────────────────────────────
messageSchema.pre("save", function (next) {
  if (this.isEncrypted) {
    // Ensure required encryption fields exist
    if (!this.encryptedMessage || !this.iv) {
      return next(new Error("Encrypted message missing required fields"));
    }
  }
});

module.exports = mongoose.model("Message", messageSchema);
