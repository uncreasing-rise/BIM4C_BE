import {
  BadRequestException,
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AppointmentsService } from './appointments.service';

const rule = {
  weekday: 1,
  startTime: '09:00',
  endTime: '10:00',
  durationMinutes: 30,
  bufferMinutes: 0,
  isActive: true,
};
const slotStart = '2026-10-05T02:00:00.000Z'; // Monday 09:00 in Vietnam
const slotEnd = '2026-10-05T02:30:00.000Z';

function setup() {
  const client = {
    availabilityRule: { findMany: jest.fn().mockResolvedValue([rule]) },
    availabilityException: { findMany: jest.fn().mockResolvedValue([]) },
    appointment: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn().mockImplementation(({ data }: { data: object }) => ({
        id: 'a1',
        ...data,
      })),
    },
  };
  const prisma = {
    ...client,
    $transaction: jest.fn<Promise<unknown>, [(tx: typeof client) => unknown]>(
      (fn) => Promise.resolve(fn(client)),
    ),
  };
  const notifications = {
    notifyRequested: jest.fn().mockResolvedValue(undefined),
    notify: jest.fn().mockResolvedValue({ customer: 'sent', admin: 'sent' }),
  };
  const config = { get: jest.fn(() => 'Asia/Ho_Chi_Minh') };
  const service = new AppointmentsService(
    prisma as never,
    notifications as never,
    config as never,
  );
  return { service, prisma, client, notifications };
}

const booking = (startAt: string, endAt: string) =>
  ({
    name: 'Nguyen Van A',
    email: 'a@example.com',
    topic: 'BIM consulting',
    startAt,
    endAt,
    timezone: 'Asia/Ho_Chi_Minh',
    consent: true,
    privacyPolicyVersion: '2026-08-20',
  }) as never;

describe('AppointmentsService', () => {
  beforeAll(() =>
    jest.useFakeTimers({ now: new Date('2026-10-01T00:00:00Z') }),
  );
  afterAll(() => jest.useRealTimers());

  it('rejects availability ranges that are inverted or too long', async () => {
    const { service } = setup();
    await expect(
      service.availability(new Date('2026-10-05'), new Date('2026-10-04')),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.availability(new Date('2026-10-01'), new Date('2027-10-01')),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('books an offered slot and notifies after commit', async () => {
    const { service, client, notifications } = setup();
    const result = await service.create(booking(slotStart, slotEnd));
    expect(result.success).toBe(true);
    expect(client.appointment.create).toHaveBeenCalledTimes(1);
    expect(notifications.notifyRequested).toHaveBeenCalledTimes(1);
  });

  it('refuses unsupported durations before touching the database', async () => {
    const { service, client } = setup();
    // A three-hour block starting at a valid slot start.
    await expect(
      service.create(booking(slotStart, '2026-10-05T05:00:00.000Z')),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(client.appointment.create).not.toHaveBeenCalled();
  });

  it('rejects past and far-future bookings before touching the database', async () => {
    const { service, prisma } = setup();
    await expect(
      service.create(
        booking('2026-09-01T02:00:00.000Z', '2026-09-01T02:30:00.000Z'),
      ),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    await expect(
      service.create(
        booking('2027-10-04T02:00:00.000Z', '2027-10-04T02:30:00.000Z'),
      ),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('maps a serialization failure to 409 and sends no email', async () => {
    const { service, prisma, notifications } = setup();
    prisma.$transaction.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('conflict', {
        code: 'P2034',
        clientVersion: 'test',
      }),
    );
    await expect(
      service.create(booking(slotStart, slotEnd)),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(notifications.notifyRequested).not.toHaveBeenCalled();
  });

  it('enforces the status state machine', async () => {
    const { service, client } = setup();
    client.appointment.findUnique.mockResolvedValue({
      id: 'a1',
      status: 'COMPLETED',
    });
    await expect(
      service.updateStatus('a1', { status: 'REQUESTED' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(client.appointment.update).not.toHaveBeenCalled();
  });

  it('accepts customer-selected times outside old availability rules', async () => {
    const { service, client } = setup();
    await service.create(
      booking('2026-10-04T20:13:00.000Z', '2026-10-04T20:58:00.000Z'),
    );
    expect(client.appointment.create).toHaveBeenCalledTimes(1);
    expect(client.availabilityRule.findMany).not.toHaveBeenCalled();
    expect(client.availabilityException.findMany).not.toHaveBeenCalled();
  });

  it('rejects overlapping active bookings without sending notifications', async () => {
    const { service, client, notifications } = setup();
    client.appointment.findFirst.mockResolvedValue({ id: 'existing' });
    await expect(
      service.create(booking(slotStart, slotEnd)),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(client.appointment.findFirst).toHaveBeenCalledWith({
      where: {
        startAt: { lt: new Date(slotEnd) },
        endAt: { gt: new Date(slotStart) },
        status: { in: ['REQUESTED', 'CONFIRMED'] },
      },
      select: { id: true },
    });
    expect(client.appointment.create).not.toHaveBeenCalled();
    expect(notifications.notifyRequested).not.toHaveBeenCalled();
  });

  it('persists the requested email language and sends confirmations only after status is saved', async () => {
    const { service, client, notifications } = setup();
    const input = { ...(booking(slotStart, slotEnd) as object), locale: 'en' };
    await service.create(input as never);
    const creation = client.appointment.create.mock.calls[0] as [{ data: object }];
    expect(creation[0].data).toHaveProperty('locale', 'en');
    client.appointment.findUnique.mockResolvedValue({
      id: 'a1',
      status: 'REQUESTED',
    });
    client.appointment.update.mockResolvedValue({
      id: 'a1',
      status: 'CONFIRMED',
      locale: 'en',
    });
    await service.updateStatus('a1', { status: 'CONFIRMED' });
    expect(notifications.notify).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'CONFIRMED', locale: 'en' }),
      'confirmed',
    );
    expect(client.appointment.update.mock.invocationCallOrder[0]).toBeLessThan(
      notifications.notify.mock.invocationCallOrder[0],
    );
    // Confirming only changes the status: no calendar event or meeting link.
    expect(client.appointment.update).toHaveBeenCalledWith({
      where: { id: 'a1' },
      data: { status: 'CONFIRMED' },
    });
  });

  it('emails a cancellation like every other status change', async () => {
    const { service, client, notifications } = setup();
    client.appointment.findUnique.mockResolvedValue({ id: 'a1', status: 'CONFIRMED' });
    client.appointment.update.mockResolvedValue({ id: 'a1', status: 'CANCELLED' });
    await service.updateStatus('a1', { status: 'CANCELLED' });
    expect(notifications.notify).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'CANCELLED' }),
      'cancelled',
    );
  });
});
