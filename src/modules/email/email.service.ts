import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { renderEmail, type EmailContent } from './email-template';

export type EmailDelivery = 'sent' | 'failed' | 'skipped';
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  constructor(private readonly config: ConfigService) {}

  get adminEmail() {
    return (
      this.config.get<string>('NOTIFICATION_ADMIN_EMAIL') ||
      this.config.get<string>('APPOINTMENT_ADMIN_EMAIL')
    );
  }
  get supportEmail() {
    return (
      this.config.get<string>('MAIL_REPLY_TO') ||
      this.adminEmail ||
      'bim4c.lab@gmail.com'
    );
  }
  url(path: string) {
    return new URL(
      path,
      this.config.get<string>('FRONTEND_URL') || 'https://www.bim4c.vn',
    ).href;
  }

  /** Await delivery attempts so a serverless response cannot discard the task. Never undo saved enquiries on mail failure. */
  async send(input: {
    to?: string;
    subject: string;
    key: string;
    content: EmailContent;
    replyTo?: string;
  }): Promise<EmailDelivery> {
    if (
      !input.to ||
      this.config.get('EMAIL_PROVIDER') !== 'resend' ||
      !this.config.get('RESEND_API_KEY')
    ) {
      this.logger.warn(
        `Email skipped (${input.key}): recipient or provider not configured`,
      );
      return 'skipped';
    }
    const rendered = renderEmail(
      input.content,
      this.url('/'),
      this.supportEmail,
    );
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.config.getOrThrow<string>('RESEND_API_KEY')}`,
            'Content-Type': 'application/json',
            'Idempotency-Key': input.key,
          },
          body: JSON.stringify({
            from: this.config.getOrThrow<string>('MAIL_FROM'),
            to: [input.to],
            reply_to: input.replyTo || this.supportEmail,
            subject: input.subject,
            ...rendered,
          }),
          signal: AbortSignal.timeout(8_000),
        });
        if (response.ok) return 'sent';
        if (response.status !== 429 && response.status < 500) {
          this.logger.error(
            `Email rejected (${input.key}): HTTP ${response.status}`,
          );
          return 'failed';
        }
      } catch {
        // Do not log recipient data, message bodies, provider responses or keys.
      }
      if (attempt === 0)
        await new Promise((resolve) => setTimeout(resolve, 300));
    }
    this.logger.error(
      `Email delivery failed (${input.key}) after two attempts`,
    );
    return 'failed';
  }
}
