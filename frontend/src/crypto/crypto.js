/*
===============================================
End-to-End Encryption Utility
- RSA-OAEP for key exchange
- AES-GCM for message encryption
Supports sender + receiver decryption
===============================================
*/

// ─── Generate RSA Key Pair ─────────────────────────────────────────────
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

  const publicKey = await exportPublicKey(keyPair.publicKey);
  const privateKey = await exportPrivateKey(keyPair.privateKey);

  return { publicKey, privateKey };
}

// ─── Export Keys ───────────────────────────────────────────────────────
export async function exportPublicKey(key) {
  const exported = await window.crypto.subtle.exportKey("spki", key);
  return btoa(String.fromCharCode(...new Uint8Array(exported)));
}

export async function exportPrivateKey(key) {
  const exported = await window.crypto.subtle.exportKey("pkcs8", key);
  return btoa(String.fromCharCode(...new Uint8Array(exported)));
}

// ─── Import Keys ───────────────────────────────────────────────────────
export async function importPublicKey(base64) {
  const binary = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

  return window.crypto.subtle.importKey(
    "spki",
    binary,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["encrypt"],
  );
}

export async function importPrivateKey(base64) {
  const binary = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

  return window.crypto.subtle.importKey(
    "pkcs8",
    binary,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["decrypt"],
  );
}

// ─── Encrypt Message (NEW VERSION) ─────────────────────────────────────
export async function encryptMessage(
  plainText,
  receiverPublicKeyBase64,
  senderPublicKeyBase64,
) {
  // 1️⃣ Generate AES key
  const aesKey = await window.crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );

  // 2️⃣ Encrypt message with AES
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encodedText = new TextEncoder().encode(plainText);

  const encryptedMessage = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    encodedText,
  );

  // 3️⃣ Export AES key
  const exportedAesKey = await window.crypto.subtle.exportKey("raw", aesKey);

  // 4️⃣ Encrypt AES key with receiver public key
  const receiverPublicKey = await importPublicKey(receiverPublicKeyBase64);

  const encryptedAesKeyReceiver = await window.crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    receiverPublicKey,
    exportedAesKey,
  );

  // 5️⃣ Encrypt AES key with sender public key
  const senderPublicKey = await importPublicKey(senderPublicKeyBase64);

  const encryptedAesKeySender = await window.crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    senderPublicKey,
    exportedAesKey,
  );

  // 6️⃣ Return encrypted payload
  return {
    encryptedMessage: btoa(
      String.fromCharCode(...new Uint8Array(encryptedMessage)),
    ),

    encryptedAesKeyReceiver: btoa(
      String.fromCharCode(...new Uint8Array(encryptedAesKeyReceiver)),
    ),

    encryptedAesKeySender: btoa(
      String.fromCharCode(...new Uint8Array(encryptedAesKeySender)),
    ),

    iv: btoa(String.fromCharCode(...iv)),
  };
}

// ─── Decrypt Message ───────────────────────────────────────────────────
export async function decryptMessage(
  encryptedData,
  privateKeyBase64,
  currentUserId,
) {
  try {
    const {
      encryptedMessage,
      encryptedAesKeyReceiver,
      encryptedAesKeySender,
      encryptedAesKey,
      sender,
      iv,
      isEncrypted,
      messageType,
      text,
    } = encryptedData;

    // 🛑 1. Skip non-encrypted messages (IMPORTANT FIX)
    if (!isEncrypted || messageType === "audio" || !encryptedMessage || !iv) {
      return text || "";
    }

    // 🧠 2. Normalize sender ID
    const senderId = sender?._id || sender?.id || sender;

    // 🧠 3. Select correct AES key
    let selectedKey =
      currentUserId === senderId
        ? encryptedAesKeySender
        : encryptedAesKeyReceiver;

    // 🛟 4. Fallback (for safety)
    if (!selectedKey) {
      selectedKey = encryptedAesKey;
    }

    // 🛑 5. Final protection (NO crash)
    if (!selectedKey) {
      return "🔒 Encrypted message";
    }

    // 🔐 6. Import private key
    const privateKey = await importPrivateKey(privateKeyBase64);

    // 🔄 7. Convert Base64 → Uint8Array
    const encryptedAesKeyBytes = Uint8Array.from(atob(selectedKey), (c) =>
      c.charCodeAt(0),
    );

    // 🔓 8. Decrypt AES key (RSA)
    const decryptedAesKeyBytes = await window.crypto.subtle.decrypt(
      { name: "RSA-OAEP" },
      privateKey,
      encryptedAesKeyBytes,
    );

    // 🔑 9. Import AES key
    const aesKey = await window.crypto.subtle.importKey(
      "raw",
      decryptedAesKeyBytes,
      { name: "AES-GCM" },
      false,
      ["decrypt"],
    );

    // 🔄 10. Convert IV
    const ivBytes = Uint8Array.from(atob(iv), (c) => c.charCodeAt(0));

    // 🔄 11. Convert encrypted message
    const encryptedMessageBytes = Uint8Array.from(atob(encryptedMessage), (c) =>
      c.charCodeAt(0),
    );

    // 🔓 12. Decrypt message (AES)
    const decryptedMessage = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: ivBytes },
      aesKey,
      encryptedMessageBytes,
    );

    return new TextDecoder().decode(decryptedMessage);
  } catch (err) {
    console.error("Decryption failed:", err);
    return "🔒 Encrypted message";
  }
}

// ─── Encrypt Audio Blob ────────────────────────────────────────────────
export async function encryptAudioBlob(
  audioBlob,
  receiverPublicKeyBase64,
  senderPublicKeyBase64,
) {
  // 1️⃣ Read blob into raw bytes
  const audioBuffer = await audioBlob.arrayBuffer();

  // 2️⃣ Generate a fresh AES-GCM key (one per message, just like text)
  const aesKey = await window.crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );

  // 3️⃣ Encrypt the raw audio bytes
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const encryptedBuffer = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    audioBuffer,
  );

  // 4️⃣ Export the AES key so we can RSA-wrap it
  const exportedAesKey = await window.crypto.subtle.exportKey("raw", aesKey);

  // 5️⃣ Wrap AES key with receiver's public key
  const receiverPublicKey = await importPublicKey(receiverPublicKeyBase64);

  const encryptedAesKeyReceiver = await window.crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    receiverPublicKey,
    exportedAesKey,
  );

  // 6️⃣ Wrap AES key with sender's public key (so sender can replay their own audio)
  const senderPublicKey = await importPublicKey(senderPublicKeyBase64);

  const encryptedAesKeySender = await window.crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    senderPublicKey,
    exportedAesKey,
  );

  // 7️⃣ Return encrypted Blob (ciphertext) + base64-encoded keys + iv
  const encryptedBlob = new Blob([encryptedBuffer], {
    type: "application/octet-stream", // NOT audio/webm — this is raw ciphertext
  });

  return {
    encryptedBlob,
    encryptedAesKeyReceiver: btoa(
      String.fromCharCode(...new Uint8Array(encryptedAesKeyReceiver)),
    ),
    encryptedAesKeySender: btoa(
      String.fromCharCode(...new Uint8Array(encryptedAesKeySender)),
    ),
    iv: btoa(String.fromCharCode(...iv)),
  };
}

// ─── Decrypt Audio Blob ────────────────────────────────────────────────
export async function decryptAudioBlob(
  message,
  privateKeyBase64,
  currentUserId,
) {
  const {
    audio, // Cloudinary URL — contains raw ciphertext bytes
    encryptedAesKeyReceiver,
    encryptedAesKeySender,
    encryptedAesKey, // legacy fallback for old messages
    iv,
    sender,
  } = message;

  // 1️⃣ Fetch the ciphertext bytes from Cloudinary
  const response = await fetch(audio);
  const cipherBuffer = await response.arrayBuffer();

  // 2️⃣ Pick the correct wrapped AES key based on who is viewing
  const senderId = sender?._id || sender?.id || sender;

  let selectedKey =
    currentUserId === senderId
      ? encryptedAesKeySender
      : encryptedAesKeyReceiver;

  // Fallback for legacy messages that only stored one key
  if (!selectedKey) selectedKey = encryptedAesKey;
  if (!selectedKey) throw new Error("No AES key found for this user");

  // 3️⃣ RSA-unwrap the AES key using our private key
  const privateKey = await importPrivateKey(privateKeyBase64);

  const encryptedAesKeyBytes = Uint8Array.from(atob(selectedKey), (c) =>
    c.charCodeAt(0),
  );

  const decryptedAesKeyBytes = await window.crypto.subtle.decrypt(
    { name: "RSA-OAEP" },
    privateKey,
    encryptedAesKeyBytes,
  );

  // 4️⃣ Import the raw AES key
  const aesKey = await window.crypto.subtle.importKey(
    "raw",
    decryptedAesKeyBytes,
    { name: "AES-GCM" },
    false,
    ["decrypt"],
  );

  // 5️⃣ Decrypt the audio bytes
  const ivBytes = Uint8Array.from(atob(iv), (c) => c.charCodeAt(0));

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: ivBytes },
    aesKey,
    cipherBuffer,
  );

  // 6️⃣ Wrap in a Blob and return a local playable URL
  // This URL never leaves the browser — Cloudinary only ever saw ciphertext
  const audioBlob = new Blob([decryptedBuffer], { type: "audio/webm" });
  return URL.createObjectURL(audioBlob);
}
