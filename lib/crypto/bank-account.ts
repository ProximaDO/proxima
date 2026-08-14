import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

function getEncryptionKey(): Buffer {
  const hex = process.env.BANK_ACCOUNT_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error("BANK_ACCOUNT_ENCRYPTION_KEY must be a 64-char hex string (32 bytes)");
  }
  return Buffer.from(hex, "hex");
}

export function encryptAccountNumber(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `v2:${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptAccountNumber(ciphertext: string): string {
  const parts = ciphertext.split(":");

  if (parts[0] === "v2") {
    const [, ivHex, authTagHex, encHex] = parts;
    if (!ivHex || !authTagHex || !encHex) throw new Error("Invalid ciphertext format");

    const key = getEncryptionKey();
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encHex, "hex")),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  }

  const [ivHex, encHex] = parts;
  if (!ivHex || !encHex) throw new Error("Invalid ciphertext format");
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, "hex");
  const decipher = createDecipheriv("aes-256-cbc", key, iv);
  const decrypted = Buffer.concat([decipher.update(Buffer.from(encHex, "hex")), decipher.final()]);
  return decrypted.toString("utf8");
}
