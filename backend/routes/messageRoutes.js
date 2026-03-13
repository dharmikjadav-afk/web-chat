const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const {
  sendMessage,
  getMessages,
} = require("../controllers/messageController");
const User = require("../models/User");

// Send message
router.post("/", authMiddleware, sendMessage);

// Get chat history
router.get("/:userId", authMiddleware, getMessages);

// Get user's public key for encryption
router.get("/:userId/public-key", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select("publicKey");
    res.json({ publicKey: user?.publicKey || null });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
