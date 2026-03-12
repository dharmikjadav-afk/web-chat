const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
require("dotenv").config();

const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const connectDB = require("./config/db");

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const messageRoutes = require("./routes/messageRoutes");

const app = express();
const server = http.createServer(app);

/*
=================================
Database Connection
=================================
*/
connectDB();

/*
=================================
Security Middlewares
=================================
*/
app.use(helmet());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests from this IP, please try again later.",
});

app.use(limiter);

/*
=================================
Core Middlewares
=================================
*/
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true,
  }),
);

app.use(express.json());

/*
=================================
API Routes
=================================
*/
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/messages", messageRoutes);

/*
=================================
Socket.io Setup
=================================
*/
const io = new Server(server, {
  cors: {
    origin: CLIENT_URL,
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log("⚡ User connected:", socket.id);

  /*
  =============================
  User joins personal room
  =============================
  */
  socket.on("join", (userId) => {
    if (!userId) return;

    socket.join(userId);

    console.log(`👤 User ${userId} joined their room`);
  });

  /*
  =============================
  Send message realtime
  =============================
  */
  socket.on("send_message", (message) => {
    console.log("Message received from socket:", message);

    const receiverId = message.receiver?.toString();

    if (!receiverId) return;

    io.to(receiverId).emit("receive_message", message);
  });

  /*
  =============================
  Handle disconnect
  =============================
  */
  socket.on("disconnect", () => {
    console.log("❌ User disconnected:", socket.id);
  });
});

/*
=================================
Global Error Handler
=================================
*/
app.use((err, req, res, next) => {
  console.error("Server Error:", err);

  res.status(err.status || 500).json({
    message: err.message || "Internal Server Error",
  });
});

/*
=================================
Start Server
=================================
*/
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
