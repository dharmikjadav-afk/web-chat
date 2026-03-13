const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const User = require("../models/User");
const { getUsers } = require("../controllers/userController");

// Get all users
router.get("/", authMiddleware, getUsers);

// ✅ Get a user's public key (needed for encryption)
router.get("/:userId/public-key", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select("publicKey");
    res.json({ publicKey: user?.publicKey || null });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;