import { readFile } from 'node:fs/promises';

const baseUrl = 'http://127.0.0.1:8080';
const origin = 'http://localhost:3000';
const runId = `qa-project-${Date.now()}`;

function parseEnv(source) {
  return Object.fromEntries(
    source
      .split(/\r?\n/)
      .filter(
        (line) =>
          line && !line.trimStart().startsWith('#') && line.includes('='),
      )
      .map((line) => {
        const index = line.indexOf('=');
        return [
          line.slice(0, index).trim(),
          line
            .slice(index + 1)
            .trim()
            .replace(/^['"]|['"]$/g, ''),
        ];
      }),
  );
}

async function request(path, { method = 'GET', body, cookie } = {}) {
  const headers = new Headers({ Accept: 'application/json' });
  if (cookie) headers.set('Cookie', cookie);
  if (!['GET', 'HEAD'].includes(method)) headers.set('Origin', origin);
  if (body !== undefined) headers.set('Content-Type', 'application/json');
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'manual',
  });
  const text = response.status === 204 ? '' : await response.text();
  let parsed = text;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {}
  return { status: response.status, body: parsed, headers: response.headers };
}

function data(response) {
  return response.body?.data ?? response.body;
}

function rows(response) {
  return Array.isArray(response.body?.data) ? response.body.data : [];
}

const checks = {};
function expect(name, response, status) {
  checks[name] = response.status;
  if (response.status !== status)
    throw new Error(`${name}: expected ${status}, received ${response.status}`);
  return response;
}

const env = parseEnv(await readFile('.env', 'utf8'));
if (!env.ADMIN_BOOTSTRAP_EMAIL || !env.ADMIN_BOOTSTRAP_PASSWORD)
  throw new Error('Admin credentials unavailable');

let cookie;
let createdId;
try {
  const initial = expect('list', await request('/projects?limit=100'), 200);
  if (!rows(initial).length)
    throw new Error('No existing project category source is available');
  const category = rows(initial)[0].category;
  const login = expect(
    'login',
    await request('/auth/login', {
      method: 'POST',
      body: {
        email: env.ADMIN_BOOTSTRAP_EMAIL,
        password: env.ADMIN_BOOTSTRAP_PASSWORD,
      },
    }),
    200,
  );
  cookie = login.headers.get('set-cookie')?.split(';', 1)[0];
  if (!cookie) throw new Error('Session cookie unavailable');

  expect(
    'adminList',
    await request('/admin/projects?limit=100', { cookie }),
    200,
  );
  const created = expect(
    'create',
    await request('/admin/projects', {
      method: 'POST',
      cookie,
      body: {
        slug: runId,
        title: `QA Project ${runId}`,
        description: 'Temporary production-blocker verification project',
        image: '/images/projects/project-placeholder.svg',
        eyebrow: 'QA verification',
        meta: null,
        highlights: ['Temporary test record'],
        sections: [
          { title: 'Verification', body: 'Temporary integration content' },
        ],
        categoryId: category.id,
        location: 'QA Integration Location',
        year: 2099,
        investor: 'QA Investor',
        expectedCompletion: 'QA 2099',
        scale: 'QA Scale',
        contractPackage: 'QA Contract',
        status: 'PLANNED',
        isFeatured: false,
        sortOrder: 9999,
      },
    }),
    201,
  );
  createdId = data(created)?.id;
  if (!createdId) throw new Error('Created project id unavailable');

  const detail = expect('detail', await request(`/projects/${runId}`), 200);
  checks.profileFields = [
    'investor',
    'expectedCompletion',
    'scale',
    'contractPackage',
  ].every((field) => typeof data(detail)?.[field] === 'string');
  if (!checks.profileFields)
    throw new Error('Project profile fields missing from public DTO');

  const search = expect(
    'search',
    await request(`/projects?search=${encodeURIComponent(runId)}`),
    200,
  );
  checks.searchMatches = rows(search).some((item) => item.slug === runId);
  const filter = expect(
    'filter',
    await request(
      `/projects?category=${category.slug}&location=${encodeURIComponent('QA Integration')}&year=2099&status=planned`,
    ),
    200,
  );
  checks.filterMatches = rows(filter).some((item) => item.slug === runId);
  const page1 = expect(
    'page1',
    await request('/projects?page=1&limit=1&sortBy=title&sortOrder=asc'),
    200,
  );
  const page2 = expect(
    'page2',
    await request('/projects?page=2&limit=1&sortBy=title&sortOrder=asc'),
    200,
  );
  checks.pagination =
    rows(page1).length === 1 &&
    rows(page2).length === 1 &&
    page1.body.meta.totalPages >= 2;

  const updated = expect(
    'update',
    await request(`/admin/projects/${createdId}`, {
      method: 'PATCH',
      cookie,
      body: { investor: 'QA Investor Updated', scale: null },
    }),
    200,
  );
  checks.updatePersisted =
    data(updated)?.investor === 'QA Investor Updated' &&
    data(updated)?.scale === null;

  expect(
    'invalidSlug',
    await request('/projects/qa-project-does-not-exist'),
    404,
  );
  expect(
    'invalidAdminId',
    await request('/admin/projects/not-a-uuid', { cookie }),
    400,
  );
} finally {
  if (createdId && cookie) {
    expect(
      'delete',
      await request(`/admin/projects/${createdId}`, {
        method: 'DELETE',
        cookie,
      }),
      204,
    );
    expect('deletedDetail', await request(`/projects/${runId}`), 404);
  }
  if (cookie) await request('/auth/logout', { method: 'POST', cookie });
}

console.log(JSON.stringify(checks));
