import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppointmentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type {
  AppointmentStatusDto,
  CreateAppointmentDto,
} from './appointments.dto';
import { AppointmentNotificationsService } from './appointment-notifications.service';

const ACTIVE_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.REQUESTED,
  AppointmentStatus.CONFIRMED,
];
const DAY_MS = 86_400_000;
/** Longest window a single availability query may cover. */
export const MAX_AVAILABILITY_RANGE_DAYS = 62;
/** Furthest in the future a consultation can be booked. */
export const MAX_BOOKING_HORIZON_DAYS = 120;

const TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  REQUESTED: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['COMPLETED', 'CANCELLED', 'NO_SHOW'],
  CANCELLED: [],
  COMPLETED: [],
  NO_SHOW: [],
};

@Injectable()
export class AppointmentsService {
  private readonly logger = new Logger(AppointmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: AppointmentNotificationsService,
    private readonly config: ConfigService,
  ) {}

  private get timeZone(): string {
    return (
      this.config.get<string>('APPOINTMENT_TIMEZONE') ?? 'Asia/Ho_Chi_Minh'
    );
  }

  async availability(from: Date, to: Date) {
    if (!(to > from))
      throw new BadRequestException('`to` must be after `from`');
    if (to.getTime() - from.getTime() > MAX_AVAILABILITY_RANGE_DAYS * DAY_MS)
      throw new BadRequestException(
        `Availability range cannot exceed ${MAX_AVAILABILITY_RANGE_DAYS} days`,
      );
    return this.slots(from, to);
  }

  private async slots(
    from: Date,
    to: Date,
    client: Prisma.TransactionClient = this.prisma,
  ) {
    const booked = await client.appointment.findMany({
      where: {
        startAt: { lt: to },
        endAt: { gt: from },
        status: { in: ACTIVE_STATUSES },
      },
      select: { startAt: true, endAt: true },
    });
    const duration = 30 * 60_000;
    const horizon = Date.now() + MAX_BOOKING_HORIZON_DAYS * DAY_MS;
    const slots = [];
    for (
      let start =
        Math.ceil(Math.max(from.getTime(), Date.now() + 1) / duration) *
        duration;
      start + duration <= Math.min(to.getTime(), horizon);
      start += duration
    ) {
      const end = start + duration;
      if (
        !booked.some(
          (item) =>
            item.startAt.getTime() < end && item.endAt.getTime() > start,
        )
      ) {
        slots.push({
          startAt: new Date(start).toISOString(),
          endAt: new Date(end).toISOString(),
          timezone: this.timeZone,
        });
      }
    }
    return slots;
  }

  async create(input: CreateAppointmentDto) {
    const startAt = new Date(input.startAt);
    const endAt = new Date(input.endAt);
    const now = Date.now();
    if (
      !Number.isFinite(startAt.getTime()) ||
      !Number.isFinite(endAt.getTime()) ||
      ![30, 45, 60, 90, 120].includes(
        (endAt.getTime() - startAt.getTime()) / 60_000,
      ) ||
      startAt.getTime() <= now ||
      startAt.getTime() > now + MAX_BOOKING_HORIZON_DAYS * DAY_MS
    )
      throw new UnprocessableEntityException('Invalid appointment time');

    let row;
    try {
      row = await this.prisma.$transaction(
        async (tx) => {
          // Customers propose their own time; no admin availability rule is required.
          // Serializable isolation also protects concurrent overlapping requests.
          const overlapping = await tx.appointment.findFirst({
            where: {
              startAt: { lt: endAt },
              endAt: { gt: startAt },
              status: { in: ACTIVE_STATUSES },
            },
            select: { id: true },
          });
          if (overlapping)
            throw new ConflictException(
              'This appointment slot is no longer available',
            );
          return tx.appointment.create({
            data: {
              name: input.name,
              email: input.email,
              phone: input.phone,
              company: input.company,
              topic: input.topic,
              message: input.message,
              projectSlug: input.projectSlug,
              startAt,
              endAt,
              timezone: input.timezone,
              locale: input.locale ?? 'vi',
              consentGiven: input.consent,
              consentAt: new Date(),
              privacyPolicyVersion: input.privacyPolicyVersion,
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      // P2034: serialization failure — a concurrent booking won the slot.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      )
        throw new ConflictException(
          'This appointment slot is no longer available',
        );
      throw error;
    }

    // Notify only after the transaction has committed.
    const notification = await this.notifications
      .notifyRequested(row)
      .catch((error: unknown) =>
        this.logger.error(
          'Appointment request notification failed',
          error instanceof Error ? error.stack : String(error),
        ),
      );
    return {
      success: true,
      message:
        input.locale === 'en'
          ? 'Your preferred time has been submitted for review.'
          : 'Đã nhận thời gian tư vấn bạn đề xuất. BIM4C sẽ xem xét và xác nhận.',
      notification,
      data: row,
    };
  }

  async list(status?: AppointmentStatus) {
    return this.prisma.appointment.findMany({
      where: status ? { status } : undefined,
      // Newest first so the cap drops the oldest history, never new requests;
      // the admin screen re-sorts on the client.
      orderBy: [{ startAt: 'desc' }, { id: 'asc' }],
      take: 500,
    });
  }

  async updateStatus(id: string, input: AppointmentStatusDto) {
    const current = await this.prisma.appointment.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Appointment not found');
    if (current.status === input.status) return current;
    if (!TRANSITIONS[current.status].includes(input.status))
      throw new ConflictException(
        `Cannot change an appointment from ${current.status} to ${input.status}`,
      );

    if (input.status === 'CONFIRMED') {
      const withCalendar = await this.notifications.confirm(current);
      const updated = await this.prisma.appointment.update({
        where: { id },
        data: {
          status: input.status,
          meetingUrl: withCalendar.meetingUrl,
          calendarEventId: withCalendar.calendarEventId,
        },
      });
      const notification = await this.notifications.notify(
        updated,
        'confirmed',
      );
      return { ...updated, notification };
    }
    const updated = await this.prisma.appointment.update({
      where: { id },
      data: { status: input.status },
    });
    const notification =
      input.status === 'CANCELLED'
        ? await this.notifications.cancel(updated)
        : input.status === 'COMPLETED' || input.status === 'NO_SHOW'
          ? await this.notifications.notify(
              updated,
              input.status === 'COMPLETED' ? 'completed' : 'no_show',
            )
          : undefined;
    return { ...updated, notification };
  }
}
