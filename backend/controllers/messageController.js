const Message = require("../models/Message");

/*
Send Message
POST /api/messages
*/
exports.sendMessage = async (req, res) => {
  try {
    const { receiver, text } = req.body;

    const sender = req.user.id;

    if (!receiver || !text) {
      return res.status(400).json({
        message: "Receiver and message text are required",
      });
    }

    const message = await Message.create({
      sender,
      receiver,
      text,
    });

    res.status(201).json(message);
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
