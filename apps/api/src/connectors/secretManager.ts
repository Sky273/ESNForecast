import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "../db";

const algorithm = "aes-256-gcm";

export class SecretManager {
  private key: Buffer;

  constructor(keyMaterial = process.env.SECRET_ENCRYPTION_KEY ?? "dev-only-change-me") {
    this.key = createHash("sha256").update(keyMaterial).digest();
  }

  encryptSecret(value: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv(algorithm, this.key, iv);
    const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
  }

  decryptSecret(payload?: string | null) {
    if (!payload) return undefined;
    const [ivRaw, tagRaw, encryptedRaw] = payload.split(":");
    const decipher = createDecipheriv(algorithm, this.key, Buffer.from(ivRaw, "base64"));
    decipher.setAuthTag(Buffer.from(tagRaw, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(encryptedRaw, "base64")), decipher.final()]).toString("utf8");
  }

  rotateSecret(payload: string, nextKeyMaterial: string) {
    const value = this.decryptSecret(payload);
    if (!value) return undefined;
    return new SecretManager(nextKeyMaterial).encryptSecret(value);
  }

  maskSecret(value?: string | null) {
    if (!value) return "";
    if (value.length <= 8) return "********";
    return `${value.slice(0, 4)}********${value.slice(-4)}`;
  }

  async storeProviderToken(input: {
    organizationId: string;
    companyId: string;
    connectorId: string;
    provider: string;
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: Date;
    scopes?: unknown;
    tokenType?: string;
    providerAccountId?: string;
  }) {
    const existing = await prisma.providerToken.findFirst({ where: { connectorId: input.connectorId, revokedAt: null } });
    const data = {
      organizationId: input.organizationId,
      companyId: input.companyId,
      connectorId: input.connectorId,
      provider: input.provider,
      accessTokenEncrypted: input.accessToken ? this.encryptSecret(input.accessToken) : undefined,
      refreshTokenEncrypted: input.refreshToken ? this.encryptSecret(input.refreshToken) : undefined,
      expiresAt: input.expiresAt,
      scopes: input.scopes as any,
      tokenType: input.tokenType,
      providerAccountId: input.providerAccountId
    };
    const row = existing
      ? await prisma.providerToken.update({ where: { id: existing.id }, data })
      : await prisma.providerToken.create({ data });
    await this.logAccess(input.organizationId, input.provider, input.connectorId, "store_token");
    return row;
  }

  async getProviderToken(connectorId: string, userId?: string) {
    const token = await prisma.providerToken.findFirst({ where: { connectorId, revokedAt: null }, orderBy: { createdAt: "desc" } });
    if (!token) return undefined;
    await this.logAccess(token.organizationId, token.provider, connectorId, "decrypt_token", userId);
    return {
      ...token,
      accessToken: this.decryptSecret(token.accessTokenEncrypted),
      refreshToken: this.decryptSecret(token.refreshTokenEncrypted)
    };
  }

  async revokeProviderToken(connectorId: string, userId?: string) {
    const rows = await prisma.providerToken.updateMany({ where: { connectorId, revokedAt: null }, data: { revokedAt: new Date() } });
    await this.logAccess(undefined, undefined, connectorId, "revoke_token", userId);
    return rows.count;
  }

  verifySignature(expected: string, received?: string) {
    if (!received) return false;
    const left = Buffer.from(expected);
    const right = Buffer.from(received);
    return left.length === right.length && timingSafeEqual(left, right);
  }

  private async logAccess(organizationId: string | undefined, provider: string | undefined, connectorId: string | undefined, action: string, userId?: string) {
    await prisma.secretAccessLog.create({ data: { organizationId, provider, connectorId, action, userId, sensitivityLevel: "secret" } });
  }
}

export const secretManager = new SecretManager();
