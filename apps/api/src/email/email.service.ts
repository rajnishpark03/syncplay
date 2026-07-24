import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

/**
 * Sends transactional email (currently just the login OTP).
 *
 * Two backends, chosen automatically:
 *  - Resend (HTTP API) if RESEND_API_KEY is set — preferred in the cloud
 *    because it uses HTTPS (port 443), which hosts like Render's free tier
 *    don't block. Gmail SMTP (ports 587/465) IS blocked there.
 *  - SMTP (nodemailer) otherwise — great for local dev / self-hosting.
 *
 * Timeouts are set on SMTP so a blocked/slow port fails fast instead of
 * hanging the login request.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter | null = null;

  constructor(private readonly config: ConfigService) {}

  async sendOtp(to: string, code: string, ttlSeconds: number): Promise<void> {
    const minutes = Math.round(ttlSeconds / 60);
    const from = this.config.get<string>('email.from')!;
    const subject = `Your Orbit code: ${code}`;
    const text = `Your Orbit verification code is ${code}. It expires in ${minutes} minute${minutes === 1 ? '' : 's'}.`;
    const html = this.otpHtml(code, minutes);

    // Brevo is preferred when configured: single-sender verification (no
    // domain needed) means OTPs can go to ANY recipient, over HTTPS.
    const brevoKey = this.config.get<string>('email.brevoApiKey');
    if (brevoKey) {
      await this.sendViaBrevo(brevoKey, { from, to, subject, text, html });
      this.logger.log(`OTP email sent to ${to} via Brevo`);
      return;
    }

    const resendKey = this.config.get<string>('email.resendApiKey');
    if (resendKey) {
      await this.sendViaResend(resendKey, { from, to, subject, text, html });
      this.logger.log(`OTP email sent to ${to} via Resend`);
      return;
    }

    const transporter = this.getTransporter();
    if (!transporter) throw new Error('Email transport not configured');
    await transporter.sendMail({ from, to, subject, text, html });
    this.logger.log(`OTP email sent to ${to} via SMTP`);
  }

  /** Parses a `Name <email@x>` or bare `email@x` string into Brevo's sender shape. */
  private parseSender(from: string): { email: string; name?: string } {
    const match = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(from);
    if (match) return { name: match[1] || undefined, email: match[2] };
    return { email: from.trim() };
  }

  private async sendViaBrevo(
    apiKey: string,
    msg: { from: string; to: string; subject: string; text: string; html: string },
  ): Promise<void> {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        sender: this.parseSender(msg.from),
        to: [{ email: msg.to }],
        subject: msg.subject,
        htmlContent: msg.html,
        textContent: msg.text,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Brevo API error ${res.status}: ${body}`);
    }
  }

  private async sendViaResend(
    apiKey: string,
    msg: { from: string; to: string; subject: string; text: string; html: string },
  ): Promise<void> {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: msg.from, to: [msg.to], subject: msg.subject, text: msg.text, html: msg.html }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Resend API error ${res.status}: ${body}`);
    }
  }

  private getTransporter(): Transporter | null {
    if (this.transporter) return this.transporter;

    const host = this.config.get<string>('email.smtp.host');
    const user = this.config.get<string>('email.smtp.user');
    const pass = this.config.get<string>('email.smtp.pass');
    if (!host || !user || !pass) {
      this.logger.warn('SMTP is not fully configured — cannot send email');
      return null;
    }

    const port = this.config.get<number>('email.smtp.port') ?? 587;
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
      connectionTimeout: 12_000,
      greetingTimeout: 8_000,
      socketTimeout: 12_000,
    });
    return this.transporter;
  }

  private otpHtml(code: string, minutes: number): string {
    return `
      <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:440px;margin:0 auto;padding:32px;background:#170a16;border-radius:16px;color:#fff">
        <h1 style="margin:0 0 8px;font-size:20px">Orbit</h1>
        <p style="margin:0 0 24px;color:#ffffffaa;font-size:14px">Listen &amp; watch together, perfectly in sync.</p>
        <p style="margin:0 0 12px;color:#ffffffcc;font-size:14px">Your verification code is:</p>
        <div style="font-size:34px;font-weight:700;letter-spacing:10px;color:#ff86a9;background:#ffffff0d;border-radius:12px;padding:18px;text-align:center">${code}</div>
        <p style="margin:20px 0 0;color:#ffffff77;font-size:12px">This code expires in ${minutes} minute${minutes === 1 ? '' : 's'}. If you didn't request it, you can ignore this email.</p>
      </div>`;
  }
}
