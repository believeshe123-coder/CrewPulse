import assert from 'node:assert/strict';
import test from 'node:test';

import { clearSessionsForTests } from './auth.js';
import { buildApp } from './server.js';

const loginAs = async (app: ReturnType<typeof buildApp>, userId: string) => {
  const response = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { userId },
  });

  assert.equal(response.statusCode, 200);
  const payload = response.json() as { token: string };
  return payload.token;
};

test('GET /workers/:id is staff-only', async (t) => {
  clearSessionsForTests();
  const app = buildApp();
  t.after(async () => {
    await app.close();
  });

  const staffToken = await loginAs(app, 'staff-1');
  const customerToken = await loginAs(app, 'customer-1');

  const allowed = await app.inject({
    method: 'GET',
    url: '/workers/worker-1',
    headers: { authorization: `Bearer ${staffToken}` },
  });
  assert.equal(allowed.statusCode, 200);

  const denied = await app.inject({
    method: 'GET',
    url: '/workers/worker-1',
    headers: { authorization: `Bearer ${customerToken}` },
  });
  assert.equal(denied.statusCode, 403);
});

test('POST /assignments/:id/customer-rating allows customer and staff but denies worker', async (t) => {
  clearSessionsForTests();
  const app = buildApp();
  t.after(async () => {
    await app.close();
  });

  const staffToken = await loginAs(app, 'staff-1');
  const customerToken = await loginAs(app, 'customer-1');
  const workerToken = await loginAs(app, 'worker-1');

  const payload = { rating: 5, note: 'Great outcome' };

  const customerAllowed = await app.inject({
    method: 'POST',
    url: '/assignments/a-1/customer-rating',
    headers: { authorization: `Bearer ${customerToken}` },
    payload,
  });
  assert.equal(customerAllowed.statusCode, 201);

  const staffAllowed = await app.inject({
    method: 'POST',
    url: '/assignments/a-2/customer-rating',
    headers: { authorization: `Bearer ${staffToken}` },
    payload,
  });
  assert.equal(staffAllowed.statusCode, 201);

  const workerDenied = await app.inject({
    method: 'POST',
    url: '/assignments/a-3/customer-rating',
    headers: { authorization: `Bearer ${workerToken}` },
    payload,
  });
  assert.equal(workerDenied.statusCode, 403);
});

test('worker is denied own profile analytics route', async (t) => {
  clearSessionsForTests();
  const app = buildApp();
  t.after(async () => {
    await app.close();
  });

  const workerToken = await loginAs(app, 'worker-1');
  const staffToken = await loginAs(app, 'staff-1');

  const denied = await app.inject({
    method: 'GET',
    url: '/workers/worker-1/profile-analytics',
    headers: { authorization: `Bearer ${workerToken}` },
  });
  assert.equal(denied.statusCode, 403);

  const allowed = await app.inject({
    method: 'GET',
    url: '/workers/worker-1/profile-analytics',
    headers: { authorization: `Bearer ${staffToken}` },
  });
  assert.equal(allowed.statusCode, 200);
});
