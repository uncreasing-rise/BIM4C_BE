import { lastValueFrom, of } from 'rxjs';
import { HoneypotInterceptor } from './honeypot.interceptor';

function run(body: Record<string, unknown>) {
  const handle = jest.fn(() => of('handled'));
  const context = {
    switchToHttp: () => ({ getRequest: () => ({ body, path: '/contact' }) }),
  };
  const result = new HoneypotInterceptor().intercept(context as never, { handle });
  return { handle, result: lastValueFrom(result), body };
}

describe('form honeypot', () => {
  it('answers a filled-in honeypot with success but stores and emails nothing', async () => {
    const { handle, result } = run({ email: 'victim@example.com', website: 'http://spam.example', locale: 'en' });
    await expect(result).resolves.toEqual({ success: true, message: 'Your request has been received.' });
    expect(handle).not.toHaveBeenCalled();
  });

  it('removes an empty honeypot so strict validation accepts the form', async () => {
    const { handle, result, body } = run({ email: 'a@example.com', website: '  ' });
    await expect(result).resolves.toBe('handled');
    expect(handle).toHaveBeenCalled();
    expect(body).not.toHaveProperty('website');
  });

  it('leaves forms without the field alone', () => {
    const { handle, body } = run({ email: 'a@example.com' });
    expect(handle).toHaveBeenCalled();
    expect(body).toEqual({ email: 'a@example.com' });
  });
});
