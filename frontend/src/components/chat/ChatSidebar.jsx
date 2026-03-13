import { useEffect, useState } from "react";
import axios from "axios";
import { decryptMessage } from "../../crypto/crypto";

function ChatSidebar({ setSelectedUser, setMessages, onlineUsers }) {
  const [users, setUsers] = useState([]);

  const currentUser =
    localStorage.getItem("userId") ||
    JSON.parse(localStorage.getItem("user") || "{}")?.id;

  useEffect(() => {
    const fetchUsers = async () => {
      const token = localStorage.getItem("token");
      const res = await axios.get("http://localhost:5000/api/users", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsers(res.data);
    };
    fetchUsers();
  }, []);

  const openChat = async (user) => {
    const token = localStorage.getItem("token");
    const res = await axios.get(
      `http://localhost:5000/api/messages/${user._id || user.id}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    const privateKey = localStorage.getItem("privateKey");

    const decryptedMessages = await Promise.all(
      res.data.map(async (msg) => {
        const senderId = String(
          msg.sender?._id || msg.sender?.id || msg.sender || "",
        );
        const receiverId = String(
          msg.receiver?._id || msg.receiver?.id || msg.receiver || "",
        );

        // ✅ If I am the SENDER — show plain text (already stored as "")
        // We can't decrypt sender's own encrypted messages (encrypted for receiver)
        // So show a placeholder or skip
        if (senderId === String(currentUser)) {
          // Sender can't decrypt their own encrypted message
          // because it was encrypted with RECEIVER's public key
          if (msg.isEncrypted) {
            return { ...msg, text: msg.text || "📤 Sent (encrypted)" };
          }
          return msg;
        }

        // ✅ If I am the RECEIVER — decrypt
        if (
          msg.isEncrypted &&
          receiverId === String(currentUser) &&
          privateKey &&
          msg.encryptedMessage
        ) {
          try {
            const decrypted = await decryptMessage(
              {
                encryptedMessage: msg.encryptedMessage,
                encryptedAesKey: msg.encryptedAesKey,
                iv: msg.iv,
              },
              privateKey,
            );
            return { ...msg, text: decrypted };
          } catch {
            return { ...msg, text: "🔒 Encrypted message" };
          }
        }

        return msg;
      }),
    );

    setSelectedUser(user);
    setMessages(decryptedMessages);
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-800">
      <div className="p-4 border-b border-gray-200 dark:border-slate-700">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
          Chats
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        {users.map((user) => {
          const userId = user._id || user.id;
          const isOnline = onlineUsers.includes(String(userId));

          return (
            <div
              key={userId}
              onClick={() => openChat(user)}
              className="p-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700 border-b border-gray-100 dark:border-slate-700 flex items-center gap-3"
            >
              <div className="relative shrink-0">
                <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-white font-bold text-sm">
                  {user.name?.charAt(0).toUpperCase()}
                </div>
                {isOnline && (
                  <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 border-2 border-white dark:border-slate-800 rounded-full" />
                )}
              </div>

              <div className="min-w-0">
                <div className="font-medium text-gray-800 dark:text-white text-sm truncate">
                  {user.name}
                </div>
                <div className="text-xs truncate">
                  {isOnline ? (
                    <span className="text-green-400 font-medium">Online</span>
                  ) : (
                    <span className="text-gray-500 dark:text-slate-400">
                      {user.email}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ChatSidebar;
