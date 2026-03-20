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

  // 🧠 FINAL CLEAN SAFE DECRYPT FUNCTION
  const tryDecrypt = async (msg, privateKey) => {
    // 🚫 Skip unnecessary cases (VERY IMPORTANT)
    if (
      msg.messageType === "audio" ||
      !msg.isEncrypted ||
      !msg.encryptedMessage ||
      !msg.iv ||
      !privateKey
    ) {
      return msg.text || "";
    }

    const keysToTry = [
      msg.encryptedAesKeySender,
      msg.encryptedAesKeyReceiver,
      msg.encryptedAesKey,
    ].filter(Boolean);

    for (let key of keysToTry) {
      try {
        const decrypted = await decryptMessage(
          {
            encryptedMessage: msg.encryptedMessage,
            encryptedAesKey: key,
            iv: msg.iv,
          },
          privateKey
        );

        if (decrypted && decrypted !== "🔒 Encrypted message") {
          return decrypted;
        }
      } catch (err) {
        // ❌ Ignore silently (expected behavior)
      }
    }

    return "🔒 Encrypted message";
  };

  // ─────────────────────────────────────────────
  // Decrypt messages from API
  // ─────────────────────────────────────────────
  const setMessagesSafe = useCallback(
    async (msgs) => {
      const privateKey = localStorage.getItem("privateKey");

      if (!Array.isArray(msgs)) {
        setMessages(msgs);
        return;
      }

      const decryptedMessages = await Promise.all(
        msgs.map(async (msg) => {
          const decryptedText = await tryDecrypt(msg, privateKey);
          return { ...msg, text: decryptedText };
        })
      );

      setMessages(decryptedMessages);
    },
    [currentUser]
  );

  // ─────────────────────────────────────────────
  // Online users
  // ─────────────────────────────────────────────
  useEffect(() => {
    socket.on("online_users", (users) => {
      setOnlineUsers(users);
    });

    if (currentUser) {
      socket.emit("join", currentUser);
    }

    return () => socket.off("online_users");
  }, [currentUser]);

  // ─────────────────────────────────────────────
  // Reconnect
  // ─────────────────────────────────────────────
  useEffect(() => {
    const handleConnect = () => {
      if (currentUser) socket.emit("join", currentUser);
    };

    socket.on("connect", handleConnect);

    return () => socket.off("connect", handleConnect);
  }, [currentUser]);

  // ─────────────────────────────────────────────
  // Receive messages
  // ─────────────────────────────────────────────
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

      const privateKey = localStorage.getItem("privateKey");

      const decryptedText = await tryDecrypt(message, privateKey);

      const displayMessage = {
        ...message,
        text: decryptedText,
      };

      setMessages((prev) => {
        if (prev.some((msg) => msg._id === displayMessage._id)) return prev;
        return [...prev, displayMessage];
      });
    },
    [selectedUser, currentUser]
  );

  useEffect(() => {
    socket.on("receive_message", handleReceiveMessage);
    return () => socket.off("receive_message", handleReceiveMessage);
  }, [handleReceiveMessage]);

  // ─────────────────────────────────────────────
  // Select user
  // ─────────────────────────────────────────────
  const handleSelectUser = (user) => {
    setSelectedUser(user);
    setMessages([]);
  };

  return (
    <div className="h-screen flex bg-gray-100 dark:bg-slate-900">
      <div className="w-80 border-r border-gray-200 dark:border-slate-700">
        <ChatSidebar
          setSelectedUser={handleSelectUser}
          setMessages={setMessagesSafe}
          onlineUsers={onlineUsers}
        />
      </div>

      <div className="flex-1">
        <ChatWindow
          selectedUser={selectedUser}
          messages={messages}
          setMessages={setMessagesSafe}
          currentUser={currentUser}
          onlineUsers={onlineUsers}
        />
      </div>
    </div>
  );
}

export default Chat;