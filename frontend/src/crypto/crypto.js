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
export async function decryptMessage(encryptedData, privateKeyBase64) {
  try {
    const { encryptedMessage, encryptedAesKey, iv } = encryptedData;

    const privateKey = await importPrivateKey(privateKeyBase64);

    const encryptedAesKeyBytes = Uint8Array.from(atob(encryptedAesKey), (c) =>
      c.charCodeAt(0),
    );

    const decryptedAesKeyBytes = await window.crypto.subtle.decrypt(
      { name: "RSA-OAEP" },
      privateKey,
      encryptedAesKeyBytes,
    );

    const aesKey = await window.crypto.subtle.importKey(
      "raw",
      decryptedAesKeyBytes,
      { name: "AES-GCM" },
      false,
      ["decrypt"],
    );

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
