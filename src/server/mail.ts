import "server-only";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import nodemailer from "nodemailer";

export const MAIL_FROM = "Skill Governance <strayapps.co@gmail.com>";
const MAILBOX = "strayapps.co@gmail.com";

export type OutboundMail = { to: string; subject: string; text: string };

export async function sendMail(message: OutboundMail): Promise<void> {
  if (process.env.MAIL_DRIVER === "test") {
    const dir = path.join(process.cwd(), "tmp");
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "last-mail.json"), JSON.stringify(message), "utf8");
    return;
  }
  const pass = (process.env.SMTP_PASS ?? "").replaceAll(" ", "");
  if (!pass) {
    throw new Error("SMTP_PASS is not set.");
  }
  const transport = nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.SMTP_USER || MAILBOX, pass },
  });
  await transport.sendMail({
    from: process.env.MAIL_FROM || MAIL_FROM,
    to: message.to,
    subject: message.subject,
    text: message.text,
    replyTo: MAILBOX,
  });
}
