const Message = require("../models/Message");
const cloudinary = require("../config/cloudinary"); // make sure this exists

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

    // 🎤 Handle audio file (NEW)
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        resource_type: "video", // IMPORTANT for audio
      });

      audioUrl = result.secure_url;
      messageType = "audio";
    }

    // ✅ Plain message validation (only if NOT audio & NOT encrypted)
    if (!req.file && !isEncrypted && !text) {
      return res.status(400).json({
        message: "Message text is required",
      });
    }

    // 🔐 Validate encrypted message
    if (isEncrypted) {
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

    // ✅ Normalize AES key (fallback support)
    const finalAesKey =
      encryptedAesKey ||
      encryptedAesKeyReceiver ||
      encryptedAesKeySender ||
      null;

    // ✅ Create message safely
    const message = await Message.create({
      sender,
      receiver,

      // TEXT
      text: isEncrypted || req.file ? "" : text,

      // AUDIO
      audio: audioUrl,

      // MESSAGE TYPE
      messageType,

      // ENCRYPTION
      encryptedMessage: encryptedMessage || null,
      encryptedAesKeyReceiver: encryptedAesKeyReceiver || null,
      encryptedAesKeySender: encryptedAesKeySender || null,
      encryptedAesKey: finalAesKey,
      iv: iv || null,
      isEncrypted: isEncrypted || false,
    });

    // Populate sender info
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
