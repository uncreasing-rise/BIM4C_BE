/** Render fictional fixtures only. This script never sends mail or reads deployment credentials. */
import 'reflect-metadata';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Appointment } from '@prisma/client';
import { appointmentEmail } from '../src/modules/appointments/appointment-email';
import {
  renderEmail,
  type EmailContent,
} from '../src/modules/email/email-template';
import { SubmissionNotificationsService } from '../src/modules/email/submission-notifications.service';

const directory = join(process.cwd(), '.email-previews');
mkdirSync(directory, { recursive: true });
const links: string[] = [];
function save(name: string, content: EmailContent) {
  const { html, text } = renderEmail(
    content,
    'https://www.bim4c.vn',
    'bim4c.lab@gmail.com',
  );
  writeFileSync(join(directory, `${name}.html`), html);
  writeFileSync(join(directory, `${name}.txt`), text);
  links.push(name);
}
async function main() {
  for (const locale of ['vi', 'en'] as const) {
    const appointment = {
      id: 'preview-appointment',
      name: locale === 'vi' ? 'Nguyễn Minh Anh' : 'Alex Morgan',
      email: 'alex@example.com',
      phone: '+1 202 555 0100',
      company: 'Example Studio',
      locale,
      topic:
        locale === 'vi'
          ? 'Triển khai BIM cho dự án công trình xanh'
          : 'BIM implementation for a sustainable building project',
      message:
        locale === 'vi'
          ? 'Trao đổi quy trình phối hợp mô hình và bàn giao dữ liệu.'
          : 'Discuss model coordination and digital handover requirements.',
      startAt: new Date('2026-10-05T09:00:00Z'),
      endAt: new Date('2026-10-05T09:45:00Z'),
      timezone: locale === 'vi' ? 'Asia/Ho_Chi_Minh' : 'Europe/London',
    } as Appointment;
    for (const kind of [
      'requested',
      'confirmed',
      'cancelled',
      'completed',
      'no_show',
    ] as const) {
      save(
        `${locale}-appointment-${kind}`,
        appointmentEmail(appointment, kind, false, 'https://www.bim4c.vn'),
      );
    }
    save(
      `${locale}-appointment-admin`,
      appointmentEmail(appointment, 'requested', true, 'https://www.bim4c.vn'),
    );
    let sequence = 0;
    const notifications = new SubmissionNotificationsService({
      adminEmail: 'team@example.com',
      url: (path: string) => new URL(path, 'https://www.bim4c.vn').href,
      send: (input: { content: EmailContent }) => {
        save(`${locale}-submission-${++sequence}`, input.content);
        return Promise.resolve('sent');
      },
    } as never);
    await notifications.enquiry('contact', appointment, locale);
    await notifications.enquiry(
      'course',
      appointment,
      locale,
      locale === 'vi'
        ? 'Nền tảng BIM cho nhóm dự án'
        : 'BIM Foundations for Project Teams',
    );
    await notifications.newsletter(
      'preview-newsletter',
      appointment.email,
      locale,
    );
  }
  writeFileSync(
    join(directory, 'index.html'),
    `<!doctype html><html lang="en"><meta charset="utf-8"><title>BIM4C email previews</title><body style="font:16px Arial;padding:32px;background:#f1f5f9"><h1>BIM4C · Email previews</h1><p>Fictional fixtures. No emails sent.</p><ul>${links.map((name) => `<li style="margin:12px"><a href="${name}.html">${name}</a> · <a href="${name}.txt">Plain text</a></li>`).join('')}</ul></body></html>`,
  );
  console.log(`Rendered ${links.length} email previews in ${directory}`);
}
void main();
