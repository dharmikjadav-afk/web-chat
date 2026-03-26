import { useState, useRef, useEffect } from "react";
import axios from "axios";
import socket from "../../socket/socket";
import {
  encryptMessage,
  encryptAudioBlob,
  encryptImageBlob,
  encryptFileBlob,
} from "../../crypto/crypto";

/*
==========================================================================
  MessageInput
  Handles : plain text · encrypted text
            voice notes (recorded, encrypted before upload)
            images      (selected via Photos menu, encrypted before upload)
            files/docs  (selected via Document menu, encrypted before upload)
            camera      (captured live, encrypted before upload)
  All media is encrypted client-side before it ever leaves the browser.
==========================================================================
*/

const API = "http://localhost:5000";

const MAX_FILE_SIZE_MB = 25;
const MAX_FILE_SIZE_B  = MAX_FILE_SIZE_MB * 1024 * 1024;

// ─────────────────────────────────────────────────────────────────────────
// Helper — fetch receiver's public key
// ─────────────────────────────────────────────────────────────────────────
const fetchReceiverPublicKey = async (receiverId, token) => {
  const res = await axios.get(
    `${API}/api/users/${receiverId}/public-key`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return res.data.publicKey || null;
};

// ─────────────────────────────────────────────────────────────────────────
// Helper — append encryption fields to FormData
// ─────────────────────────────────────────────────────────────────────────
const appendEncryptionFields = (formData, { encryptedAesKeyReceiver, encryptedAesKeySender, iv }) => {
  formData.append("isEncrypted",             "true");
  formData.append("encryptedAesKeyReceiver", encryptedAesKeyReceiver);
  formData.append("encryptedAesKeySender",   encryptedAesKeySender);
  formData.append("iv",                      iv);
};

// ─────────────────────────────────────────────────────────────────────────
// Helper — deduplicate-safe message appender
// ─────────────────────────────────────────────────────────────────────────
const appendMessage = (prev, newMessage) =>
  prev.some((m) => m._id === newMessage._id) ? prev : [...prev, newMessage];

// ─────────────────────────────────────────────────────────────────────────
// WhatsApp-style attachment menu items config
// ─────────────────────────────────────────────────────────────────────────
const MENU_ITEMS = [
  {
    key:    "document",
    label:  "Document",
    emoji:  "📄",
    bg:     "bg-indigo-100 dark:bg-indigo-900/50",
    color:  "text-indigo-600 dark:text-indigo-300",
  },
  {
    key:    "photos",
    label:  "Photos & Videos",
    emoji:  "🖼️",
    bg:     "bg-pink-100 dark:bg-pink-900/50",
    color:  "text-pink-600 dark:text-pink-300",
  },
  {
    key:    "camera",
    label:  "Camera",
    emoji:  "📷",
    bg:     "bg-emerald-100 dark:bg-emerald-900/50",
    color:  "text-emerald-600 dark:text-emerald-300",
  },
];

// ─────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────
function MessageInput({ selectedUser, setMessages, currentUser }) {

  // ── Text ────────────────────────────────────────────────────────────────
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  // ── Voice ───────────────────────────────────────────────────────────────
  const [isRecording,    setIsRecording]    = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef   = useRef([]);

  // ── Attachment ──────────────────────────────────────────────────────────
  // { file: File, previewUrl: string|null, isImage: boolean }
  const [attachment,  setAttachment]  = useState(null);
  const [attachError, setAttachError] = useState("");

  // ── Attachment menu ─────────────────────────────────────────────────────
  const [menuOpen, setMenuOpen] = useState(false);

  // ── File input refs (one per accept type) ───────────────────────────────
  const photoInputRef    = useRef(null); // images + videos
  const documentInputRef = useRef(null); // PDFs, Office, txt, zip
  const cameraInputRef   = useRef(null); // live camera capture
  const menuRef          = useRef(null); // popup container (outside-click guard)

  // ─────────────────────────────────────────────────────────────────────────
  // Close attachment menu on outside click
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Menu item click → open the correct file input
  // ─────────────────────────────────────────────────────────────────────────
  const handleMenuItemClick = (key) => {
    setMenuOpen(false);
    if (key === "photos")   photoInputRef.current?.click();
    if (key === "document") documentInputRef.current?.click();
    if (key === "camera")   cameraInputRef.current?.click();
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Shared — get auth token + receiver ID
  // ─────────────────────────────────────────────────────────────────────────
  const getContext = () => ({
    token:      localStorage.getItem("token"),
    receiverId: selectedUser?._id || selectedUser?.id,
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEXT MESSAGE
  // ─────────────────────────────────────────────────────────────────────────
  const sendTextMessage = async () => {
    if (!message.trim() || !selectedUser || sending) return;

    const trimmedMessage = message.trim();
    setMessage("");

    try {
      setSending(true);

      const { token, receiverId } = getContext();
      const receiverPublicKey     = await fetchReceiverPublicKey(receiverId, token);
      const senderPublicKey       = localStorage.getItem("publicKey");

      let payload;

      if (receiverPublicKey && senderPublicKey) {
        const encrypted = await encryptMessage(
          trimmedMessage,
          receiverPublicKey,
          senderPublicKey,
        );
        payload = {
          receiver:                receiverId,
          text:                    "",
          encryptedMessage:        encrypted.encryptedMessage,
          encryptedAesKeyReceiver: encrypted.encryptedAesKeyReceiver,
          encryptedAesKeySender:   encrypted.encryptedAesKeySender,
          iv:                      encrypted.iv,
          isEncrypted:             true,
        };
      } else {
        payload = { receiver: receiverId, text: trimmedMessage, isEncrypted: false };
      }

      const res        = await axios.post(`${API}/api/messages`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const newMessage = res.data;
      const displayMessage = { ...newMessage, text: trimmedMessage };

      setMessages((prev) => appendMessage(prev, displayMessage));
      socket.emit("send_message", { ...newMessage, text: trimmedMessage });

    } catch (err) {
      console.error("[MessageInput] sendTextMessage error:", err);
      setMessage(trimmedMessage);
    } finally {
      setSending(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // VOICE — start recording
  // ─────────────────────────────────────────────────────────────────────────
  const startRecording = async () => {
    if (!selectedUser || sending || attachment) return;

    try {
      const stream   = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current   = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("[MessageInput] startRecording error:", err);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // VOICE — stop, encrypt, upload
  // ─────────────────────────────────────────────────────────────────────────
  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;

    recorder.onstop = async () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });

      try {
        setSending(true);

        const { token, receiverId } = getContext();
        const receiverPublicKey     = await fetchReceiverPublicKey(receiverId, token);
        const senderPublicKey       = localStorage.getItem("publicKey");

        const formData = new FormData();
        formData.append("receiver", receiverId);

        if (receiverPublicKey && senderPublicKey) {
          const result = await encryptAudioBlob(audioBlob, receiverPublicKey, senderPublicKey);
          formData.append("audio", result.encryptedBlob, "audio.enc");
          appendEncryptionFields(formData, result);
        } else {
          formData.append("audio",       audioBlob, "audio.webm");
          formData.append("isEncrypted", "false");
        }

        const res        = await axios.post(`${API}/api/messages`, formData, {
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" },
        });
        const newMessage = res.data;

        setMessages((prev) => appendMessage(prev, newMessage));
        socket.emit("send_message", newMessage);

      } catch (err) {
        console.error("[MessageInput] stopRecording send error:", err);
      } finally {
        setSending(false);
      }
    };

    recorder.stop();
    setIsRecording(false);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // FILE / IMAGE — validate and stage for preview
  // ─────────────────────────────────────────────────────────────────────────
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;

    setAttachError("");

    if (file.size > MAX_FILE_SIZE_B) {
      setAttachError(`File exceeds the ${MAX_FILE_SIZE_MB} MB limit.`);
      return;
    }

    const isImage    = file.type.startsWith("image/");
    const previewUrl = isImage ? URL.createObjectURL(file) : null;

    setAttachment({ file, previewUrl, isImage });
  };

  const clearAttachment = () => {
    if (attachment?.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
    setAttachment(null);
    setAttachError("");
  };

  // ─────────────────────────────────────────────────────────────────────────
  // FILE / IMAGE — encrypt and upload
  // ─────────────────────────────────────────────────────────────────────────
  const sendAttachment = async () => {
    if (!attachment || !selectedUser || sending) return;

    const { file, isImage } = attachment;

    try {
      setSending(true);

      const { token, receiverId } = getContext();
      const receiverPublicKey     = await fetchReceiverPublicKey(receiverId, token);
      const senderPublicKey       = localStorage.getItem("publicKey");

      const formData = new FormData();
      formData.append("receiver", receiverId);

      if (receiverPublicKey && senderPublicKey) {
        const encryptFn = isImage ? encryptImageBlob : encryptFileBlob;
        const result    = await encryptFn(file, receiverPublicKey, senderPublicKey);

        // Store original filename — bubble uses this for display + download naming
        formData.append("file", result.encryptedBlob, file.name + ".enc");
        appendEncryptionFields(formData, result);
      } else {
        formData.append("file",        file, file.name);
        formData.append("isEncrypted", "false");
      }

      const res        = await axios.post(`${API}/api/messages`, formData, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" },
      });
      const newMessage = res.data;

      setMessages((prev) => appendMessage(prev, newMessage));
      socket.emit("send_message", newMessage);
      clearAttachment();

    } catch (err) {
      console.error("[MessageInput] sendAttachment error:", err);
    } finally {
      setSending(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Enter key — text only
  // ─────────────────────────────────────────────────────────────────────────
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendTextMessage();
    }
  };

  const isAttachDisabled = !selectedUser || sending || isRecording || !!attachment;

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="border-t border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800">

      {/* ── Hidden file inputs ──────────────────────────────────────────── */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={handleFileSelect}
      />
      <input
        ref={documentInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip"
        className="hidden"
        onChange={handleFileSelect}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* ── Attachment preview strip ────────────────────────────────────── */}
      {attachment && (
        <div className="px-4 pt-3 flex items-center gap-3">
          {attachment.isImage ? (
            <img
              src={attachment.previewUrl}
              alt="preview"
              className="w-16 h-16 object-cover rounded-xl border border-gray-200 dark:border-slate-600 shrink-0"
            />
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-slate-700 rounded-xl text-sm text-gray-700 dark:text-white max-w-xs">
              <span className="text-base shrink-0">📄</span>
              <span className="truncate">{attachment.file.name}</span>
            </div>
          )}

          <button
            onClick={clearAttachment}
            disabled={sending}
            className="ml-auto text-gray-400 hover:text-red-400 transition text-lg leading-none shrink-0"
            aria-label="Remove attachment"
          >
            ✕
          </button>

          <button
            onClick={sendAttachment}
            disabled={sending}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white rounded-xl text-sm font-medium disabled:opacity-50 transition shrink-0"
          >
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
      )}

      {/* ── Validation error ────────────────────────────────────────────── */}
      {attachError && (
        <p className="px-4 pt-2 text-xs text-red-500">{attachError}</p>
      )}

      {/* ── Main input row ──────────────────────────────────────────────── */}
      <div className="p-4 flex items-center gap-3">

        {/* ── Attachment button + WhatsApp popup ──────────────────────── */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            disabled={isAttachDisabled}
            className={`p-3 rounded-xl transition
              ${menuOpen
                ? "bg-emerald-500 text-white"
                : "bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 text-gray-600 dark:text-gray-300"
              }
              disabled:opacity-40`}
            aria-label="Attach"
            title="Attach"
          >
            {/* Paperclip SVG — cleaner than emoji at small sizes */}
            <svg
              width="18" height="18" viewBox="0 0 24 24"
              fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            >
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66L9.41 17.41a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
          </button>

          {/* ── WhatsApp-style popup menu ──────────────────────────────── */}
          {menuOpen && (
            <div
              className="absolute bottom-14 left-0 z-30 flex flex-col gap-1
                bg-white dark:bg-slate-800
                border border-gray-100 dark:border-slate-700
                rounded-2xl shadow-xl overflow-hidden
                min-w-[190px] py-1"
            >
              {MENU_ITEMS.map((item) => (
                <button
                  key={item.key}
                  onClick={() => handleMenuItemClick(item.key)}
                  className="flex items-center gap-3 px-4 py-3
                    hover:bg-gray-50 dark:hover:bg-slate-700
                    transition text-left w-full"
                >
                  <span className={`w-9 h-9 rounded-full flex items-center justify-center text-lg shrink-0 ${item.bg}`}>
                    {item.emoji}
                  </span>
                  <span className={`text-sm font-medium ${item.color}`}>
                    {item.label}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Text input ──────────────────────────────────────────────── */}
        <input
          type="text"
          placeholder="Type a message…"
          className="flex-1 p-3 rounded-xl border border-gray-200 dark:border-slate-700
            bg-gray-50 dark:bg-slate-900 text-gray-800 dark:text-white
            outline-none focus:ring-2 focus:ring-emerald-500 transition"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={!selectedUser || sending || isRecording || !!attachment}
          autoFocus
        />

        {/* ── Mic / Stop ──────────────────────────────────────────────── */}
        {!isRecording ? (
          <button
            onClick={startRecording}
            disabled={!selectedUser || sending || !!attachment}
            className="p-3 bg-gray-200 dark:bg-slate-700 hover:bg-gray-300
              dark:hover:bg-slate-600 rounded-xl transition disabled:opacity-40
              text-gray-600 dark:text-gray-300"
            aria-label="Start recording"
            title="Record voice note"
          >
            <svg
              width="18" height="18" viewBox="0 0 24 24"
              fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            >
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8"  y1="23" x2="16" y2="23" />
            </svg>
          </button>
        ) : (
          <button
            onClick={stopRecording}
            className="p-3 bg-red-500 hover:bg-red-600 text-white rounded-xl
              animate-pulse transition"
            aria-label="Stop recording"
            title="Stop and send voice note"
          >
            <svg
              width="18" height="18" viewBox="0 0 24 24"
              fill="currentColor"
            >
              <rect x="4" y="4" width="16" height="16" rx="2" />
            </svg>
          </button>
        )}

        {/* ── Send ────────────────────────────────────────────────────── */}
        <button
          onClick={sendTextMessage}
          disabled={!message.trim() || sending || !selectedUser || !!attachment}
          className="px-5 py-3 bg-emerald-500 hover:bg-emerald-600 active:scale-95
            text-white rounded-xl disabled:opacity-50 transition font-medium"
        >
          {sending ? "…" : "Send"}
        </button>

      </div>
    </div>
  );
}

export default MessageInput;