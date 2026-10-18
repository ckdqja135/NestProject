import { Injectable, Logger } from '@nestjs/common';
import nodemailer, { Transporter } from 'nodemailer';

// 이메일 보내기. SMTP_URL 이 없으면 꺼져 있다 (보내지 않고 false).
@Injectable()
export class MailService {
  private logger = new Logger('MailService');
  private transporter: Transporter | null | undefined;

  private getTransporter() {
    if (this.transporter === undefined) {
      const url = process.env.SMTP_URL;
      this.transporter = url ? nodemailer.createTransport(url) : null;
    }
    return this.transporter;
  }

  isEnabled() {
    return !!this.getTransporter();
  }

  async send(message: { to: string; subject: string; text: string }) {
    const transporter = this.getTransporter();
    if (!transporter) {
      return false;
    }
    try {
      await transporter.sendMail({
        from: process.env.MAIL_FROM || 'Shlack <no-reply@shlack.local>',
        ...message,
      });
      return true;
    } catch (error) {
      this.logger.error(`메일을 보내지 못했습니다: ${error?.message}`);
      return false;
    }
  }
}
