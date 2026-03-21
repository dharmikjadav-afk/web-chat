import { useState } from "react";
import { decryptAudioBlob } from "../../crypto/crypto";

function MessageBubble({ message, isOwn, currentUser }) {
  const [audioSrc, setAudioSrc] = useState(null);
  const [decrypting, setDecrypting] = useState(false);
  const [decryptError, setDecryptError] = useState(false);

  const time = message.createdAt
    ? new Date(message.createdAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  // ─────────────────────────────────────────────
  // 🔓 Decrypt audio on demand (tap to play)
  // ─────────────────────────────────────────────
  const handlePlayClick = async () => {
    if (audioSrc || decrypting) return; // already decrypted or in progress

    // Legacy unencrypted audio — play directly without decryption
    if (!message.isEncrypted) {
      setAudioSrc(message.audio);
      return;
    }

    try {
      setDecrypting(true);
      const privateKey = localStorage.getItem("privateKey");
      const userId = currentUser?._id || currentUser?.id || currentUser;
      const blobUrl = await decryptAudioBlob(message, privateKey, userId);
      setAudioSrc(blobUrl);
    } catch (err) {
      console.error("Audio decryption failed:", err);
      setDecryptError(true);
    } finally {
      setDecrypting(false);
    }
  };

  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
      <div
        className={`px-4 py-2 rounded-lg max-w-xs text-sm shadow
        ${
          isOwn
            ? "bg-emerald-500 text-white rounded-br-sm"
            : "bg-white dark:bg-slate-700 text-gray-800 dark:text-white rounded-bl-sm"
        }`}
      >
        {/* 📝 TEXT MESSAGE */}
        {message.messageType !== "audio" && <div>{message.text}</div>}

        {/* 🎤 AUDIO MESSAGE */}
        {message.messageType === "audio" && message.audio && (
          <div className="flex flex-col gap-1">
            {decryptError ? (
              // Decryption failed
              <span className="text-xs opacity-70">
                🔒 Could not decrypt audio
              </span>
            ) : audioSrc ? (
              // Decrypted — show native audio player
              <audio controls className="w-full max-w-[200px]">
                <source src={audioSrc} type="audio/webm" />
                Your browser does not support audio.
              </audio>
            ) : (
              // Not yet decrypted — show tap-to-play button
              <button
                onClick={handlePlayClick}
                disabled={decrypting}
                className="flex items-center gap-2 text-xs opacity-80 hover:opacity-100 disabled:opacity-50 transition"
              >
                {decrypting ? "🔓 Decrypting..." : "🔒 ▶ Tap to play"}
              </button>
            )}
          </div>
        )}

        {/* ⏱ TIMESTAMP */}
        {time && (
          <div className="text-xs opacity-70 mt-1 text-right">{time}</div>
        )}
      </div>
    </div>
  );
}

export default MessageBubble;
