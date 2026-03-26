const mongoose = require("mongoose");

/*
==========================================================================
  Message Model
  Supports : plain text · encrypted text · audio · image · file/document
  E2EE     : RSA-OAEP key exchange + AES-GCM message encryption
  Media    : Cloudinary URLs (ciphertext stored for encrypted media)
==========================================================================
*/

const messageSchema = new mongoose.Schema(
  {
    // ─────────────────────────────────────────────────────────────────────
    // Participants
    // ─────────────────────────────────────────────────────────────────────

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

    // ─────────────────────────────────────────────────────────────────────
    // Content — only ONE of these will be populated per message
    // ─────────────────────────────────────────────────────────────────────

    text: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },

    // Cloudinary URL — plain audio or encrypted audio ciphertext
    audio: {
      type: String,
      default: null,
    },

    // Cloudinary URL — plain image or encrypted image ciphertext
    image: {
      type: String,
      default: null,
    },

    // Cloudinary URL — plain document/file or encrypted file ciphertext
    file: {
      type: String,
      default: null,
    },

    // Original filename shown in the UI (e.g. "report_q3.pdf")
    fileName: {
      type: String,
      trim: true,
      default: null,
    },

    // File size in bytes — shown in the UI alongside the file card
    fileSize: {
      type: Number,
      min: 0,
      default: null,
    },

    // ─────────────────────────────────────────────────────────────────────
    // End-to-End Encryption fields
    // Hybrid scheme: AES-GCM encrypts the payload, RSA-OAEP wraps the key.
    // Two wrapped copies of the AES key are stored so BOTH sender and
    // receiver can independently decrypt the message / media.
    // ─────────────────────────────────────────────────────────────────────

    // AES-GCM ciphertext of the text payload (base64)
    encryptedMessage: {
      type: String,
      default: null,
    },

    // AES key wrapped with the RECEIVER's RSA public key (base64)
    encryptedAesKeyReceiver: {
      type: String,
      default: null,
    },

    // AES key wrapped with the SENDER's RSA public key (base64)
    // Allows the sender to re-read their own sent messages
    encryptedAesKeySender: {
      type: String,
      default: null,
    },

    // Legacy fallback — single wrapped AES key from before dual-key support.
    // Kept for backward compatibility with messages sent before this version.
    encryptedAesKey: {
      type: String,
      default: null,
    },

    // AES-GCM initialisation vector (base64, 12 bytes)
    iv: {
      type: String,
      default: null,
    },

    isEncrypted: {
      type: Boolean,
      default: false,
      index: true,
    },

    // ─────────────────────────────────────────────────────────────────────
    // Metadata
    // ─────────────────────────────────────────────────────────────────────

    messageType: {
      type: String,
      enum: ["text", "audio", "image", "file"],
      default: "text",
    },

    // Delivery / read receipt status
    status: {
      type: String,
      enum: ["sent", "delivered", "seen"],
      default: "sent",
    },
  },
  {
    timestamps: true, // createdAt, updatedAt
  },
);

// ─────────────────────────────────────────────────────────────────────────
// Compound indexes — optimise the two most common query patterns:
//   1. Fetch conversation between two users (ChatWindow load)
//   2. Recent messages for a user (sidebar last-message preview)
// ─────────────────────────────────────────────────────────────────────────
messageSchema.index({ sender: 1, receiver: 1 });
messageSchema.index({ receiver: 1, createdAt: -1 });

// ─────────────────────────────────────────────────────────────────────────
// Pre-save validation
// Mongoose v7+ async hook — no `next` callback needed.
// Runs before every Message.create() and message.save() call.
// ─────────────────────────────────────────────────────────────────────────
messageSchema.pre("save", async function () {
  // ── Encrypted TEXT must carry both ciphertext and IV ──────────────────
  // Audio / image / file messages store the ciphertext on Cloudinary,
  // so encryptedMessage is intentionally absent for those types.
  if (this.isEncrypted && this.messageType === "text") {
    if (!this.encryptedMessage || !this.iv) {
      throw new Error(
        "Encrypted text message is missing encryptedMessage or iv",
      );
    }
  }

  // ── Encrypted media must carry IV + at least one wrapped AES key ──────
  if (this.isEncrypted && this.messageType !== "text") {
    if (!this.iv) {
      throw new Error(`Encrypted ${this.messageType} message is missing iv`);
    }

    const hasKey =
      this.encryptedAesKeyReceiver ||
      this.encryptedAesKeySender ||
      this.encryptedAesKey;

    if (!hasKey) {
      throw new Error(
        `Encrypted ${this.messageType} message is missing all AES key fields`,
      );
    }
  }

  // ── Each media type must have its corresponding URL ───────────────────
  if (this.messageType === "audio" && !this.audio) {
    throw new Error("Audio message is missing audio URL");
  }

  if (this.messageType === "image" && !this.image) {
    throw new Error("Image message is missing image URL");
  }

  if (this.messageType === "file" && !this.file) {
    throw new Error("File message is missing file URL");
  }
});

module.exports = mongoose.model("Message", messageSchema);
