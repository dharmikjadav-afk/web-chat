const { Server } = require("socket.io");

// Map to track userId -> socketId
const onlineUsers = {};

function initSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: "http://localhost:5173",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);

    /*
    ===============================
    User joins with their userId
    ===============================
    */
    socket.on("join", (userId) => {
      onlineUsers[userId] = socket.id;

      // ✅ Broadcast updated online list to ALL users
      io.emit("online_users", Object.keys(onlineUsers));

      console.log("Online users:", Object.keys(onlineUsers));
    });

    /*
    ===============================
    Handle sending messages
    ONLY emit to receiver — sender
    already updates their own UI
    ===============================
    */
    socket.on("send_message", (message) => {
      const receiverId =
        message.receiver?._id || message.receiver?.id || message.receiver;
      const receiverSocketId = onlineUsers[receiverId];

      if (receiverSocketId) {
        // Send ONLY to receiver's socket
        io.to(receiverSocketId).emit("receive_message", message);
        console.log(`Message sent to receiver: ${receiverId}`);
      } else {
        console.log(`Receiver ${receiverId} is offline`);
      }
    });

    /*
    ===============================
    Handle disconnect
    ===============================
    */
    socket.on("disconnect", () => {
      // Remove user from onlineUsers map
      for (const [userId, socketId] of Object.entries(onlineUsers)) {
        if (socketId === socket.id) {
          delete onlineUsers[userId];
          io.emit("online_users", Object.keys(onlineUsers));
          console.log(`User ${userId} disconnected`);
          break;
        }
      }
    });
  });

  return io;
}

module.exports = { initSocket };
