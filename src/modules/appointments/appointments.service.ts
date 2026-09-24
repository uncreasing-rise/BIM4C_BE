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
  AvailabilityExceptionDto,
  AvailabilityRuleDto,
  CreateAppointmentDto,
} from './appointments.dto';
import { AppointmentNotificationsService } from './appointment-notifications.service';
import { generateSlots, timeToMinutes } from './availability';

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

  private async slots(from: Date, to: Date, client: Prisma.TransactionClient = this.prisma) {
    const [rules, exceptions, booked] = await Promise.all([
      client.availabilityRule.findMany({ where: { isActive: true } }),
      // Widen by a day so exceptions on the business-timezone edge days load.
      client.availabilityException.findMany({
        where: {
          date: {
            gte: new Date(from.getTime() - DAY_MS),
            lte: new Date(to.getTime() + DAY_MS),
          },
        },
      }),
      client.appointment.findMany({
        where: {
          startAt: { lt: to },
          endAt: { gt: from },
          status: { in: ACTIVE_STATUSES },
        },
        select: { startAt: true, endAt: true },
      }),
    ]);
    return generateSlots({
      rules,
      exceptions,
      booked,
      from,
      to,
      now: new Date(),
      timeZone: this.timeZone,
    });
  }

  async create(input: CreateAppointmentDto) {
    const startAt = new Date(input.startAt);
    const endAt = new Date(input.endAt);
    const now = Date.now();
    if (
      !Number.isFinite(startAt.getTime()) ||
      !Number.isFinite(endAt.getTime()) ||
      endAt <= startAt ||
      startAt.getTime() <= now ||
      startAt.getTime() > now + MAX_BOOKING_HORIZON_DAYS * DAY_MS
    )
      throw new UnprocessableEntityException('Invalid appointment time');

    let row;
    try {
      row = await this.prisma.$transaction(
        async (tx) => {
          // The requested range must be exactly one currently offered slot;
          // otherwise a client could book arbitrary (e.g. multi-day) blocks.
          const offered = await this.slots(
            new Date(startAt.getTime() - 1),
            new Date(endAt.getTime() + 1),
            tx,
          );
          const matches = offered.some(
            (slot) =>
              slot.startAt === startAt.toISOString() &&
              slot.endAt === endAt.toISOString(),
          );
          if (!matches)
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
    void this.notifications
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
        'Your consultation has been requested. We will confirm it shortly.',
      data: row,
    };
  }

  async rules() {
    return this.prisma.availabilityRule.findMany({
      orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }],
    });
  }
  async exceptions() {
    return this.prisma.availabilityException.findMany({
      orderBy: { date: 'asc' },
    });
  }
  async saveRule(input: AvailabilityRuleDto) {
    if (timeToMinutes(input.endTime) <= timeToMinutes(input.startTime))
      throw new UnprocessableEntityException('endTime must be after startTime');
    return this.prisma.availabilityRule.upsert({
      where: {
        weekday_startTime_endTime: {
          weekday: input.weekday,
          startTime: input.startTime,
          endTime: input.endTime,
        },
      },
      create: input,
      update: input,
    });
  }
  async deleteRule(id: string) {
    await this.prisma.availabilityRule.deleteMany({ where: { id } });
  }
  async saveException(input: AvailabilityExceptionDto) {
    if (input.isAvailable) {
      if (!input.startTime || !input.endTime)
        throw new UnprocessableEntityException(
          'startTime and endTime are required when the day is available',
        );
      if (timeToMinutes(input.endTime) <= timeToMinutes(input.startTime))
        throw new UnprocessableEntityException(
          'endTime must be after startTime',
        );
    }
    const date = new Date(`${input.date.slice(0, 10)}T00:00:00.000Z`);
    return this.prisma.availabilityException.upsert({
      where: { date },
      create: { ...input, date },
      update: { ...input, date },
    });
  }
  async deleteException(id: string) {
    await this.prisma.availabilityException.deleteMany({ where: { id } });
  }
  async list(status?: AppointmentStatus) {
    return this.prisma.appointment.findMany({
      where: status ? { status } : undefined,
      orderBy: { startAt: 'asc' },
      take: 200,
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
      return this.prisma.appointment.update({
        where: { id },
        data: {
          status: input.status,
          meetingUrl: withCalendar.meetingUrl,
          calendarEventId: withCalendar.calendarEventId,
        },
      });
    }
    const updated = await this.prisma.appointment.update({
      where: { id },
      data: { status: input.status },
    });
    if (input.status === 'CANCELLED')
      void this.notifications
        .cancel(updated)
        .catch((error: unknown) =>
          this.logger.error(
            'Appointment cancellation notification failed',
            error instanceof Error ? error.stack : String(error),
          ),
        );
    return updated;
  }
}
