import { useState } from "react";
import axios from "axios";
import socket from "../../socket/socket";
import { encryptMessage } from "../../crypto/crypto";

function MessageInput({ selectedUser, setMessages, currentUser }) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const sendMessage = async () => {
    if (!message.trim() || !selectedUser || sending) return;

    const trimmedMessage = message.trim();
    setMessage("");

    try {
      setSending(true);

      const token = localStorage.getItem("token");
      const receiverId = selectedUser._id || selectedUser.id;

      // Fetch receiver's public key
      const keyRes = await axios.get(
        `http://localhost:5000/api/users/${receiverId}/public-key`,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      const receiverPublicKey = keyRes.data.publicKey;

      // ✅ Also get sender's own public key for their own history
      const senderPublicKey = localStorage.getItem("publicKey");

      let messagePayload;

      if (receiverPublicKey) {
        // Encrypt for receiver
        const encryptedForReceiver = await encryptMessage(
          trimmedMessage,
          receiverPublicKey,
        );

        // ✅ Encrypt for sender too (so sender can read history)
        let encryptedForSender = null;
        if (senderPublicKey) {
          encryptedForSender = await encryptMessage(
            trimmedMessage,
            senderPublicKey,
          );
        }

        messagePayload = {
          receiver: receiverId,
          text: "",
          // For receiver
          encryptedMessage: encryptedForReceiver.encryptedMessage,
          encryptedAesKey: encryptedForReceiver.encryptedAesKey,
          iv: encryptedForReceiver.iv,
          // ✅ For sender
          senderEncryptedMessage: encryptedForSender?.encryptedMessage || null,
          senderEncryptedAesKey: encryptedForSender?.encryptedAesKey || null,
          senderIv: encryptedForSender?.iv || null,
          isEncrypted: true,
        };
      } else {
        messagePayload = {
          receiver: receiverId,
          text: trimmedMessage,
          isEncrypted: false,
        };
      }

      const res = await axios.post(
        "http://localhost:5000/api/messages",
        messagePayload,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      const newMessage = res.data;

      // ✅ Sender always sees plain text immediately in UI
      const displayMessage = { ...newMessage, text: trimmedMessage };

      setMessages((prev) => {
        if (prev.some((msg) => msg._id === newMessage._id)) return prev;
        return [...prev, displayMessage];
      });

      // Emit to receiver via socket
      socket.emit("send_message", {
        ...newMessage,
        text: trimmedMessage, // socket copy for sender's live view
      });
    } catch (error) {
      console.error("Send message error:", error);
      setMessage(trimmedMessage);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="p-4 border-t border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center gap-3">
      <input
        type="text"
        placeholder="Type a message..."
        className="flex-1 p-3 rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 text-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 transition"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={!selectedUser || sending}
        autoFocus
      />
      <button
        onClick={sendMessage}
        disabled={!message.trim() || sending || !selectedUser}
        className="px-5 py-3 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white rounded-lg disabled:opacity-50 transition font-medium"
      >
        {sending ? "..." : "Send"}
      </button>
    </div>
  );
}

export default MessageInput;
