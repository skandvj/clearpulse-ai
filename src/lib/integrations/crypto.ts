import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { env } from "@/env";

const ALGORITHM = "aes-256-gcm";

function getEncryptionSecret(): string {
  return env.INTEGRATION_SETTINGS_ENCRYPTION_KEY ?? env.NEXTAUTH_SECRET;
}

function deriveKey(secret: string): Buffer {
  return createHash("sha256").update(secret).digest();
}

export function encryptIntegrationValue(value: string): string {
  const iv = randomBytes(12);
  const key = deriveKey(getEncryptionSecret());
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return JSON.stringify({
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    content: encrypted.toString("base64"),
  });
}

export function decryptIntegrationValue(payload: string): string {
  const parsed = JSON.parse(payload) as {
    iv: string;
    authTag: string;
    content: string;
  };

  const key = deriveKey(getEncryptionSecret());
  const decipher = createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(parsed.iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(parsed.authTag, "base64"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(parsed.content, "base64")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
