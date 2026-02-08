import { webcrypto } from "node:crypto";

/**
 * Hash a password using PBKDF2 with SHA-256.
 * Returns "salt:hash" as hex strings.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = webcrypto.getRandomValues(new Uint8Array(16));
  const encoder = new TextEncoder();
  const keyMaterial = await webcrypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const hash = await webcrypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    256,
  );
  const saltHex = Buffer.from(salt).toString("hex");
  const hashHex = Buffer.from(hash).toString("hex");
  return `${saltHex}:${hashHex}`;
}

/**
 * Verify a password against a stored "salt:hash" string.
 */
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [saltHex, storedHashHex] = stored.split(":");
  const salt = Buffer.from(saltHex, "hex");
  const encoder = new TextEncoder();
  const keyMaterial = await webcrypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const hash = await webcrypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    256,
  );
  const hashHex = Buffer.from(hash).toString("hex");
  return hashHex === storedHashHex;
}
