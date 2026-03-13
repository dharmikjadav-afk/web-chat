/*
===============================================
End-to-End Encryption Utility
- RSA-OAEP for key exchange
- AES-GCM for message encryption
===============================================
*/

// ─── Generate RSA Key Pair for a user ───────────────────────────────────────
export async function generateKeyPair() {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true, // extractable
    ["encrypt", "decrypt"],
  );

  // Export to storable formats
  const publicKey = await exportPublicKey(keyPair.publicKey);
  const privateKey = await exportPrivateKey(keyPair.privateKey);

  return { publicKey, privateKey };
}

// ─── Export keys to base64 strings ──────────────────────────────────────────
export async function exportPublicKey(key) {
  const exported = await window.crypto.subtle.exportKey("spki", key);
  return btoa(String.fromCharCode(...new Uint8Array(exported)));
}

export async function exportPrivateKey(key) {
  const exported = await window.crypto.subtle.exportKey("pkcs8", key);
  return btoa(String.fromCharCode(...new Uint8Array(exported)));
}

// ─── Import keys from base64 strings ────────────────────────────────────────
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

// ─── Encrypt a message ───────────────────────────────────────────────────────
export async function encryptMessage(plainText, receiverPublicKeyBase64) {
  // 1. Generate a one-time AES key
  const aesKey = await window.crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );

  // 2. Encrypt the message with AES
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encodedText = new TextEncoder().encode(plainText);
  const encryptedMessage = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    encodedText,
  );

  // 3. Encrypt the AES key with receiver's RSA public key
  const exportedAesKey = await window.crypto.subtle.exportKey("raw", aesKey);
  const receiverPublicKey = await importPublicKey(receiverPublicKeyBase64);
  const encryptedAesKey = await window.crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    receiverPublicKey,
    exportedAesKey,
  );

  // 4. Return everything as base64
  return {
    encryptedMessage: btoa(
      String.fromCharCode(...new Uint8Array(encryptedMessage)),
    ),
    encryptedAesKey: btoa(
      String.fromCharCode(...new Uint8Array(encryptedAesKey)),
    ),
    iv: btoa(String.fromCharCode(...iv)),
  };
}

// ─── Decrypt a message ───────────────────────────────────────────────────────
export async function decryptMessage(encryptedData, privateKeyBase64) {
  try {
    const { encryptedMessage, encryptedAesKey, iv } = encryptedData;

    // 1. Import private key
    const privateKey = await importPrivateKey(privateKeyBase64);

    // 2. Decrypt AES key using RSA private key
    const encryptedAesKeyBytes = Uint8Array.from(atob(encryptedAesKey), (c) =>
      c.charCodeAt(0),
    );
    const decryptedAesKeyBytes = await window.crypto.subtle.decrypt(
      { name: "RSA-OAEP" },
      privateKey,
      encryptedAesKeyBytes,
    );

    // 3. Import the decrypted AES key
    const aesKey = await window.crypto.subtle.importKey(
      "raw",
      decryptedAesKeyBytes,
      { name: "AES-GCM" },
      false,
      ["decrypt"],
    );

    // 4. Decrypt the message with AES key
    const ivBytes = Uint8Array.from(atob(iv), (c) => c.charCodeAt(0));
    const encryptedMessageBytes = Uint8Array.from(atob(encryptedMessage), (c) =>
      c.charCodeAt(0),
    );
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
