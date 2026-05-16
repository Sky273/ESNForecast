import { buildAccountActivationEmail } from "@esn-forecast/shared";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "../../db";
import { sendMail } from "./mailService";

const ACTIVATION_TTL_HOURS = Number(process.env.ACCOUNT_ACTIVATION_TTL_HOURS ?? 72);

export function hashActivationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createActivationToken(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + ACTIVATION_TTL_HOURS * 60 * 60 * 1000);
  await prisma.accountActivationToken.create({
    data: {
      userId,
      tokenHash: hashActivationToken(token),
      expiresAt
    }
  });
  return { token, expiresAt };
}

export async function sendAccountActivationEmail(user: { id: string; email: string; name: string }) {
  const { token, expiresAt } = await createActivationToken(user.id);
  const email = buildAccountActivationEmail({
    appName: "ESN Forecast",
    baseUrl: process.env.APP_PUBLIC_URL ?? "http://localhost:5173",
    token,
    userName: user.name
  });
  console.info(`[account-activation] ${user.email} -> ${email.activationUrl}`);
  const delivery = await sendMail({ to: user.email, subject: email.subject, text: email.text, html: email.html }).catch((error) => ({
    sent: false,
    reason: error instanceof Error ? error.message : "mail_send_failed"
  }));
  return { ...delivery, activationUrl: email.activationUrl, expiresAt };
}

export async function consumeActivationToken(token: string) {
  const tokenHash = hashActivationToken(token);
  const row = await prisma.accountActivationToken.findUnique({ where: { tokenHash }, include: { user: true } });
  if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) return null;
  await prisma.accountActivationToken.update({ where: { id: row.id }, data: { usedAt: new Date() } });
  return row.user;
}
