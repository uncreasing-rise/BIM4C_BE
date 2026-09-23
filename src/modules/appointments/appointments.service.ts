import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AppointmentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type { AppointmentStatusDto, AvailabilityExceptionDto, AvailabilityRuleDto, CreateAppointmentDto } from './appointments.dto';
import { AppointmentNotificationsService } from './appointment-notifications.service';

const ACTIVE_STATUSES: AppointmentStatus[] = [AppointmentStatus.REQUESTED, AppointmentStatus.CONFIRMED];
const timeToMinutes = (value: string) => { const [h, m] = value.split(':').map(Number); return h * 60 + m; };
const dateKey = (date: Date) => date.toISOString().slice(0, 10);

@Injectable()
export class AppointmentsService {
  constructor(private readonly prisma: PrismaService, private readonly notifications: AppointmentNotificationsService) {}

  async availability(from: Date, to: Date) {
    const rules = await this.prisma.availabilityRule.findMany({ where: { isActive: true } });
    const exceptions = await this.prisma.availabilityException.findMany({ where: { date: { gte: from, lte: to } } });
    const booked = await this.prisma.appointment.findMany({ where: { startAt: { lt: to }, endAt: { gt: from }, status: { in: ACTIVE_STATUSES } }, select: { startAt: true, endAt: true } });
    const exceptionMap = new Map(exceptions.map((item) => [dateKey(item.date), item]));
    const slots: { startAt: string; endAt: string; timezone: string }[] = [];
    const cursor = new Date(from); cursor.setHours(0, 0, 0, 0);
    const endDate = new Date(to); endDate.setHours(0, 0, 0, 0);
    while (cursor <= endDate) {
      const day = exceptionMap.get(dateKey(cursor));
      const dayRules = day ? (day.isAvailable && day.startTime && day.endTime ? [{ weekday: cursor.getDay(), startTime: day.startTime, endTime: day.endTime, durationMinutes: 30, bufferMinutes: 10 }] : []) : rules.filter((rule) => rule.weekday === cursor.getDay());
      for (const rule of dayRules) {
        for (let minute = timeToMinutes(rule.startTime); minute + rule.durationMinutes <= timeToMinutes(rule.endTime); minute += rule.durationMinutes + rule.bufferMinutes) {
          const start = new Date(cursor); start.setHours(Math.floor(minute / 60), minute % 60, 0, 0);
          const finish = new Date(start.getTime() + rule.durationMinutes * 60_000);
          if (start <= new Date() || start < from || finish > to) continue;
          if (booked.some((item) => item.startAt < finish && item.endAt > start)) continue;
          slots.push({ startAt: start.toISOString(), endAt: finish.toISOString(), timezone: 'Asia/Ho_Chi_Minh' });
        }
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    return slots;
  }

  async create(input: CreateAppointmentDto) {
    const startAt = new Date(input.startAt); const endAt = new Date(input.endAt);
    if (!Number.isFinite(startAt.getTime()) || !Number.isFinite(endAt.getTime()) || endAt <= startAt || startAt <= new Date()) throw new ConflictException('Invalid appointment time');
    return this.prisma.$transaction(async (tx) => {
      const overlap = await tx.appointment.findFirst({ where: { startAt: { lt: endAt }, endAt: { gt: startAt }, status: { in: ACTIVE_STATUSES } }, select: { id: true } });
      if (overlap) throw new ConflictException('This appointment slot is no longer available');
      const row = await tx.appointment.create({ data: { name: input.name, email: input.email, phone: input.phone, company: input.company, topic: input.topic, message: input.message, projectSlug: input.projectSlug, startAt, endAt, timezone: input.timezone, consentGiven: input.consent, consentAt: new Date(), privacyPolicyVersion: input.privacyPolicyVersion } });
      void this.notifications.notifyRequested(row).catch((error) => console.error('Appointment request notification failed', error));
      return { success: true, message: 'Your consultation has been requested. We will confirm it shortly.', data: row };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async rules() { return this.prisma.availabilityRule.findMany({ orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }] }); }
  async exceptions() { return this.prisma.availabilityException.findMany({ orderBy: { date: 'asc' } }); }
  async saveRule(input: AvailabilityRuleDto) { return this.prisma.availabilityRule.upsert({ where: { weekday_startTime_endTime: { weekday: input.weekday, startTime: input.startTime, endTime: input.endTime } }, create: input, update: input }); }
  async deleteRule(id: string) { await this.prisma.availabilityRule.delete({ where: { id } }); }
  async saveException(input: AvailabilityExceptionDto) { const date = new Date(input.date); return this.prisma.availabilityException.upsert({ where: { date }, create: { ...input, date }, update: { ...input, date } }); }
  async deleteException(id: string) { await this.prisma.availabilityException.delete({ where: { id } }); }
  async list(status?: AppointmentStatus) { return this.prisma.appointment.findMany({ where: status ? { status } : undefined, orderBy: { startAt: 'asc' }, take: 200 }); }
  async updateStatus(id: string, input: AppointmentStatusDto) {
    const current = await this.prisma.appointment.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Appointment not found');
    if (input.status === 'CONFIRMED' && current.status !== 'CONFIRMED') {
      const withCalendar = await this.notifications.confirm(current);
      return this.prisma.appointment.update({ where: { id }, data: { status: input.status, meetingUrl: withCalendar.meetingUrl, calendarEventId: withCalendar.calendarEventId } });
    }
    const updated = await this.prisma.appointment.update({ where: { id }, data: { status: input.status } });
    if (input.status === 'CANCELLED' && current.status !== 'CANCELLED') void this.notifications.cancel(updated).catch((error) => console.error('Appointment cancellation notification failed', error));
    return updated;
  }
}
