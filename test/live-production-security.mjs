import { readFile } from 'node:fs/promises';

const base = process.env.TEST_BACKEND_URL ?? 'http://127.0.0.1:8081';
const text = await readFile('.env', 'utf8');
const value = (name) =>
  text
    .split(/\r?\n/)
    .find((line) => line.startsWith(`${name}=`))
    ?.slice(name.length + 1)
    .replace(/^['"]|['"]$/g, '');
const response = await fetch(`${base}/auth/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    email: value('ADMIN_BOOTSTRAP_EMAIL'),
    password: value('ADMIN_BOOTSTRAP_PASSWORD'),
  }),
});
const setCookie = response.headers.getSetCookie()[0] ?? '';
const cookie = setCookie.split(';', 1)[0];
const checks = [
  ['Login', response.status === 200],
  ['HttpOnly', /;\s*HttpOnly/i.test(setCookie)],
  ['Secure', /;\s*Secure/i.test(setCookie)],
  ['SameSite=Strict', /;\s*SameSite=Strict/i.test(setCookie)],
  ['Path=/', /;\s*Path=\//i.test(setCookie)],
];
const logout = await fetch(`${base}/auth/logout`, {
  method: 'POST',
  headers: { cookie, origin: value('FRONTEND_URL') },
});
checks.push(['Logout', logout.status === 204]);
const oldSession = await fetch(`${base}/auth/me`, { headers: { cookie } });
checks.push(['Old session rejected', oldSession.status === 401]);
console.table(checks.map(([name, pass]) => ({ name, pass })));
if (checks.some(([, pass]) => !pass)) process.exitCode = 1;
