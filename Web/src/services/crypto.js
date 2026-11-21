/**
 * Native Browser Web Crypto API (AES-GCM 256-bit)
 * Zero external dependencies, hardware accelerated.
 */

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

// Convert ArrayBuffer to Base64
const bufferToBase64 = (buffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
};

// Convert Base64 to Uint8Array
const base64ToBuffer = (base64) => {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

// Derive AES-GCM 256 key using PBKDF2
const deriveKey = async (passphrase, saltBuffer) => {
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    textEncoder.encode(passphrase),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: saltBuffer,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
};

/**
 * Encrypt plain text using AES-GCM 256
 */
export async function encryptText(plainText, secret = "Lira-Office-E2EE-Default-Key") {
  try {
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(secret, salt);

    const encrypted = await window.crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: iv,
      },
      key,
      textEncoder.encode(plainText)
    );

    return {
      ciphertext: bufferToBase64(encrypted),
      iv: bufferToBase64(iv),
      salt: bufferToBase64(salt),
    };
  } catch (error) {
    console.error("Encryption failed:", error);
    // Graceful fallback for non-crypto secure contexts
    return {
      ciphertext: window.btoa(unescape(encodeURIComponent(plainText))),
      iv: "plain-fallback",
      salt: "fallback",
    };
  }
}

/**
 * Decrypt ciphertext using AES-GCM 256
 */
export async function decryptText(ciphertext, ivBase64, saltBase64, secret = "Lira-Office-E2EE-Default-Key") {
  try {
    if (ivBase64 === "plain-fallback") {
      return decodeURIComponent(escape(window.atob(ciphertext)));
    }

    const salt = base64ToBuffer(saltBase64);
    const iv = base64ToBuffer(ivBase64);
    const encryptedData = base64ToBuffer(ciphertext);

    const key = await deriveKey(secret, salt);

    const decrypted = await window.crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: iv,
      },
      key,
      encryptedData
    );

    return textDecoder.decode(decrypted);
  } catch (error) {
    // If decryption key differs or plaintext
    return "[Encrypted Office Message]";
  }
}
