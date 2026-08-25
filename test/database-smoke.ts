const baseUrl = (process.env.API_URL ?? 'http://localhost:8080').replace(/\/$/, '');

async function request(path: string, init?: RequestInit): Promise<{ status: number; body: unknown }> {
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } });
  return { status: response.status, body: await response.json() as unknown };
}

function assertStatus(actual: number, expected: number, path: string): void {
  if (actual !== expected) throw new Error(`${path}: expected ${expected}, received ${actual}`);
}

function firstId(body: unknown): string {
  const data = typeof body === 'object' && body !== null && 'data' in body ? body.data : body;
  const first: unknown = Array.isArray(data) ? data[0] : undefined;
  const id = typeof first === 'object' && first !== null ? (first as Record<string, unknown>).id : undefined;
  if (typeof id !== 'string') throw new Error('Course list does not contain an id');
  return id;
}

async function smoke(): Promise<void> {
  for (const resource of ['services', 'projects', 'courses', 'posts']) {
    const list = await request(`/${resource}`); assertStatus(list.status, 200, `GET /${resource}`);
    const validSlug = resource === 'services' ? 'tu-van-bim' : resource === 'projects' ? 'lumi-hanoi' : resource === 'courses' ? 'bim-foundation' : 'trien-khai-du-an-trong-diem-2026';
    assertStatus((await request(`/${resource}/${validSlug}`)).status, 200, `GET /${resource}/:slug`);
    assertStatus((await request(`/${resource}/slug-khong-ton-tai`)).status, 404, `GET /${resource}/missing`);
  }
  const courses = await request('/courses');
  assertStatus((await request('/contact', { method: 'POST', body: JSON.stringify({ name: 'BIM4C Smoke Test', email: 'smoke-contact@example.com', message: 'Automated deployment smoke test.' }) })).status, 201, 'POST /contact');
  assertStatus((await request('/course-registrations', { method: 'POST', body: JSON.stringify({ courseId: firstId(courses.body), name: 'BIM4C Smoke Test', email: 'smoke-course@example.com', phone: '0900000000' }) })).status, 201, 'POST /course-registrations');
  const newsletterPayload = JSON.stringify({ email: 'smoke-newsletter@example.com', consent: true });
  assertStatus((await request('/newsletter/subscriptions', { method: 'POST', body: newsletterPayload })).status, 200, 'POST /newsletter/subscriptions');
  assertStatus((await request('/newsletter/subscriptions', { method: 'POST', body: newsletterPayload })).status, 200, 'POST /newsletter/subscriptions duplicate');
  process.stdout.write('Database-backed API smoke test passed.\n');
}

void smoke().catch((error: unknown) => { process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`); process.exitCode = 1; });
