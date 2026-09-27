import { EmailService } from './email.service';
import { renderEmail } from './email-template';
import { appointmentEmail } from '../appointments/appointment-email';

const content = {
  locale: 'en' as const,
  eyebrow: 'REQUEST RECEIVED',
  title: 'Thank you',
  intro: 'Your request is saved.',
  next: 'We will be in touch.',
  details: [['Name', '<img src=x onerror=alert(1)>']] as [string, string][],
};
function service(overrides: Record<string, string> = {}) {
  const env: Record<string, string> = {
    EMAIL_PROVIDER: 'resend',
    RESEND_API_KEY: 'test-key',
    MAIL_FROM: 'BIM4C <test@example.com>',
    FRONTEND_URL: 'https://example.com',
    MAIL_REPLY_TO: 'support@example.com',
    ...overrides,
  };
  return new EmailService({
    get: (key: string) => env[key],
    getOrThrow: (key: string) => env[key],
  } as never);
}

describe('Transactional email', () => {
  afterEach(() => jest.restoreAllMocks());

  it('renders escaped responsive HTML, plaintext and localized policy links', () => {
    const result = renderEmail(
      content,
      'https://example.com',
      'support@example.com',
    );
    expect(result.html).not.toContain('<img src=x');
    expect(result.html).toContain('&lt;img');
    expect(result.html).toContain('max-width:600px');
    expect(result.html).toContain('/en/phap-ly/chinh-sach-bao-mat');
    expect(result.text).toContain('Your request is saved.');
    const unsafe = renderEmail(
      { ...content, action: { label: 'Open', url: 'javascript:alert(1)' } },
      'https://example.com',
      'support@example.com',
    );
    expect(unsafe.html).not.toContain('javascript:');
  });

  it('sends both formats, reply-to and a stable idempotency key', async () => {
    const fetcher = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response('{}', { status: 200 }));
    await expect(
      service().send({
        to: 'customer@example.com',
        key: 'contact/123/customer',
        subject: 'Thanks',
        content,
      }),
    ).resolves.toBe('sent');
    const init = fetcher.mock.calls[0][1]!;
    expect(init.headers).toEqual(
      expect.objectContaining({ 'Idempotency-Key': 'contact/123/customer' }),
    );
    const body = JSON.parse(init.body as string) as {
      reply_to: string;
      html: string;
      text: string;
    };
    expect(body.reply_to).toBe('support@example.com');
    expect(typeof body.html).toBe('string');
    expect(typeof body.text).toBe('string');
  });

  it('retries a transient failure with the same key and body', async () => {
    const fetcher = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response('{}', { status: 503 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }));
    await expect(
      service().send({
        to: 'customer@example.com',
        key: 'contact/123/customer',
        subject: 'Thanks',
        content,
      }),
    ).resolves.toBe('sent');
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[0][1]?.body).toEqual(
      fetcher.mock.calls[1][1]?.body,
    );
    expect(fetcher.mock.calls[0][1]?.headers).toEqual(
      fetcher.mock.calls[1][1]?.headers,
    );
  });

  it('does not retry permanent failures or throw away the saved request', async () => {
    const fetcher = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response('{}', { status: 403 }));
    await expect(
      service().send({
        to: 'customer@example.com',
        key: 'contact/123/customer',
        subject: 'Thanks',
        content,
      }),
    ).resolves.toBe('failed');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('reports skipped delivery honestly when provider is disabled', async () => {
    const fetcher = jest.spyOn(global, 'fetch');
    await expect(
      service({ EMAIL_PROVIDER: 'none' }).send({
        to: 'customer@example.com',
        key: 'test',
        subject: 'Thanks',
        content,
      }),
    ).resolves.toBe('skipped');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each(['vi', 'en'])(
    'keeps %s across the entire appointment lifecycle with an explicit timezone',
    (locale) => {
      const appointment = {
        id: 'a1',
        locale,
        name: 'Alex',
        topic: 'BIM',
        startAt: new Date('2026-10-05T02:00:00Z'),
        endAt: new Date('2026-10-05T02:45:00Z'),
        timezone: 'America/New_York',
        meetingUrl: 'https://meet.google.com/test',
      };
      for (const kind of [
        'requested',
        'confirmed',
        'cancelled',
        'completed',
        'no_show',
      ] as const) {
        const email = appointmentEmail(
          appointment as never,
          kind,
          false,
          'https://example.com',
        );
        expect(email.locale).toBe(locale);
        expect(email.details).toContainEqual([
          locale === 'vi' ? 'Múi giờ' : 'Time zone',
          'America/New_York',
        ]);
        if (kind === 'confirmed')
          expect(email.action?.url).toBe(appointment.meetingUrl);
        else expect(email.action?.url).not.toBe(appointment.meetingUrl);
      }
    },
  );
});
