import nodemailer from "nodemailer";

type SendMailInput = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export type SendMailResult = {
  sent: boolean;
  previewUrl?: string;
  reason?: string;
};

export async function sendMail(input: SendMailInput): Promise<SendMailResult> {
  const host = process.env.SMTP_HOST;
  const from = process.env.SMTP_FROM ?? "ESN Forecast <no-reply@esnforecast.local>";

  if (!host) {
    console.info(`[mail:disabled] ${input.subject} -> ${input.to}\n${input.text}`);
    return { sent: false, reason: "SMTP_HOST not configured" };
  }

  const transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER && process.env.SMTP_PASS ? {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    } : undefined
  });

  const info = await transporter.sendMail({ from, to: input.to, subject: input.subject, text: input.text, html: input.html });
  return { sent: true, previewUrl: nodemailer.getTestMessageUrl(info) || undefined };
}
