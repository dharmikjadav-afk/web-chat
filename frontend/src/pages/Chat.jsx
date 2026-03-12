import { useState, useEffect, useCallback } from "react";
import ChatSidebar from "../components/chat/ChatSidebar";
import ChatWindow from "../components/chat/ChatWindow";
import socket from "../socket/socket";

function Chat() {
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);

  // Join socket room once on mount
  useEffect(() => {
    const userId = localStorage.getItem("userId");

    if (userId) {
      socket.emit("join", userId);
    }
  }, []);
  // Listen for incoming messages when selectedUser changes
  useEffect(() => {
    const handleReceiveMessage = (message) => {
      const senderId = message.sender?._id || message.sender;
      const receiverId = message.receiver?._id || message.receiver;

      if (
        selectedUser &&
        (senderId === selectedUser._id || receiverId === selectedUser._id)
      ) {
        setMessages((prev) => {
          // prevent duplicates
          if (prev.find((msg) => msg._id === message._id)) return prev;
          return [...prev, message];
        });
      }
    };

    socket.on("receive_message", handleReceiveMessage);

    return () => {
      socket.off("receive_message", handleReceiveMessage);
    };
  }, [selectedUser]);

  return (
    <div className="h-screen flex bg-gray-100 dark:bg-slate-900">
      <div className="w-80 border-r border-gray-200 dark:border-slate-700">
        <ChatSidebar
          setSelectedUser={setSelectedUser}
          setMessages={setMessages}
        />
      </div>
      <div className="flex-1">
        <ChatWindow
          selectedUser={selectedUser}
          messages={messages}
          setMessages={setMessages}
        />
      </div>
    </div>
  );
}

export default Chat;
