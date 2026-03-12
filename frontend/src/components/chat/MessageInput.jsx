import { useState } from "react";
import axios from "axios";
import socket from "../../socket/socket";

function MessageInput({ selectedUser, setMessages }) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const token = localStorage.getItem("token");

  const sendMessage = async () => {
    if (!message.trim() || !selectedUser || sending) return;

    try {
      setSending(true);

      const res = await axios.post(
        "http://localhost:5000/api/messages",
        {
          receiver: selectedUser._id,
          text: message.trim(),
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const newMessage = res.data;

      // update UI immediately
      setMessages((prev) => [...prev, newMessage]);

      // send realtime socket event
      socket.emit("send_message", {
        sender: localStorage.getItem("userId"),
        receiver: selectedUser._id,
        text: message,
      });
      setMessage("");
    } catch (error) {
      console.error("Send message error:", error);
    } finally {
      setSending(false);
    }
  };

  // Send message when pressing Enter
  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="p-4 border-t border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center">
      <input
        type="text"
        placeholder="Type a message..."
        className="flex-1 p-3 rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 text-gray-800 dark:text-white outline-none"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyPress}
        disabled={!selectedUser || sending}
      />

      <button
        onClick={sendMessage}
        disabled={!message.trim() || sending || !selectedUser}
        className="ml-3 px-5 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg disabled:opacity-50"
      >
        {sending ? "Sending..." : "Send"}
      </button>
    </div>
  );
}

export default MessageInput;
