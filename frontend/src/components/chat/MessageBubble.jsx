import { useState, useRef, useEffect } from "react";
import { decryptAudioBlob } from "../../crypto/crypto";

// ─────────────────────────────────────────────
// 🎵 Custom WhatsApp-style Audio Player
// ─────────────────────────────────────────────
function AudioPlayer({ src, isOwn }) {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onLoaded = () => setDuration(audio.duration);
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
    };
  }, [src]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    audio.currentTime = ratio * duration;
  };

  const formatTime = (s) => {
    if (!s || isNaN(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const progress = duration ? (currentTime / duration) * 100 : 0;

  // Static waveform bars (decorative, like WhatsApp)
  const bars = [
    3, 5, 8, 6, 10, 7, 4, 9, 6, 8, 5, 7, 10, 4, 6, 8, 5, 9, 7, 4, 6, 8, 10, 5,
    7,
  ];

  return (
    <div className="flex items-center gap-2 w-52">
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* ── Play / Pause Button ── */}
      <button
        onClick={togglePlay}
        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all active:scale-95
          ${
            isOwn
              ? "bg-white/25 hover:bg-white/35"
              : "bg-emerald-500/15 hover:bg-emerald-500/25 dark:bg-emerald-500/20 dark:hover:bg-emerald-500/30"
          }`}
      >
        {isPlaying ? (
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <rect
              x="0.5"
              y="0.5"
              width="3"
              height="10"
              rx="1"
              fill={isOwn ? "white" : "#10b981"}
            />
            <rect
              x="7.5"
              y="0.5"
              width="3"
              height="10"
              rx="1"
              fill={isOwn ? "white" : "#10b981"}
            />
          </svg>
        ) : (
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <path
              d="M1.5 1L10 5.5L1.5 10V1Z"
              fill={isOwn ? "white" : "#10b981"}
            />
          </svg>
        )}
      </button>

      {/* ── Waveform + Time ── */}
      <div className="flex-1 flex flex-col gap-[5px]">
        {/* Waveform bars — clickable seek */}
        <div
          className="flex items-center gap-[2px] h-7 cursor-pointer"
          onClick={handleSeek}
        >
          {bars.map((h, i) => {
            const isActive = (i / bars.length) * 100 <= progress;
            return (
              <div
                key={i}
                style={{ height: `${h * 2.2}px` }}
                className={`w-[2.5px] rounded-full transition-colors duration-100 ${
                  isActive
                    ? isOwn
                      ? "bg-white"
                      : "bg-emerald-500"
                    : isOwn
                      ? "bg-white/40"
                      : "bg-gray-300 dark:bg-slate-500"
                }`}
              />
            );
          })}
        </div>

        {/* Duration / current time */}
        <span
          className={`text-[10px] leading-none tabular-nums
            ${isOwn ? "text-white/65" : "text-gray-400 dark:text-slate-400"}`}
        >
          {isPlaying || currentTime > 0
            ? formatTime(currentTime)
            : formatTime(duration)}
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 💬 Message Bubble
// ─────────────────────────────────────────────
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
              // ── Decryption failed ──
              <div className="flex items-center gap-2 py-1">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0
                  ${isOwn ? "bg-white/20" : "bg-red-500/10"}`}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={isOwn ? "white" : "#ef4444"}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
                <span
                  className={`text-xs ${isOwn ? "text-white/70" : "text-red-400"}`}
                >
                  Could not decrypt
                </span>
              </div>
            ) : audioSrc ? (
              // ── Decrypted — custom player ──
              <AudioPlayer src={audioSrc} isOwn={isOwn} />
            ) : (
              // ── Not yet decrypted — tap to play ──
              <button
                onClick={handlePlayClick}
                disabled={decrypting}
                className={`flex items-center gap-2 py-1 transition-opacity
                  disabled:opacity-50 hover:opacity-90`}
              >
                {/* Animated mic / lock icon */}
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all
                  ${
                    decrypting
                      ? isOwn
                        ? "bg-white/20 animate-pulse"
                        : "bg-emerald-500/15 animate-pulse"
                      : isOwn
                        ? "bg-white/20 hover:bg-white/30"
                        : "bg-emerald-500/15 hover:bg-emerald-500/25"
                  }`}
                >
                  {decrypting ? (
                    // Spinner
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={isOwn ? "white" : "#10b981"}
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      className="animate-spin"
                    >
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    </svg>
                  ) : (
                    // Mic icon
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={isOwn ? "white" : "#10b981"}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      <line x1="12" y1="19" x2="12" y2="23" />
                      <line x1="8" y1="23" x2="16" y2="23" />
                    </svg>
                  )}
                </div>

                {/* Static placeholder waveform */}
                <div className="flex items-center gap-[2px] h-7">
                  {[
                    3, 5, 8, 6, 10, 7, 4, 9, 6, 8, 5, 7, 10, 4, 6, 8, 5, 9, 7,
                    4, 6, 8, 10, 5, 7,
                  ].map((h, i) => (
                    <div
                      key={i}
                      style={{ height: `${h * 2.2}px` }}
                      className={`w-[2.5px] rounded-full
                        ${isOwn ? "bg-white/35" : "bg-gray-300 dark:bg-slate-500"}`}
                    />
                  ))}
                </div>
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
