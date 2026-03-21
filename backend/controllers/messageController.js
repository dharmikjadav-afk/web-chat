const Message = require("../models/Message");
const cloudinary = require("../config/cloudinary");

/*
Send Message
POST /api/messages
*/
exports.sendMessage = async (req, res) => {
  try {
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

    const sender = req.user.id;

    // ✅ Receiver required
    if (!receiver) {
      return res.status(400).json({
        message: "Receiver is required",
      });
    }

    let audioUrl = null;
    let messageType = "text";

    // 🎤 Handle audio upload
    if (req.file) {
      try {
        // 🔐 Encrypted blobs are raw binary (application/octet-stream) —
        // Cloudinary rejects them with resource_type "video".
        // Use resource_type "raw" for encrypted, "video" for plain audio.
        const isEncryptedUpload = isEncrypted === "true" || isEncrypted === true;

        const result = await cloudinary.uploader.upload(req.file.path, {
          resource_type: isEncryptedUpload ? "raw" : "video",
        });

        audioUrl = result.secure_url;
        messageType = "audio";
      } catch (uploadError) {
        console.error("Cloudinary Upload Error:", uploadError);
        return res.status(500).json({
          message: "Audio upload failed",
        });
      }
    }

    // ✅ Plain text validation
    if (!req.file && !isEncrypted && !text) {
      return res.status(400).json({
        message: "Message text is required",
      });
    }

    // 🔐 Encrypted validation (only for text messages)
    if (isEncrypted && messageType === "text") {
      if (!encryptedMessage || !iv) {
        return res.status(400).json({
          message: "Invalid encrypted message payload",
        });
      }

      if (
        !encryptedAesKey &&
        !encryptedAesKeyReceiver &&
        !encryptedAesKeySender
      ) {
        return res.status(400).json({
          message: "Missing encryption keys",
        });
      }
    }

    // 🔐 Encrypted validation for audio messages
    // FormData sends booleans as strings, so we check both "true" and true
    const isEncryptedBool = isEncrypted === "true" || isEncrypted === true;

    if (isEncryptedBool && messageType === "audio") {
      if (!iv) {
        return res.status(400).json({
          message: "Missing IV for encrypted audio",
        });
      }

      if (
        !encryptedAesKey &&
        !encryptedAesKeyReceiver &&
        !encryptedAesKeySender
      ) {
        return res.status(400).json({
          message: "Missing encryption keys for audio",
        });
      }
    }

    // ✅ Normalize AES key (fallback)
    const finalAesKey =
      encryptedAesKey ||
      encryptedAesKeyReceiver ||
      encryptedAesKeySender ||
      null;

    // ✅ Create message
    const message = await Message.create({
      sender,
      receiver,

      // TEXT (empty if encrypted OR audio)
      text: isEncryptedBool || messageType === "audio" ? "" : text,

      // AUDIO
      audio: audioUrl,

      // TYPE
      messageType,

      // ENCRYPTION
      encryptedMessage: encryptedMessage || null,
      encryptedAesKeyReceiver: encryptedAesKeyReceiver || null,
      encryptedAesKeySender: encryptedAesKeySender || null,
      encryptedAesKey: finalAesKey,
      iv: iv || null,
      isEncrypted: isEncryptedBool,
    });

    // ✅ Populate sender info
    const populated = await message.populate("sender", "name email");

    res.status(201).json(populated);
  } catch (error) {
    console.error("Send Message Error:", error);

    res.status(500).json({
      message: "Server error while sending message",
    });
  }
};

/*
Get Chat History
GET /api/messages/:userId
*/
exports.getMessages = async (req, res) => {
  try {
    const currentUser = req.user.id;
    const otherUser = req.params.userId;

    // ✅ Validate userId
    if (!otherUser) {
      return res.status(400).json({
        message: "User ID is required",
      });
    }

    const messages = await Message.find({
      $or: [
        { sender: currentUser, receiver: otherUser },
        { sender: otherUser, receiver: currentUser },
      ],
    })
      .sort({ createdAt: 1 })
      .populate("sender", "name email")
      .populate("receiver", "name email");

    res.status(200).json(messages);
  } catch (error) {
    console.error("Get Messages Error:", error);

    res.status(500).json({
      message: "Server error while fetching messages",
    });
  }
};