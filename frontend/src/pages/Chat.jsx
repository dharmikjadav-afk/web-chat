import { useState, useEffect, useCallback } from "react";
import ChatSidebar from "../components/chat/ChatSidebar";
import ChatWindow from "../components/chat/ChatWindow";
import socket from "../socket/socket";
import { decryptMessage } from "../crypto/crypto";

function Chat() {
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);

  const currentUser = JSON.parse(localStorage.getItem("user"))?.id;

  // ✅ Listen for online users BEFORE joining
  useEffect(() => {
    socket.on("online_users", (users) => {
      setOnlineUsers(users);
    });

    if (currentUser) {
      socket.emit("join", currentUser);
    }

    return () => socket.off("online_users");
  }, [currentUser]);

  // ✅ Rejoin on reconnect
  useEffect(() => {
    const handleConnect = () => {
      if (currentUser) socket.emit("join", currentUser);
    };
    socket.on("connect", handleConnect);
    return () => socket.off("connect", handleConnect);
  }, [currentUser]);

  // ✅ Receive + decrypt messages
  const handleReceiveMessage = useCallback(
    async (message) => {
      const senderId =
        message.sender?._id || message.sender?.id || message.sender;
      const receiverId =
        message.receiver?._id || message.receiver?.id || message.receiver;

      const isRelevant =
        selectedUser &&
        (senderId === selectedUser._id ||
          senderId === selectedUser.id ||
          receiverId === selectedUser._id ||
          receiverId === selectedUser.id ||
          senderId === currentUser ||
          receiverId === currentUser);

      if (!isRelevant) return;

      let displayMessage = { ...message };

      // ✅ Decrypt only if receiver and message is encrypted
      if (message.isEncrypted && receiverId === currentUser) {
        const privateKey = localStorage.getItem("privateKey");
        if (privateKey && message.encryptedMessage) {
          try {
            const decrypted = await decryptMessage(
              {
                encryptedMessage: message.encryptedMessage,
                encryptedAesKey: message.encryptedAesKey,
                iv: message.iv,
              },
              privateKey,
            );
            displayMessage = { ...message, text: decrypted };
            console.log("Message decrypted ✅");
          } catch (err) {
            console.error("Decrypt error:", err);
            displayMessage = { ...message, text: "🔒 Encrypted message" };
          }
        }
      }

      setMessages((prev) => {
        if (prev.some((msg) => msg._id === displayMessage._id)) return prev;
        return [...prev, displayMessage];
      });
    },
    [selectedUser, currentUser],
  );

  useEffect(() => {
    socket.on("receive_message", handleReceiveMessage);
    return () => socket.off("receive_message", handleReceiveMessage);
  }, [handleReceiveMessage]);

  const handleSelectUser = (user) => {
    setSelectedUser(user);
    setMessages([]);
  };

  return (
    <div className="h-screen flex bg-gray-100 dark:bg-slate-900">
      <div className="w-80 border-r border-gray-200 dark:border-slate-700">
        <ChatSidebar
          setSelectedUser={handleSelectUser}
          setMessages={setMessages}
          onlineUsers={onlineUsers}
        />
      </div>
      <div className="flex-1">
        <ChatWindow
          selectedUser={selectedUser}
          messages={messages}
          setMessages={setMessages}
          currentUser={currentUser}
          onlineUsers={onlineUsers}
        />
      </div>
    </div>
  );
}

export default Chat;
