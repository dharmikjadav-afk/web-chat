import { useState, useRef, useEffect } from "react";
import {
  decryptAudioBlob,
  decryptImageBlob,
  decryptFileBlob,
} from "../../crypto/crypto";

/*
==========================================================================
  MessageBubble
  Renders : plain text · encrypted text
            voice notes  (tap-to-decrypt → custom audio player)
            images       (tap-to-decrypt → inline preview → tap to fullscreen)
            files/docs   (tap-to-decrypt → auto-download)
  All media is decrypted entirely in-browser.
  Cloudinary only ever served ciphertext.
==========================================================================
*/

// ─────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────

const WAVEFORM_BARS = [
  3, 5, 8, 6, 10, 7, 4, 9, 6, 8, 5, 7, 10, 4, 6, 8, 5, 9, 7, 4, 6, 8, 10, 5, 7,
];

const formatFileSize = (bytes) => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatTime = (s) => {
  if (!s || isNaN(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
};

// ─────────────────────────────────────────────────────────────────────────
// Shared SVG icons (inline, no external dependency)
// ─────────────────────────────────────────────────────────────────────────

const IconSpinner = ({ color }) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2.5"
    strokeLinecap="round"
    className="animate-spin"
  >
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);

const IconLock = ({ color }) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const IconMic = ({ color }) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="23" />
    <line x1="8" y1="23" x2="16" y2="23" />
  </svg>
);

const IconPlay = ({ color }) => (
  <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
    <path d="M1.5 1L10 5.5L1.5 10V1Z" fill={color} />
  </svg>
);

const IconPause = ({ color }) => (
  <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
    <rect x="0.5" y="0.5" width="3" height="10" rx="1" fill={color} />
    <rect x="7.5" y="0.5" width="3" height="10" rx="1" fill={color} />
  </svg>
);

// ─────────────────────────────────────────────────────────────────────────
// Shared — circular icon button used in multiple media states
// ─────────────────────────────────────────────────────────────────────────
function IconCircleButton({ isOwn, busy, onClick, disabled, children }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0
        transition-all active:scale-95 disabled:opacity-50
        ${
          busy
            ? isOwn
              ? "bg-white/20 animate-pulse"
              : "bg-emerald-500/15 animate-pulse"
            : isOwn
              ? "bg-white/20 hover:bg-white/30"
              : "bg-emerald-500/15 hover:bg-emerald-500/25 dark:bg-emerald-500/20 dark:hover:bg-emerald-500/30"
        }`}
    >
      {children}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// AudioPlayer — WhatsApp-style waveform player
// ─────────────────────────────────────────────────────────────────────────
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
    isPlaying ? audio.pause() : audio.play();
    setIsPlaying((p) => !p);
  };

  const handleSeek = (e) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    audio.currentTime = ratio * duration;
  };

  const progress = duration ? (currentTime / duration) * 100 : 0;
  const iconColor = isOwn ? "white" : "#10b981";

  return (
    <div className="flex items-center gap-2 w-52">
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Play / Pause */}
      <IconCircleButton isOwn={isOwn} onClick={togglePlay}>
        {isPlaying ? (
          <IconPause color={iconColor} />
        ) : (
          <IconPlay color={iconColor} />
        )}
      </IconCircleButton>

      {/* Waveform + timestamp */}
      <div className="flex-1 flex flex-col gap-[5px]">
        <div
          className="flex items-center gap-[2px] h-7 cursor-pointer"
          onClick={handleSeek}
        >
          {WAVEFORM_BARS.map((h, i) => {
            const active = (i / WAVEFORM_BARS.length) * 100 <= progress;
            return (
              <div
                key={i}
                style={{ height: `${h * 2.2}px` }}
                className={`w-[2.5px] rounded-full transition-colors duration-100
                  ${
                    active
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

// ─────────────────────────────────────────────────────────────────────────
// ImageViewer — fullscreen lightbox overlay
// ─────────────────────────────────────────────────────────────────────────
function ImageViewer({ src, onClose }) {
  // Close on Escape
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <img
        src={src}
        alt="Full size"
        className="max-w-[90vw] max-h-[90vh] rounded-lg shadow-2xl object-contain"
        onClick={(e) => e.stopPropagation()} // don't close when clicking the image
      />
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
        aria-label="Close image"
      >
        ✕
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// MessageBubble
// ─────────────────────────────────────────────────────────────────────────
function MessageBubble({ message, isOwn, currentUser }) {
  // ── Audio state ──────────────────────────────────────────────────────────
  const [audioSrc, setAudioSrc] = useState(null);
  const [audioDecrypting, setAudioDecrypting] = useState(false);
  const [audioError, setAudioError] = useState(false);

  // ── Image state ──────────────────────────────────────────────────────────
  const [imageSrc, setImageSrc] = useState(null);
  const [imageDecrypting, setImageDecrypting] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // ── File state ───────────────────────────────────────────────────────────
  const [fileDecrypting, setFileDecrypting] = useState(false);
  const [fileError, setFileError] = useState(false);
  const [fileReady, setFileReady] = useState(false); // downloaded once

  const time = message.createdAt
    ? new Date(message.createdAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  // Shared helper — pull private key + normalised user ID
  const getDecryptContext = () => ({
    privateKey: localStorage.getItem("privateKey"),
    userId: currentUser?._id || currentUser?.id || currentUser,
  });

  const iconColor = isOwn ? "white" : "#10b981";
  const errorColor = isOwn ? "white" : "#ef4444";

  // ─────────────────────────────────────────────────────────────────────────
  // Audio — tap to decrypt then play
  // ─────────────────────────────────────────────────────────────────────────
  const handleAudioClick = async () => {
    if (audioSrc || audioDecrypting) return;

    if (!message.isEncrypted) {
      setAudioSrc(message.audio);
      return;
    }

    try {
      setAudioDecrypting(true);
      const { privateKey, userId } = getDecryptContext();
      const blobUrl = await decryptAudioBlob(message, privateKey, userId);
      setAudioSrc(blobUrl);
    } catch (err) {
      console.error("[MessageBubble] audio decrypt failed:", err);
      setAudioError(true);
    } finally {
      setAudioDecrypting(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Image — tap to decrypt then show inline; tap inline to fullscreen
  // ─────────────────────────────────────────────────────────────────────────
  const handleImageClick = async () => {
    // If already decrypted just open lightbox
    if (imageSrc) {
      setLightboxOpen(true);
      return;
    }
    if (imageDecrypting) return;

    if (!message.isEncrypted) {
      setImageSrc(message.image);
      setLightboxOpen(true);
      return;
    }

    try {
      setImageDecrypting(true);
      const { privateKey, userId } = getDecryptContext();
      const blobUrl = await decryptImageBlob(message, privateKey, userId);
      setImageSrc(blobUrl);
    } catch (err) {
      console.error("[MessageBubble] image decrypt failed:", err);
      setImageError(true);
    } finally {
      setImageDecrypting(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // File — tap to decrypt then auto-download
  // ─────────────────────────────────────────────────────────────────────────
  const handleFileClick = async () => {
    if (fileDecrypting) return;

    if (!message.isEncrypted) {
      window.open(message.file, "_blank");
      return;
    }

    // Prevent re-downloading if already done this session
    if (fileReady) return;

    try {
      setFileDecrypting(true);
      const { privateKey, userId } = getDecryptContext();
      const blobUrl = await decryptFileBlob(message, privateKey, userId);

      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = message.fileName || "file";
      a.click();
      URL.revokeObjectURL(blobUrl); // release immediately after download triggers
      setFileReady(true);
    } catch (err) {
      console.error("[MessageBubble] file decrypt failed:", err);
      setFileError(true);
    } finally {
      setFileDecrypting(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Shared error state chip
  // ─────────────────────────────────────────────────────────────────────────
  const DecryptErrorChip = () => (
    <div className="flex items-center gap-2 py-1">
      <div
        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0
        ${isOwn ? "bg-white/20" : "bg-red-500/10"}`}
      >
        <IconLock color={errorColor} />
      </div>
      <span className={`text-xs ${isOwn ? "text-white/70" : "text-red-400"}`}>
        Could not decrypt
      </span>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Lightbox — rendered outside the bubble so it isn't clipped */}
      {lightboxOpen && imageSrc && (
        <ImageViewer src={imageSrc} onClose={() => setLightboxOpen(false)} />
      )}

      <div className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
        <div
          className={`px-4 py-2 rounded-lg max-w-xs text-sm shadow
          ${
            isOwn
              ? "bg-emerald-500 text-white rounded-br-sm"
              : "bg-white dark:bg-slate-700 text-gray-800 dark:text-white rounded-bl-sm"
          }`}
        >
          {/* ── TEXT ───────────────────────────────────────────────────── */}
          {message.messageType === "text" && (
            <div className="leading-relaxed">{message.text}</div>
          )}

          {/* ── AUDIO ──────────────────────────────────────────────────── */}
          {message.messageType === "audio" && message.audio && (
            <div className="flex flex-col gap-1">
              {audioError ? (
                <DecryptErrorChip />
              ) : audioSrc ? (
                <AudioPlayer src={audioSrc} isOwn={isOwn} />
              ) : (
                /* Tap-to-decrypt button with placeholder waveform */
                <button
                  onClick={handleAudioClick}
                  disabled={audioDecrypting}
                  className="flex items-center gap-2 py-1 hover:opacity-90 disabled:opacity-50 transition-opacity"
                  aria-label={
                    audioDecrypting
                      ? "Decrypting voice note…"
                      : "Play voice note"
                  }
                >
                  <IconCircleButton
                    isOwn={isOwn}
                    busy={audioDecrypting}
                    disabled={audioDecrypting}
                  >
                    {audioDecrypting ? (
                      <IconSpinner color={iconColor} />
                    ) : (
                      <IconMic color={iconColor} />
                    )}
                  </IconCircleButton>

                  {/* Static placeholder waveform */}
                  <div className="flex items-center gap-[2px] h-7">
                    {WAVEFORM_BARS.map((h, i) => (
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

          {/* ── IMAGE ──────────────────────────────────────────────────── */}
          {message.messageType === "image" && (
            <div className="mt-1">
              {imageError ? (
                <DecryptErrorChip />
              ) : imageSrc ? (
                /* Decrypted — show thumbnail, tap opens lightbox */
                <img
                  src={imageSrc}
                  alt="image"
                  onClick={() => setLightboxOpen(true)}
                  className="max-w-[220px] rounded-lg cursor-zoom-in object-cover"
                />
              ) : (
                /* Tap-to-decrypt button */
                <button
                  onClick={handleImageClick}
                  disabled={imageDecrypting}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg transition
                    disabled:opacity-50 hover:opacity-90"
                  aria-label={
                    imageDecrypting ? "Decrypting image…" : "View image"
                  }
                >
                  <IconCircleButton
                    isOwn={isOwn}
                    busy={imageDecrypting}
                    disabled={imageDecrypting}
                  >
                    {imageDecrypting ? (
                      <IconSpinner color={iconColor} />
                    ) : (
                      <IconLock color={iconColor} />
                    )}
                  </IconCircleButton>
                  <span
                    className={`text-xs font-medium
                    ${isOwn ? "text-white/80" : "text-gray-600 dark:text-slate-300"}`}
                  >
                    {imageDecrypting ? "Decrypting…" : "Tap to view"}
                  </span>
                </button>
              )}
            </div>
          )}

          {/* ── FILE / DOCUMENT ────────────────────────────────────────── */}
          {message.messageType === "file" && (
            <div className="mt-1">
              {fileError ? (
                <DecryptErrorChip />
              ) : (
                <button
                  onClick={handleFileClick}
                  disabled={fileDecrypting}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg w-full text-left
                    transition hover:opacity-90 disabled:opacity-50
                    ${
                      isOwn
                        ? "bg-white/15 hover:bg-white/20"
                        : "bg-gray-100 dark:bg-slate-600 hover:bg-gray-200 dark:hover:bg-slate-500"
                    }`}
                  aria-label={
                    fileDecrypting
                      ? "Decrypting file…"
                      : `Download ${message.fileName || "file"}`
                  }
                >
                  {/* File icon */}
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0
                    ${isOwn ? "bg-white/20" : "bg-emerald-500/15"}`}
                  >
                    {fileDecrypting ? (
                      <IconSpinner color={iconColor} />
                    ) : (
                      <span className="text-base" role="img" aria-label="file">
                        📄
                      </span>
                    )}
                  </div>

                  {/* Name + size */}
                  <div className="min-w-0 flex-1">
                    <div
                      className={`text-xs font-medium truncate
                      ${isOwn ? "text-white" : "text-gray-800 dark:text-white"}`}
                    >
                      {message.fileName || "File"}
                    </div>
                    <div
                      className={`text-[10px] mt-0.5
                      ${isOwn ? "text-white/60" : "text-gray-400 dark:text-slate-400"}`}
                    >
                      {fileDecrypting
                        ? "Decrypting…"
                        : fileReady
                          ? "Downloaded ✓"
                          : message.isEncrypted
                            ? `${formatFileSize(message.fileSize)} · Tap to download`
                            : formatFileSize(message.fileSize)}
                    </div>
                  </div>
                </button>
              )}
            </div>
          )}

          {/* ── TIMESTAMP ──────────────────────────────────────────────── */}
          {time && (
            <div className="text-xs opacity-60 mt-1 text-right tabular-nums">
              {time}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default MessageBubble;
