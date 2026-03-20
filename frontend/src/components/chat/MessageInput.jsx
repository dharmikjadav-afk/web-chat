import { useState, useRef } from "react";
import axios from "axios";
import socket from "../../socket/socket";
import { encryptMessage } from "../../crypto/crypto";

function MessageInput({ selectedUser, setMessages, currentUser }) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  // 🎤 Voice states
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // ─────────────────────────────────────────────
  // TEXT MESSAGE (UNCHANGED)
  // ─────────────────────────────────────────────
  const sendMessage = async () => {
    if (!message.trim() || !selectedUser || sending) return;

    const trimmedMessage = message.trim();
    setMessage("");

    try {
      setSending(true);

      const token = localStorage.getItem("token");
      const receiverId = selectedUser._id || selectedUser.id;

      const keyRes = await axios.get(
        `http://localhost:5000/api/users/${receiverId}/public-key`,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      const receiverPublicKey = keyRes.data.publicKey;
      const senderPublicKey = localStorage.getItem("publicKey");

      let messagePayload;

      if (receiverPublicKey && senderPublicKey) {
        const encrypted = await encryptMessage(
          trimmedMessage,
          receiverPublicKey,
          senderPublicKey,
        );

        messagePayload = {
          receiver: receiverId,
          text: "",
          encryptedMessage: encrypted.encryptedMessage,
          encryptedAesKeyReceiver: encrypted.encryptedAesKeyReceiver,
          encryptedAesKeySender: encrypted.encryptedAesKeySender,
          iv: encrypted.iv,
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

      const displayMessage = { ...newMessage, text: trimmedMessage };

      setMessages((prev) => {
        if (prev.some((msg) => msg._id === newMessage._id)) return prev;
        return [...prev, displayMessage];
      });

      socket.emit("send_message", {
        ...newMessage,
        text: trimmedMessage,
      });
    } catch (error) {
      console.error("Send message error:", error);
      setMessage(trimmedMessage);
    } finally {
      setSending(false);
    }
  };

  // ─────────────────────────────────────────────
  // 🎤 START RECORDING
  // ─────────────────────────────────────────────
  const startRecording = async () => {
    if (!selectedUser || sending) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Recording error:", error);
    }
  };

  // ─────────────────────────────────────────────
  // 🎤 STOP & SEND AUDIO
  // ─────────────────────────────────────────────
  const stopRecording = async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;

    recorder.stop();

    recorder.onstop = async () => {
      const audioBlob = new Blob(audioChunksRef.current, {
        type: "audio/webm",
      });

      const formData = new FormData();
      formData.append("audio", audioBlob);

      const token = localStorage.getItem("token");
      const receiverId = selectedUser._id || selectedUser.id;
      formData.append("receiver", receiverId);

      try {
        const res = await axios.post(
          "http://localhost:5000/api/messages",
          formData,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "multipart/form-data",
            },
          },
        );

        const newMessage = res.data;

        setMessages((prev) => {
          if (prev.some((msg) => msg._id === newMessage._id)) return prev;
          return [...prev, newMessage];
        });

        socket.emit("send_message", newMessage);
      } catch (error) {
        console.error("Audio send error:", error);
      }
    };

    setIsRecording(false);
  };

  // ─────────────────────────────────────────────
  // ENTER KEY
  // ─────────────────────────────────────────────
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
        disabled={!selectedUser || sending || isRecording}
        autoFocus
      />

      {/* 🎤 Mic Button */}
      {!isRecording ? (
        <button
          onClick={startRecording}
          disabled={!selectedUser || sending}
          className="px-3 py-3 bg-gray-200 dark:bg-slate-700 rounded-lg"
        >
          🎤
        </button>
      ) : (
        <button
          onClick={stopRecording}
          className="px-3 py-3 bg-red-500 text-white rounded-lg animate-pulse"
        >
          ⏹
        </button>
      )}

      {/* Send Button */}
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
