import { hashSync } from 'bcryptjs';
import assert from 'node:assert/strict';
import test from 'node:test';

import { clearSessionsForTests } from './auth.js';
import { buildApp } from './server.js';

const loginAs = async (
  app: ReturnType<typeof buildApp>,
  username: string,
  password = 'Password123!',
) => {
  const response = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { username, password },
  });

  assert.equal(response.statusCode, 200);
  const payload = response.json() as { token: string };
  return payload.token;
};

test('POST /auth/login authenticates valid credentials', async (t) => {
  clearSessionsForTests();
  const app = buildApp({ prismaClient: buildWorkersPrismaMock() as any });
  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { username: 'staff.user', password: 'Password123!' },
  });

  assert.equal(response.statusCode, 200);
  const payload = response.json() as { token: string; role: string };
  assert.ok(payload.token.length > 0);
  assert.equal(payload.role, 'staff');
});

test('POST /auth/login rejects invalid password', async (t) => {
  clearSessionsForTests();
  const app = buildApp({ prismaClient: buildWorkersPrismaMock() as any });
  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { username: 'staff.user', password: 'wrong-pass' },
  });

  assert.equal(response.statusCode, 401);
});

test('POST /auth/login rejects unknown username', async (t) => {
  clearSessionsForTests();
  const app = buildApp({ prismaClient: buildWorkersPrismaMock() as any });
  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { username: 'missing.user', password: 'Password123!' },
  });

  assert.equal(response.statusCode, 401);
});

test('POST /auth/login rejects malformed payload', async (t) => {
  clearSessionsForTests();
  const app = buildApp({ prismaClient: buildWorkersPrismaMock() as any });
  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { userId: 'staff-1' },
  });

  assert.equal(response.statusCode, 400);
});
const createAssignmentForTests = async (
  app: ReturnType<typeof buildApp>,
  staffToken: string,
  workerId = 'worker-1',
) => {
  const created = await app.inject({
    method: 'POST',
    url: '/assignments',
    headers: { authorization: `Bearer ${staffToken}` },
    payload: {
      workerId,
      category: 'events',
      scheduledStart: '2026-06-01T09:00:00.000Z',
      scheduledEnd: '2026-06-01T17:00:00.000Z',
    },
  });

  assert.equal(created.statusCode, 201);
  return (created.json() as { id: string }).id;
};

const buildWorkersPrismaMock = () => {
  const workers = new Map<string, any>([
    [
      'worker-1',
      {
        id: 'worker-1',
        employeeCode: 'EMP-001',
        firstName: 'Jordan',
        lastName: 'Miles',
        phone: null,
        email: 'jordan.miles@example.com',
        status: 'ACTIVE',
        tier: 'STRONG',
        overallScore: 4.2,
        performanceScore: 4.2,
        reliabilityScore: 5,
        lateRate: 0,
        ncnsRate: 0,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        flags: [],
      },
    ],
    [
      'worker-2',
      {
        id: 'worker-2',
        employeeCode: 'EMP-002',
        firstName: 'Taylor',
        lastName: 'Brooks',
        phone: null,
        email: 'taylor.brooks@example.com',
        status: 'NEEDS_REVIEW',
        tier: 'WATCHLIST',
        overallScore: 3.15,
        performanceScore: 2.9,
        reliabilityScore: 3.4,
        lateRate: 0.33,
        ncnsRate: 0,
        createdAt: new Date('2026-01-02T00:00:00.000Z'),
        updatedAt: new Date('2026-01-02T00:00:00.000Z'),
        flags: [
          {
            id: 'flag-needs-review',
            workerId: 'worker-2',
            flagType: 'NEEDS_REVIEW',
            reason: 'Needs review',
            triggeredAt: new Date('2026-01-02T00:00:00.000Z'),
            resolvedAt: null,
          },
        ],
      },
    ],
    [
      'worker-3',
      {
        id: 'worker-3',
        employeeCode: 'EMP-003',
        firstName: 'Sam',
        lastName: 'Rivera',
        phone: null,
        email: 'sam.rivera@example.com',
        status: 'HOLD',
        tier: 'CRITICAL',
        overallScore: 1.85,
        performanceScore: 1.5,
        reliabilityScore: 2.2,
        lateRate: 0.2,
        ncnsRate: 0.4,
        createdAt: new Date('2026-01-03T00:00:00.000Z'),
        updatedAt: new Date('2026-01-03T00:00:00.000Z'),
        flags: [
          {
            id: 'flag-needs-review-2',
            workerId: 'worker-3',
            flagType: 'NEEDS_REVIEW',
            reason: 'Needs review',
            triggeredAt: new Date('2026-01-03T00:00:00.000Z'),
            resolvedAt: null,
          },
          {
            id: 'flag-terminate',
            workerId: 'worker-3',
            flagType: 'TERMINATE_RECOMMENDED',
            reason: 'Terminate recommended',
            triggeredAt: new Date('2026-01-03T00:00:00.000Z'),
            resolvedAt: null,
          },
        ],
      },
    ],
  ]);

  const users = new Map<string, any>([
    [
      'staff.user',
      {
        id: 'user-staff-1',
        username: 'staff.user',
        passwordHash: hashSync('Password123!', 10),
        role: 'STAFF',
      },
    ],
    [
      'moderator.user',
      {
        id: 'user-moderator-1',
        username: 'moderator.user',
        passwordHash: hashSync('Password123!', 10),
        role: 'MODERATOR',
      },
    ],
  ]);

  let nextWorkerId = 4;

  return {
    user: {
      findUnique: async ({ where }: { where: { username?: string; id?: string } }) => {
        if (where.username) {
          return users.get(where.username) ?? null;
        }

        if (where.id) {
          return Array.from(users.values()).find((user) => user.id === where.id) ?? null;
        }

        return null;
      },
      create: async ({ data }: { data: any }) => {
        if (users.has(data.username)) {
          const duplicateUsernameError = { code: 'P2002', meta: { target: ['username'] } };
          throw duplicateUsernameError;
        }

        const created = {
          id: `user-${users.size + 1}`,
          username: data.username,
          passwordHash: data.passwordHash,
          role: data.role,
        };

        users.set(created.username, created);
        return { id: created.id, username: created.username, role: created.role };
      },
    },
    worker: {
      findMany: async () => Array.from(workers.values()),
      findUnique: async ({ where }: { where: { id: string } }) => workers.get(where.id) ?? null,
      create: async ({ data }: { data: any }) => {
        if (
          Array.from(workers.values()).some((worker) => worker.employeeCode === data.employeeCode)
        ) {
          const duplicateEmployeeCodeError = { code: 'P2002', meta: { target: ['employeeCode'] } };
          throw duplicateEmployeeCodeError;
        }

        if (
          data.email &&
          Array.from(workers.values()).some((worker) => worker.email === data.email)
        ) {
          const duplicateEmailError = { code: 'P2002', meta: { target: ['email'] } };
          throw duplicateEmailError;
        }

        const id = `worker-${nextWorkerId}`;
        nextWorkerId += 1;

        const created = {
          id,
          employeeCode: data.employeeCode,
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone ?? null,
          email: data.email ?? null,
          status: data.status,
          tier: data.tier,
          overallScore: data.overallScore,
          performanceScore: data.performanceScore,
          reliabilityScore: data.reliabilityScore,
          lateRate: data.lateRate,
          ncnsRate: data.ncnsRate,
          createdAt: new Date('2026-02-01T00:00:00.000Z'),
          updatedAt: new Date('2026-02-01T00:00:00.000Z'),
          flags: data.flags?.create
            ? [
                {
                  id: `flag-${id}`,
                  workerId: id,
                  flagType: data.flags.create.flagType,
                  reason: data.flags.create.reason,
                  triggeredAt: new Date('2026-02-01T00:00:00.000Z'),
                  resolvedAt: null,
                },
              ]
            : [],
        };

        workers.set(id, created);
        return created;
      },
    },
  };
};
test('GET /workers/:id is staff-only', async (t) => {
  clearSessionsForTests();
  const app = buildApp({ prismaClient: buildWorkersPrismaMock() as any });
  t.after(async () => {
    await app.close();
  });

  const staffToken = await loginAs(app, 'staff.user');
  const customerToken = await loginAs(app, 'moderator.user');

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

test('GET /workers lists seeded worker records for dashboard bootstrap', async (t) => {
  clearSessionsForTests();
  const app = buildApp({ prismaClient: buildWorkersPrismaMock() as any });
  t.after(async () => {
    await app.close();
  });

  const staffToken = await loginAs(app, 'staff.user');

  const response = await app.inject({
    method: 'GET',
    url: '/workers',
    headers: { authorization: `Bearer ${staffToken}` },
  });

  assert.equal(response.statusCode, 200);
  const payload = response.json() as Array<{ id: string; status: string; tier: string }>;
  assert.ok(payload.length >= 3);
  assert.ok(payload.some((worker) => worker.status === 'needs_review'));
  assert.ok(payload.some((worker) => worker.tier === 'Critical'));
});

test('POST /workers allows staff to create worker', async (t) => {
  clearSessionsForTests();
  const app = buildApp({ prismaClient: buildWorkersPrismaMock() as any });
  t.after(async () => {
    await app.close();
  });

  const staffToken = await loginAs(app, 'staff.user');

  const created = await app.inject({
    method: 'POST',
    url: '/workers',
    headers: { authorization: `Bearer ${staffToken}` },
    payload: {
      employeeCode: 'EMP-NEW-001',
      firstName: 'Avery',
      lastName: 'Stone',
      email: 'avery.stone@example.com',
      phone: '+15555550123',
      status: 'active',
      tier: 'Strong',
    },
  });

  assert.equal(created.statusCode, 201);
  const payload = created.json() as {
    id: string;
    name: string;
    status: string;
    score: number;
    performanceScore: number;
    reliabilityScore: number;
    lateRate: number;
    ncnsRate: number;
    tier: string;
    flags: string[];
  };

  assert.ok(payload.id.startsWith('worker-'));
  assert.equal(payload.name, 'Avery Stone');
  assert.equal(payload.status, 'active');
  assert.equal(payload.score, 0);
  assert.equal(payload.performanceScore, 0);
  assert.equal(payload.reliabilityScore, 0);
  assert.equal(payload.lateRate, 0);
  assert.equal(payload.ncnsRate, 0);
  assert.equal(payload.tier, 'Strong');
  assert.deepEqual(payload.flags, []);
});

test('POST /workers rejects non-staff roles', async (t) => {
  clearSessionsForTests();
  const app = buildApp({ prismaClient: buildWorkersPrismaMock() as any });
  t.after(async () => {
    await app.close();
  });

  const customerToken = await loginAs(app, 'moderator.user');

  const response = await app.inject({
    method: 'POST',
    url: '/workers',
    headers: { authorization: `Bearer ${customerToken}` },
    payload: {
      employeeCode: 'EMP-NEW-002',
      firstName: 'Blake',
      lastName: 'Mason',
    },
  });

  assert.equal(response.statusCode, 403);
});

test('POST /workers validates worker payload', async (t) => {
  clearSessionsForTests();
  const app = buildApp({ prismaClient: buildWorkersPrismaMock() as any });
  t.after(async () => {
    await app.close();
  });

  const staffToken = await loginAs(app, 'staff.user');

  const response = await app.inject({
    method: 'POST',
    url: '/workers',
    headers: { authorization: `Bearer ${staffToken}` },
    payload: {
      employeeCode: '',
      firstName: 'Casey',
      lastName: 'King',
      email: 'not-an-email',
    },
  });

  assert.equal(response.statusCode, 400);
});

test('POST /workers enforces unique employeeCode and email', async (t) => {
  clearSessionsForTests();
  const app = buildApp({ prismaClient: buildWorkersPrismaMock() as any });
  t.after(async () => {
    await app.close();
  });

  const staffToken = await loginAs(app, 'staff.user');

  const duplicateEmployeeCode = await app.inject({
    method: 'POST',
    url: '/workers',
    headers: { authorization: `Bearer ${staffToken}` },
    payload: {
      employeeCode: 'EMP-001',
      firstName: 'Devon',
      lastName: 'Cole',
      email: 'devon.cole@example.com',
    },
  });
  assert.equal(duplicateEmployeeCode.statusCode, 409);

  const duplicateEmail = await app.inject({
    method: 'POST',
    url: '/workers',
    headers: { authorization: `Bearer ${staffToken}` },
    payload: {
      employeeCode: 'EMP-NEW-003',
      firstName: 'Morgan',
      lastName: 'West',
      email: 'jordan.miles@example.com',
    },
  });
  assert.equal(duplicateEmail.statusCode, 409);
});
test('GET /dashboard/summary returns seeded counts and key cards', async (t) => {
  clearSessionsForTests();
  const app = buildApp({ prismaClient: buildWorkersPrismaMock() as any });
  t.after(async () => {
    await app.close();
  });

  const staffToken = await loginAs(app, 'staff.user');

  const response = await app.inject({
    method: 'GET',
    url: '/dashboard/summary',
    headers: { authorization: `Bearer ${staffToken}` },
  });

  assert.equal(response.statusCode, 200);
  const payload = response.json() as {
    counts: {
      workers: { total: number; active: number; needs_review: number };
      events: { completed: number; late: number; ncns: number };
      ratings: { staff: number; customer: number };
      flags: { needs_review: number; terminate_recommended: number };
    };
    keyCards: Array<{ id: string; value: number }>;
  };

  assert.equal(payload.counts.workers.total, 3);
  assert.equal(payload.counts.events.completed, 1);
  assert.equal(payload.counts.events.late, 1);
  assert.equal(payload.counts.events.ncns, 1);
  assert.equal(payload.counts.ratings.staff, 3);
  assert.equal(payload.counts.ratings.customer, 3);
  assert.equal(payload.counts.flags.needs_review, 2);
  assert.equal(payload.counts.flags.terminate_recommended, 1);
  assert.ok(payload.keyCards.some((card) => card.id === 'avg-rating'));
});

test('POST /assignments creates records and validates worker relation', async (t) => {
  clearSessionsForTests();
  const app = buildApp({ prismaClient: buildWorkersPrismaMock() as any });
  t.after(async () => {
    await app.close();
  });

  const staffToken = await loginAs(app, 'staff.user');

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

  const assignmentId = await createAssignmentForTests(app, staffToken);

  const fetched = await app.inject({
    method: 'GET',
    url: `/assignments/${assignmentId}`,
    headers: { authorization: `Bearer ${staffToken}` },
  });
  assert.equal(fetched.statusCode, 200);
});

test('POST /assignments/:id/events records staffing outcomes', async (t) => {
  clearSessionsForTests();
  const app = buildApp({ prismaClient: buildWorkersPrismaMock() as any });
  t.after(async () => {
    await app.close();
  });

  const staffToken = await loginAs(app, 'staff.user');
  const assignmentId = await createAssignmentForTests(app, staffToken);

  const invalid = await app.inject({
    method: 'POST',
    url: `/assignments/${assignmentId}/events`,
    headers: { authorization: `Bearer ${staffToken}` },
    payload: { eventType: 'unknown' },
  });
  assert.equal(invalid.statusCode, 400);

  const created = await app.inject({
    method: 'POST',
    url: `/assignments/${assignmentId}/events`,
    headers: { authorization: `Bearer ${staffToken}` },
    payload: { eventType: 'late', notes: 'Arrived 12 minutes late' },
  });
  assert.equal(created.statusCode, 201);

  const details = await app.inject({
    method: 'GET',
    url: `/assignments/${assignmentId}`,
    headers: { authorization: `Bearer ${staffToken}` },
  });
  const payload = details.json() as { events: Array<{ eventType: string }> };
  assert.equal(payload.events.length, 1);
  assert.equal(payload.events[0]?.eventType, 'late');
});

test('ratings enforce bounds and immutable submittedAt timestamp', async (t) => {
  clearSessionsForTests();
  const app = buildApp({ prismaClient: buildWorkersPrismaMock() as any });
  t.after(async () => {
    await app.close();
  });

  const staffToken = await loginAs(app, 'staff.user');
  const customerToken = await loginAs(app, 'moderator.user');
  const assignmentId = await createAssignmentForTests(app, staffToken);

  const badStaffRating = await app.inject({
    method: 'POST',
    url: `/assignments/${assignmentId}/staff-rating`,
    headers: { authorization: `Bearer ${staffToken}` },
    payload: { overall: 0, tags: ['attendance'] },
  });
  assert.equal(badStaffRating.statusCode, 400);

  const validStaffRating = await app.inject({
    method: 'POST',
    url: `/assignments/${assignmentId}/staff-rating`,
    headers: { authorization: `Bearer ${staffToken}` },
    payload: { overall: 5, tags: ['attendance'], internalNotes: 'Dependable worker' },
  });
  assert.equal(validStaffRating.statusCode, 201);
  const staffPayload = validStaffRating.json() as { submittedAt: string };
  assert.ok(staffPayload.submittedAt);

  const duplicateStaffRating = await app.inject({
    method: 'POST',
    url: `/assignments/${assignmentId}/staff-rating`,
    headers: { authorization: `Bearer ${staffToken}` },
    payload: { overall: 3, tags: [] },
  });
  assert.equal(duplicateStaffRating.statusCode, 409);

  const badCustomerRating = await app.inject({
    method: 'POST',
    url: `/assignments/${assignmentId}/customer-rating`,
    headers: { authorization: `Bearer ${customerToken}` },
    payload: { overall: 6 },
  });
  assert.equal(badCustomerRating.statusCode, 400);

  const validCustomerRating = await app.inject({
    method: 'POST',
    url: `/assignments/${assignmentId}/customer-rating`,
    headers: { authorization: `Bearer ${customerToken}` },
    payload: { overall: 4, quality: 5, wouldRehire: true },
  });
  assert.equal(validCustomerRating.statusCode, 201);
  const customerPayload = validCustomerRating.json() as { submittedAt: string };
  assert.ok(customerPayload.submittedAt);

  const duplicateCustomerRating = await app.inject({
    method: 'POST',
    url: `/assignments/${assignmentId}/customer-rating`,
    headers: { authorization: `Bearer ${customerToken}` },
    payload: { overall: 5 },
  });
  assert.equal(duplicateCustomerRating.statusCode, 409);
});

test('scoring and flags recalculate on assignment/rating/event writes', async (t) => {
  clearSessionsForTests();
  const app = buildApp({ prismaClient: buildWorkersPrismaMock() as any });
  t.after(async () => {
    await app.close();
  });

  const staffToken = await loginAs(app, 'staff.user');
  const customerToken = await loginAs(app, 'moderator.user');

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

  const assignmentDetail = await app.inject({
    method: 'GET',
    url: `/assignments/${assignmentId}`,
    headers: { authorization: `Bearer ${staffToken}` },
  });
  assert.equal(assignmentDetail.statusCode, 200);

  const assignmentPayload = assignmentDetail.json() as {
    worker: {
      performanceScore: number;
      reliabilityScore: number;
      ncnsRate: number;
      tier: string;
      flags: string[];
    };
  };

  assert.ok(assignmentPayload.worker.performanceScore > 0);
  assert.ok(assignmentPayload.worker.reliabilityScore > 0);
  assert.ok(assignmentPayload.worker.ncnsRate >= 0.2);
  assert.ok(assignmentPayload.worker.tier.length > 0);
  assert.ok(Array.isArray(assignmentPayload.worker.flags));
});
