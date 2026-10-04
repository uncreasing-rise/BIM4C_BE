import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { SITE_URL_OR_PATH, UpdateSettingsDto } from './settings.dto';

const base = {
  companyName: 'BIM4C',
  email: 'hello@example.com',
  socialLinks: {},
  defaultSeoTitle: 'BIM4C',
  defaultSeoDescription: 'BIM consulting and training.',
};
const errorsFor = (defaultOgImage: unknown) =>
  validateSync(
    plainToInstance(UpdateSettingsDto, { ...base, defaultOgImage }),
  ).map((e) => e.property);

describe('UpdateSettingsDto.defaultOgImage', () => {
  it.each([
    '/images/profile/hoa-xuan.webp',
    'https://cdn.example.com/og.jpg',
    null,
    undefined,
  ])('accepts %p (the stored default is a site path)', (value) => {
    expect(errorsFor(value)).toEqual([]);
  });

  it.each([
    'images/og.jpg',
    '//evil.example/og.jpg',
    'javascript:alert(1)',
    '/a b.jpg',
  ])('rejects %p', (value) => {
    expect(errorsFor(value)).toEqual(['defaultOgImage']);
    expect(SITE_URL_OR_PATH.test(value)).toBe(false);
  });
});
