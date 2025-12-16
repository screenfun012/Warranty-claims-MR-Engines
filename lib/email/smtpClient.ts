/**
 * SMTP client wrapper for sending emails
 * Uses nodemailer for sending outbound emails
 */

import nodemailer from "nodemailer";
import { env } from "@/lib/config/env";
import { prisma } from "@/lib/db/prisma";
import { getEmailConfig } from "@/lib/config/envLoader";

export interface SendEmailParams {
  to: string | string[];
  cc?: string | string[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: Array<{
    filename: string;
    path?: string;
    content?: Buffer;
    contentType?: string;
  }>;
}

/**
 * Get a configured SMTP transporter
 * Checks database config first, then falls back to env vars
 */
async function getSmtpTransporter() {
  const dbConfig = await getEmailConfig();
  
  const host = dbConfig?.smtpHost || env.SMTP_HOST;
  const user = dbConfig?.smtpUser || env.SMTP_USER;
  const pass = dbConfig?.smtpPass || env.SMTP_PASS;
  const port = dbConfig?.smtpPort ?? env.SMTP_PORT;
  const tls = dbConfig?.smtpTls ?? env.SMTP_TLS;

  if (!host || !user) {
    throw new Error("SMTP configuration is missing. Please configure email settings in Settings page or set SMTP_HOST and SMTP_USER in your .env file.");
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: tls && port === 465,
    auth: {
      user,
      pass: pass || "",
    },
  });
}

/**
 * Send an email via SMTP
 * @param params - Email parameters
 * @returns Message info with messageId
 */
export async function sendEmail(params: SendEmailParams): Promise<{
  messageId: string;
  response: string;
}> {
  const transporter = await getSmtpTransporter();

  const dbConfig = await getEmailConfig();
  const smtpUser = dbConfig?.smtpUser || env.SMTP_USER;

  const mailOptions = {
    from: smtpUser,
    to: Array.isArray(params.to) ? params.to.join(", ") : params.to,
    cc: params.cc ? (Array.isArray(params.cc) ? params.cc.join(", ") : params.cc) : undefined,
    subject: params.subject,
    text: params.text,
    html: params.html,
    attachments: params.attachments,
  };

  const info = await transporter.sendMail(mailOptions);

  return {
    messageId: info.messageId,
    response: info.response,
  };
}

/**
 * Send an email and save it as an outbound EmailMessage in the database
 * @param params - Email parameters plus thread/claim info
 */
export async function sendEmailAndSave(params: SendEmailParams & {
  emailThreadId: string;
  claimId?: string;
}): Promise<{
  emailMessageId: string;
  messageId: string;
}> {
  // Send the email
  const sendResult = await sendEmail(params);

  // Save to database
  const dbConfig = await getEmailConfig();
  const smtpUser = dbConfig?.smtpUser || env.SMTP_USER;

  const emailMessage = await prisma.emailMessage.create({
    data: {
      emailThreadId: params.emailThreadId,
      direction: "OUTBOUND",
      from: smtpUser,
      to: Array.isArray(params.to) ? params.to.join(", ") : params.to,
      cc: params.cc ? (Array.isArray(params.cc) ? params.cc.join(", ") : params.cc) : undefined,
      subject: params.subject,
      bodyText: params.text,
      bodyHtml: params.html,
      messageId: sendResult.messageId,
      date: new Date(),
    },
  });

  return {
    emailMessageId: emailMessage.id,
    messageId: sendResult.messageId,
  };
}

