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

test('POST /assignments creates records and validates worker relation', async (t) => {
  clearSessionsForTests();
  const app = buildApp();
  t.after(async () => {
    await app.close();
  });

  const staffToken = await loginAs(app, 'staff-1');

  const invalidWorker = await app.inject({
    method: 'POST',
    url: '/assignments',
    headers: { authorization: `Bearer ${staffToken}` },
    payload: {
      workerId: 'missing-worker',
      category: 'events',
      scheduledStart: '2026-05-01T09:00:00.000Z',
    },
  });
  assert.equal(invalidWorker.statusCode, 400);

  const created = await app.inject({
    method: 'POST',
    url: '/assignments',
    headers: { authorization: `Bearer ${staffToken}` },
    payload: {
      workerId: 'worker-1',
      category: 'events',
      scheduledStart: '2026-05-01T09:00:00.000Z',
      scheduledEnd: '2026-05-01T17:00:00.000Z',
    },
  });
  assert.equal(created.statusCode, 201);
  const createdPayload = created.json() as { id: string; workerId: string };
  assert.equal(createdPayload.workerId, 'worker-1');

  const fetched = await app.inject({
    method: 'GET',
    url: `/assignments/${createdPayload.id}`,
    headers: { authorization: `Bearer ${staffToken}` },
  });
  assert.equal(fetched.statusCode, 200);
});

test('POST /assignments/:id/events records staffing outcomes', async (t) => {
  clearSessionsForTests();
  const app = buildApp();
  t.after(async () => {
    await app.close();
  });

  const staffToken = await loginAs(app, 'staff-1');

  const invalid = await app.inject({
    method: 'POST',
    url: '/assignments/a-1/events',
    headers: { authorization: `Bearer ${staffToken}` },
    payload: { eventType: 'unknown' },
  });
  assert.equal(invalid.statusCode, 400);

  const created = await app.inject({
    method: 'POST',
    url: '/assignments/a-1/events',
    headers: { authorization: `Bearer ${staffToken}` },
    payload: { eventType: 'late', notes: 'Arrived 12 minutes late' },
  });
  assert.equal(created.statusCode, 201);

  const details = await app.inject({
    method: 'GET',
    url: '/assignments/a-1',
    headers: { authorization: `Bearer ${staffToken}` },
  });
  const payload = details.json() as { events: Array<{ eventType: string }> };
  assert.equal(payload.events.length, 1);
  assert.equal(payload.events[0]?.eventType, 'late');
});

test('ratings enforce bounds and immutable submittedAt timestamp', async (t) => {
  clearSessionsForTests();
  const app = buildApp();
  t.after(async () => {
    await app.close();
  });

  const staffToken = await loginAs(app, 'staff-1');
  const customerToken = await loginAs(app, 'customer-1');

  const badStaffRating = await app.inject({
    method: 'POST',
    url: '/assignments/a-1/staff-rating',
    headers: { authorization: `Bearer ${staffToken}` },
    payload: { overall: 0, tags: ['attendance'] },
  });
  assert.equal(badStaffRating.statusCode, 400);

  const validStaffRating = await app.inject({
    method: 'POST',
    url: '/assignments/a-1/staff-rating',
    headers: { authorization: `Bearer ${staffToken}` },
    payload: { overall: 5, tags: ['attendance'], internalNotes: 'Dependable worker' },
  });
  assert.equal(validStaffRating.statusCode, 201);
  const staffPayload = validStaffRating.json() as { submittedAt: string };
  assert.ok(staffPayload.submittedAt);

  const duplicateStaffRating = await app.inject({
    method: 'POST',
    url: '/assignments/a-1/staff-rating',
    headers: { authorization: `Bearer ${staffToken}` },
    payload: { overall: 3, tags: [] },
  });
  assert.equal(duplicateStaffRating.statusCode, 409);

  const badCustomerRating = await app.inject({
    method: 'POST',
    url: '/assignments/a-1/customer-rating',
    headers: { authorization: `Bearer ${customerToken}` },
    payload: { overall: 6 },
  });
  assert.equal(badCustomerRating.statusCode, 400);

  const validCustomerRating = await app.inject({
    method: 'POST',
    url: '/assignments/a-1/customer-rating',
    headers: { authorization: `Bearer ${customerToken}` },
    payload: { overall: 4, quality: 5, wouldRehire: true },
  });
  assert.equal(validCustomerRating.statusCode, 201);
  const customerPayload = validCustomerRating.json() as { submittedAt: string };
  assert.ok(customerPayload.submittedAt);

  const duplicateCustomerRating = await app.inject({
    method: 'POST',
    url: '/assignments/a-1/customer-rating',
    headers: { authorization: `Bearer ${customerToken}` },
    payload: { overall: 5 },
  });
  assert.equal(duplicateCustomerRating.statusCode, 409);
});


test('scoring and flags recalculate on assignment/rating/event writes', async (t) => {
  clearSessionsForTests();
  const app = buildApp();
  t.after(async () => {
    await app.close();
  });

  const staffToken = await loginAs(app, 'staff-1');
  const customerToken = await loginAs(app, 'customer-1');

  const created = await app.inject({
    method: 'POST',
    url: '/assignments',
    headers: { authorization: `Bearer ${staffToken}` },
    payload: {
      workerId: 'worker-1',
      category: 'cleanup',
      scheduledStart: '2026-06-01T09:00:00.000Z',
    },
  });
  assert.equal(created.statusCode, 201);
  const assignmentId = (created.json() as { id: string }).id;

  const staffRating = await app.inject({
    method: 'POST',
    url: `/assignments/${assignmentId}/staff-rating`,
    headers: { authorization: `Bearer ${staffToken}` },
    payload: { overall: 2, tags: ['quality'] },
  });
  assert.equal(staffRating.statusCode, 201);

  const customerRating = await app.inject({
    method: 'POST',
    url: `/assignments/${assignmentId}/customer-rating`,
    headers: { authorization: `Bearer ${customerToken}` },
    payload: { overall: 2 },
  });
  assert.equal(customerRating.statusCode, 201);

  const ncnsEvent = await app.inject({
    method: 'POST',
    url: `/assignments/${assignmentId}/events`,
    headers: { authorization: `Bearer ${staffToken}` },
    payload: { eventType: 'ncns' },
  });
  assert.equal(ncnsEvent.statusCode, 201);

  const worker = await app.inject({
    method: 'GET',
    url: '/workers/worker-1',
    headers: { authorization: `Bearer ${staffToken}` },
  });
  assert.equal(worker.statusCode, 200);

  const workerPayload = worker.json() as {
    performanceScore: number;
    reliabilityScore: number;
    ncnsRate: number;
    tier: string;
    flags: string[];
  };

  assert.equal(workerPayload.performanceScore, 2);
  assert.equal(workerPayload.reliabilityScore, 4.25);
  assert.equal(workerPayload.ncnsRate, 0.5);
  assert.equal(workerPayload.tier, 'Critical');
  assert.ok(workerPayload.flags.includes('needs-review'));
  assert.ok(workerPayload.flags.includes('terminate-recommended'));
});
