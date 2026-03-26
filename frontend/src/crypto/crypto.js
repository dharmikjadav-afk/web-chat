/*
==========================================================================
  End-to-End Encryption Utility
  Scheme  : RSA-OAEP (2048-bit) for key exchange
            AES-GCM  (256-bit)  for payload encryption
  Storage : One AES key is wrapped per participant (sender + receiver)
            so both parties can independently decrypt any message or media.
  Covers  : text messages · audio blobs · image blobs · file/doc blobs
==========================================================================
*/

// ─────────────────────────────────────────────────────────────────────────
// Internal helpers — not exported, used only within this module
// ─────────────────────────────────────────────────────────────────────────

/** ArrayBuffer → Base64 string */
const toBase64 = (buffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buffer)));

/** Base64 string → Uint8Array */
const fromBase64 = (base64) =>
  Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

/** Normalise any sender shape to a plain string ID */
const normaliseSenderId = (sender) =>
  sender?._id || sender?.id || sender || null;

/**
 * Generate a fresh AES-GCM 256-bit key + random 12-byte IV.
 * A new key is created for every single message — never reused.
 */
const generateAesKey = async () => {
  const key = await window.crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  return { key, iv };
};

/**
 * Wrap (RSA-OAEP encrypt) a raw AES key with a given RSA public key.
 * Returns a Base64 string ready to store in the database.
 */
const wrapAesKey = async (rawAesKey, rsaPublicKey) => {
  const wrapped = await window.crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    rsaPublicKey,
    rawAesKey,
  );
  return toBase64(wrapped);
};

/**
 * Unwrap (RSA-OAEP decrypt) a Base64-encoded wrapped AES key.
 * Returns a CryptoKey ready for AES-GCM decryption.
 */
const unwrapAesKey = async (wrappedBase64, rsaPrivateKey) => {
  const wrappedBytes = fromBase64(wrappedBase64);
  const decryptedAesBytes = await window.crypto.subtle.decrypt(
    { name: "RSA-OAEP" },
    rsaPrivateKey,
    wrappedBytes,
  );
  return window.crypto.subtle.importKey(
    "raw",
    decryptedAesBytes,
    { name: "AES-GCM" },
    false,
    ["decrypt"],
  );
};

/**
 * Select the correct wrapped AES key for the viewing user.
 * Prefers the per-user key; falls back to the legacy single-key field
 * so messages sent before the dual-key update still decrypt correctly.
 */
const selectAesKey = (message, currentUserId) => {
  const senderId = normaliseSenderId(message.sender);
  const isSender = String(currentUserId) === String(senderId);

  return (
    (isSender
      ? message.encryptedAesKeySender
      : message.encryptedAesKeyReceiver) ??
    message.encryptedAesKey ?? // legacy fallback
    null
  );
};

/**
 * Core AES-GCM encrypt: takes any ArrayBuffer, returns ciphertext ArrayBuffer.
 */
const aesEncrypt = async (buffer, aesKey, iv) =>
  window.crypto.subtle.encrypt({ name: "AES-GCM", iv }, aesKey, buffer);

/**
 * Core AES-GCM decrypt: takes ciphertext ArrayBuffer, returns plaintext ArrayBuffer.
 */
const aesDecrypt = async (buffer, aesKey, ivBytes) =>
  window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: ivBytes },
    aesKey,
    buffer,
  );

/**
 * Full media encrypt pipeline (shared by audio, image, and file).
 * Returns { encryptedBlob, encryptedAesKeyReceiver, encryptedAesKeySender, iv }
 */
const encryptBlob = async (
  blob,
  receiverPublicKeyBase64,
  senderPublicKeyBase64,
) => {
  const rawBuffer = await blob.arrayBuffer();

  const { key: aesKey, iv } = await generateAesKey();
  const encryptedBuffer = await aesEncrypt(rawBuffer, aesKey, iv);
  const rawAesKey = await window.crypto.subtle.exportKey("raw", aesKey);

  const receiverPublicKey = await importPublicKey(receiverPublicKeyBase64);
  const senderPublicKey = await importPublicKey(senderPublicKeyBase64);

  const [encryptedAesKeyReceiver, encryptedAesKeySender] = await Promise.all([
    wrapAesKey(rawAesKey, receiverPublicKey),
    wrapAesKey(rawAesKey, senderPublicKey),
  ]);

  // Ciphertext has no meaningful MIME type — label it explicitly
  const encryptedBlob = new Blob([encryptedBuffer], {
    type: "application/octet-stream",
  });

  return {
    encryptedBlob,
    encryptedAesKeyReceiver,
    encryptedAesKeySender,
    iv: toBase64(iv),
  };
};

/**
 * Full media decrypt pipeline (shared by audio, image, and file).
 * Fetches ciphertext from the Cloudinary URL stored on the message,
 * decrypts it, and returns a local object URL the browser can display.
 */
const decryptBlob = async (
  message,
  privateKeyBase64,
  currentUserId,
  mimeType,
) => {
  const url = message.audio || message.image || message.file;
  if (!url) throw new Error("Message has no media URL to decrypt");

  const selectedKey = selectAesKey(message, currentUserId);
  if (!selectedKey) throw new Error("No AES key found for the current user");

  const response = await fetch(url);
  const cipherBuffer = await response.arrayBuffer();

  const privateKey = await importPrivateKey(privateKeyBase64);
  const aesKey = await unwrapAesKey(selectedKey, privateKey);
  const ivBytes = fromBase64(message.iv);

  const decryptedBuffer = await aesDecrypt(cipherBuffer, aesKey, ivBytes);

  return URL.createObjectURL(new Blob([decryptedBuffer], { type: mimeType }));
};

// ─────────────────────────────────────────────────────────────────────────
// Public API — Key management
// ─────────────────────────────────────────────────────────────────────────

/**
 * Generate a fresh RSA-OAEP key pair.
 * Called once at first login; keys are stored in localStorage.
 * @returns {{ publicKey: string, privateKey: string }} — Base64-encoded SPKI / PKCS8
 */
export async function generateKeyPair() {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"],
  );

  const [publicKey, privateKey] = await Promise.all([
    exportPublicKey(keyPair.publicKey),
    exportPrivateKey(keyPair.privateKey),
  ]);

  return { publicKey, privateKey };
}

/** Export a CryptoKey (public) → Base64 SPKI string */
export async function exportPublicKey(key) {
  const exported = await window.crypto.subtle.exportKey("spki", key);
  return toBase64(exported);
}

/** Export a CryptoKey (private) → Base64 PKCS8 string */
export async function exportPrivateKey(key) {
  const exported = await window.crypto.subtle.exportKey("pkcs8", key);
  return toBase64(exported);
}

/** Import a Base64 SPKI string → CryptoKey (encrypt only) */
export async function importPublicKey(base64) {
  return window.crypto.subtle.importKey(
    "spki",
    fromBase64(base64),
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["encrypt"],
  );
}

/** Import a Base64 PKCS8 string → CryptoKey (decrypt only) */
export async function importPrivateKey(base64) {
  return window.crypto.subtle.importKey(
    "pkcs8",
    fromBase64(base64),
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["decrypt"],
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Public API — Text messages
// ─────────────────────────────────────────────────────────────────────────

/**
 * Encrypt a plain-text message for both sender and receiver.
 * @returns {{ encryptedMessage, encryptedAesKeyReceiver, encryptedAesKeySender, iv }}
 *          All values are Base64 strings ready for JSON / FormData.
 */
export async function encryptMessage(
  plainText,
  receiverPublicKeyBase64,
  senderPublicKeyBase64,
) {
  const { key: aesKey, iv } = await generateAesKey();

  const encodedText = new TextEncoder().encode(plainText);
  const encryptedMessage = await aesEncrypt(encodedText, aesKey, iv);
  const rawAesKey = await window.crypto.subtle.exportKey("raw", aesKey);

  const receiverPublicKey = await importPublicKey(receiverPublicKeyBase64);
  const senderPublicKey = await importPublicKey(senderPublicKeyBase64);

  const [encryptedAesKeyReceiver, encryptedAesKeySender] = await Promise.all([
    wrapAesKey(rawAesKey, receiverPublicKey),
    wrapAesKey(rawAesKey, senderPublicKey),
  ]);

  return {
    encryptedMessage: toBase64(encryptedMessage),
    encryptedAesKeyReceiver,
    encryptedAesKeySender,
    iv: toBase64(iv),
  };
}

/**
 * Decrypt an encrypted text message.
 * Gracefully returns the plain `text` field for unencrypted messages
 * and a lock placeholder if decryption fails, so the UI never crashes.
 *
 * @param {object} encryptedData  — message object from the API
 * @param {string} privateKeyBase64
 * @param {string} currentUserId
 * @returns {Promise<string>}
 */
export async function decryptMessage(
  encryptedData,
  privateKeyBase64,
  currentUserId,
) {
  try {
    const { encryptedMessage, iv, isEncrypted, messageType, text } =
      encryptedData;

    // Not encrypted, or a media message — return plain text as-is
    if (!isEncrypted || messageType !== "text" || !encryptedMessage || !iv) {
      return text || "";
    }

    const selectedKey = selectAesKey(encryptedData, currentUserId);
    if (!selectedKey) return "🔒 Encrypted message";

    const privateKey = await importPrivateKey(privateKeyBase64);
    const aesKey = await unwrapAesKey(selectedKey, privateKey);
    const ivBytes = fromBase64(iv);
    const cipherBytes = fromBase64(encryptedMessage);
    const decryptedBuffer = await aesDecrypt(cipherBytes, aesKey, ivBytes);

    return new TextDecoder().decode(decryptedBuffer);
  } catch (err) {
    console.error("[crypto] decryptMessage failed:", err);
    return "🔒 Encrypted message";
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Public API — Audio
// ─────────────────────────────────────────────────────────────────────────

/**
 * Encrypt a recorded audio Blob before uploading to Cloudinary.
 * Cloudinary only ever stores ciphertext — the real audio never leaves
 * the browser unencrypted.
 *
 * @param {Blob}   audioBlob
 * @param {string} receiverPublicKeyBase64
 * @param {string} senderPublicKeyBase64
 * @returns {{ encryptedBlob, encryptedAesKeyReceiver, encryptedAesKeySender, iv }}
 */
export async function encryptAudioBlob(
  audioBlob,
  receiverPublicKeyBase64,
  senderPublicKeyBase64,
) {
  return encryptBlob(audioBlob, receiverPublicKeyBase64, senderPublicKeyBase64);
}

/**
 * Fetch encrypted audio from Cloudinary, decrypt it, and return
 * a local object URL the <audio> element can play directly.
 *
 * @param {object} message        — message object from the API
 * @param {string} privateKeyBase64
 * @param {string} currentUserId
 * @returns {Promise<string>}     — blob: URL
 */
export async function decryptAudioBlob(
  message,
  privateKeyBase64,
  currentUserId,
) {
  return decryptBlob(message, privateKeyBase64, currentUserId, "audio/webm");
}

// ─────────────────────────────────────────────────────────────────────────
// Public API — Images
// ─────────────────────────────────────────────────────────────────────────

/**
 * Encrypt an image File/Blob before uploading to Cloudinary.
 *
 * @param {Blob}   imageBlob
 * @param {string} receiverPublicKeyBase64
 * @param {string} senderPublicKeyBase64
 * @returns {{ encryptedBlob, encryptedAesKeyReceiver, encryptedAesKeySender, iv }}
 */
export async function encryptImageBlob(
  imageBlob,
  receiverPublicKeyBase64,
  senderPublicKeyBase64,
) {
  return encryptBlob(imageBlob, receiverPublicKeyBase64, senderPublicKeyBase64);
}

/**
 * Fetch encrypted image from Cloudinary, decrypt it, and return
 * a local object URL an <img> element can display directly.
 *
 * @param {object} message        — message object from the API
 * @param {string} privateKeyBase64
 * @param {string} currentUserId
 * @returns {Promise<string>}     — blob: URL
 */
export async function decryptImageBlob(
  message,
  privateKeyBase64,
  currentUserId,
) {
  // Use the original file's MIME type if stored; fall back to jpeg
  const mimeType = message.fileMimeType || "image/jpeg";
  return decryptBlob(message, privateKeyBase64, currentUserId, mimeType);
}

// ─────────────────────────────────────────────────────────────────────────
// Public API — Files / Documents
// ─────────────────────────────────────────────────────────────────────────

/**
 * Encrypt any File/Blob (PDF, Word, Excel, etc.) before uploading.
 *
 * @param {Blob}   fileBlob
 * @param {string} receiverPublicKeyBase64
 * @param {string} senderPublicKeyBase64
 * @returns {{ encryptedBlob, encryptedAesKeyReceiver, encryptedAesKeySender, iv }}
 */
export async function encryptFileBlob(
  fileBlob,
  receiverPublicKeyBase64,
  senderPublicKeyBase64,
) {
  return encryptBlob(fileBlob, receiverPublicKeyBase64, senderPublicKeyBase64);
}

/**
 * Fetch an encrypted file from Cloudinary, decrypt it, and return
 * a local object URL. The caller should trigger a download using the
 * original fileName stored on the message.
 *
 * @param {object} message        — message object from the API
 * @param {string} privateKeyBase64
 * @param {string} currentUserId
 * @returns {Promise<string>}     — blob: URL
 */
export async function decryptFileBlob(
  message,
  privateKeyBase64,
  currentUserId,
) {
  return decryptBlob(
    message,
    privateKeyBase64,
    currentUserId,
    "application/octet-stream",
  );
}
