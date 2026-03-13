const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware"); // ✅ same import style

const {
  register,
  login,
  forgotPassword,
  resetPassword,
  savePublicKey,
} = require("../controllers/authController");

router.post("/register", register);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);
router.post("/save-public-key", authMiddleware, savePublicKey); // ✅

module.exports = router;
