// @ts-nocheck
/**
 * SMTP client wrapper for sending emails
 * Uses nodemailer for sending outbound emails
 */

import nodemailer from "nodemailer";
import { getPrisma } from "@/lib/db/prisma";
import { getEmailConfig } from "@/lib/config/envLoader";

export interface SendEmailParams {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  text?: string;
  html?: string;
  headers?: Record<string, string>;
  attachments?: Array<{
    filename: string;
    path?: string;
    content?: Buffer;
    contentType?: string;
  }>;
}

/**
 * Get a configured SMTP transporter
 */
function getSmtpTransporter() {
  const config = getEmailConfig();
  
  const host = config.smtpServer;
  const user = config.smtpUserEmail;
  const pass = config.smtpUserPass;
  const port = config.smtpPort;
  const tls = config.smtpTls;

  if (!host || !user) {
    throw new Error("SMTP configuration is missing. Please set SMTP_SERVER and SMTP_USER_EMAIL in your .env file.");
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: tls && port === 465,
    auth: {
      user,
      pass: pass || "",
    },
    // Disable strict TLS for proxy connections (Tailscale proxy)
    tls: {
      rejectUnauthorized: false, // Allow self-signed certificates through proxy
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
  const transporter = getSmtpTransporter();
  const config = getEmailConfig();

  const mailOptions = {
    from: config.smtpUserEmail,
    to: Array.isArray(params.to) ? params.to.join(", ") : params.to,
    cc: params.cc ? (Array.isArray(params.cc) ? params.cc.join(", ") : params.cc) : undefined,
    bcc: params.bcc ? (Array.isArray(params.bcc) ? params.bcc.join(", ") : params.bcc) : undefined,
    subject: params.subject,
    text: params.text,
    html: params.html,
    headers: params.headers,
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
  const prisma = await getPrisma();
  const config = getEmailConfig();

  const emailMessage = await prisma.emailMessage.create({
    data: {
      emailThreadId: params.emailThreadId,
      direction: "OUTBOUND",
      from: config.smtpUserEmail,
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

