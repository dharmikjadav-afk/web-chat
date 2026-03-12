const User = require("../models/User");

exports.getUsers = async (req, res) => {
  try {
    const currentUserId = req.user.id;

    const users = await User.find({
      _id: { $ne: currentUserId },
    }).select("name email avatar");

    res.status(200).json(users);
  } catch (error) {
    console.error("Get Users Error:", error);
    res.status(500).json({
      message: "Server error while fetching users",
    });
  }
};
