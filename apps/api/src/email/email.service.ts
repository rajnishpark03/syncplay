import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

/**
 * Sends transactional email (currently just the login OTP) over SMTP.
 *
 * Works with any SMTP provider; the zero-cost default is a Gmail account with
 * an App Password (SMTP_HOST=smtp.gmail.com, SMTP_PORT=587). The transporter
 * is created lazily so the app boots fine in dev mode when no SMTP creds are
 * configured.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter | null = null;

  constructor(private readonly config: ConfigService) {}

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
      secure: port === 465, // 465 = implicit TLS, 587 = STARTTLS
      auth: { user, pass },
    });
    return this.transporter;
  }

  async sendOtp(to: string, code: string, ttlSeconds: number): Promise<void> {
    const transporter = this.getTransporter();
    if (!transporter) {
      throw new Error('Email transport not configured');
    }

    const minutes = Math.round(ttlSeconds / 60);
    const from = this.config.get<string>('email.from');

    await transporter.sendMail({
      from,
      to,
      subject: `Your SyncPlay code: ${code}`,
      text: `Your SyncPlay verification code is ${code}. It expires in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
      html: this.otpHtml(code, minutes),
    });

    this.logger.log(`OTP email sent to ${to}`);
  }

  private otpHtml(code: string, minutes: number): string {
    return `
      <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:440px;margin:0 auto;padding:32px;background:#170a16;border-radius:16px;color:#fff">
        <h1 style="margin:0 0 8px;font-size:20px">SyncPlay</h1>
        <p style="margin:0 0 24px;color:#ffffffaa;font-size:14px">Listen &amp; watch together, perfectly in sync.</p>
        <p style="margin:0 0 12px;color:#ffffffcc;font-size:14px">Your verification code is:</p>
        <div style="font-size:34px;font-weight:700;letter-spacing:10px;color:#ff86a9;background:#ffffff0d;border-radius:12px;padding:18px;text-align:center">${code}</div>
        <p style="margin:20px 0 0;color:#ffffff77;font-size:12px">This code expires in ${minutes} minute${minutes === 1 ? '' : 's'}. If you didn't request it, you can ignore this email.</p>
      </div>`;
  }
}
