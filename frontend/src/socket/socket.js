import { io } from "socket.io-client";

const socket = io("http://localhost:5000", {
  autoConnect: true, // connect immediately
  reconnection: true, // auto reconnect if dropped
  reconnectionAttempts: 5, // try 5 times
  reconnectionDelay: 1000, // wait 1s between attempts
  transports: ["websocket"], // skip long-polling, use WS directly (faster)
});

socket.on("connect", () => {
  console.log("Socket connected:", socket.id);
});

socket.on("disconnect", (reason) => {
  console.log("Socket disconnected:", reason);
});

socket.on("connect_error", (err) => {
  console.error("Socket connection error:", err.message);
});

export default socket;
