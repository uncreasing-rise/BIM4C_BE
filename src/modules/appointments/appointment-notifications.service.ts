import { Injectable } from '@nestjs/common';
import type { Appointment } from '@prisma/client';
import { EmailService } from '../email/email.service';
import {
  appointmentEmail,
  type AppointmentEmailKind,
} from './appointment-email';

/**
 * Emails the customer and the BIM4C inbox when an appointment is requested or
 * changes status. There is no calendar integration: BIM4C arranges the meeting
 * itself and the confirmation says so.
 */
@Injectable()
export class AppointmentNotificationsService {
  constructor(private readonly email: EmailService) {}

  notifyRequested(appointment: Appointment) {
    return this.notify(appointment, 'requested');
  }

  async notify(a: Appointment, kind: AppointmentEmailKind) {
    const customerContent = appointmentEmail(
      a,
      kind,
      false,
      this.email.url('/'),
    );
    const adminContent = appointmentEmail(a, kind, true, this.email.url('/'));
    const [customer, admin] = await Promise.all([
      this.email.send({
        to: a.email,
        subject: customerContent.title + ' | BIM4C',
        key: 'appointment/' + a.id + '/' + kind + '/customer',
        content: customerContent,
      }),
      this.email.send({
        to: this.email.adminEmail,
        replyTo: a.email,
        subject: adminContent.title,
        key: 'appointment/' + a.id + '/' + kind + '/admin',
        content: adminContent,
      }),
    ]);
    return { customer, admin };
  }
}
