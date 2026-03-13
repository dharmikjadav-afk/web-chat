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
    },

    encryptedMessage: { type: String, default: null }, // ✅
    encryptedAesKey: { type: String, default: null }, // ✅
    iv: { type: String, default: null }, // ✅
    isEncrypted: { type: Boolean, default: false },

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

messageSchema.index({ sender: 1, receiver: 1 });

module.exports = mongoose.model("Message", messageSchema);
