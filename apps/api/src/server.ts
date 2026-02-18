import cors from '@fastify/cors';
import type { UserRole } from '@crewpulse/contracts';
import Fastify from 'fastify';
import { z } from 'zod';

import { env } from './env.js';
import { login, parseLoginPayload, requireRole } from './auth.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      token: string;
      userId: string;
      role: UserRole;
    };
  }
}

const ratingValueSchema = z.number().int().min(1).max(5);
const assignmentEventTypeSchema = z.enum(['completed', 'late', 'sent_home', 'ncns']);

const createAssignmentSchema = z.object({
  workerId: z.string().min(1),
  category: z.string().min(1),
  scheduledStart: z.coerce.date(),
  scheduledEnd: z.coerce.date().optional(),
});

const createEventSchema = z.object({
  eventType: assignmentEventTypeSchema,
  notes: z.string().min(1).max(300).optional(),
});

const createStaffRatingSchema = z.object({
  overall: ratingValueSchema,
  tags: z.array(z.string().trim().min(1)).max(20).default([]),
  internalNotes: z.string().min(1).max(1000).optional(),
});

const createCustomerRatingSchema = z.object({
  overall: ratingValueSchema,
  punctuality: ratingValueSchema.optional(),
  workEthic: ratingValueSchema.optional(),
  attitude: ratingValueSchema.optional(),
  quality: ratingValueSchema.optional(),
  safety: ratingValueSchema.optional(),
  wouldRehire: z.boolean().optional(),
  comments: z.string().min(1).max(1000).optional(),
});

type Worker = {
  id: string;
  name: string;
  score: number;
  flags: string[];
};

type AssignmentEvent = {
  id: string;
  assignmentId: string;
  eventType: z.infer<typeof assignmentEventTypeSchema>;
  notes?: string;
  recordedBy: string;
  occurredAt: string;
};

type StaffRating = z.infer<typeof createStaffRatingSchema> & {
  id: string;
  assignmentId: string;
  workerId: string;
  ratedBy: string;
  submittedAt: string;
};

type CustomerRating = z.infer<typeof createCustomerRatingSchema> & {
  id: string;
  assignmentId: string;
  workerId: string;
  ratedBy: string;
  submittedAt: string;
};

type Assignment = {
  id: string;
  workerId: string;
  category: string;
  scheduledStart: string;
  scheduledEnd?: string;
  createdAt: string;
};

const workers: Record<string, Worker> = {
  'worker-1': {
    id: 'worker-1',
    name: 'Jordan Miles',
    score: 92,
    flags: ['late-cancel-last-quarter'],
  },
};

const assignments = new Map<string, Assignment>([
  [
    'a-1',
    {
      id: 'a-1',
      workerId: 'worker-1',
      category: 'warehouse',
      scheduledStart: new Date('2026-01-10T09:00:00.000Z').toISOString(),
      scheduledEnd: new Date('2026-01-10T17:00:00.000Z').toISOString(),
      createdAt: new Date('2026-01-01T12:00:00.000Z').toISOString(),
    },
  ],
]);
const assignmentEvents = new Map<string, AssignmentEvent[]>();
const staffRatings = new Map<string, StaffRating>();
const customerRatings = new Map<string, CustomerRating>();
let nextAssignmentId = 2;
let nextEventId = 1;
let nextStaffRatingId = 1;
let nextCustomerRatingId = 1;

const withAssignmentView = (assignment: Assignment) => ({
  ...assignment,
  worker: workers[assignment.workerId] ?? null,
  events: assignmentEvents.get(assignment.id) ?? [],
  staffRating: staffRatings.get(assignment.id) ?? null,
  customerRating: customerRatings.get(assignment.id) ?? null,
});

export const buildApp = () => {
  const app = Fastify({ logger: true });

  void app.register(cors, {
    origin: env.WEB_ORIGIN,
  });

  app.get('/health', async () => {
    return {
      status: 'ok',
      service: 'api',
      uptime: process.uptime(),
    };
  });

  app.post('/auth/login', async (request, reply) => {
    const parsedBody = parseLoginPayload(request.body);

    if (!parsedBody.success) {
      return reply.code(400).send({ message: 'Invalid login payload' });
    }

    const session = login(parsedBody.data.userId);

    if (!session) {
      return reply.code(401).send({ message: 'Login failed' });
    }

    return reply.send({ token: session.token, role: session.role, userId: session.userId });
  });

  app.get('/workers/:id', { preHandler: requireRole(['staff']) }, async (request, reply) => {
    const params = request.params as { id: string };
    const worker = workers[params.id];

    if (!worker) {
      return reply.code(404).send({ message: 'Worker not found' });
    }

    return reply.send(worker);
  });

  app.get('/workers/:id/profile-analytics', { preHandler: requireRole(['staff', 'worker']) }, async (request, reply) => {
    const params = request.params as { id: string };

    if (request.user?.role === 'worker' && request.user.userId === params.id) {
      return reply.code(403).send({ message: 'Workers cannot view their own analytics' });
    }

    if (request.user?.role !== 'staff') {
      return reply.code(403).send({ message: 'Forbidden' });
    }

    return reply.send({
      workerId: params.id,
      productivityScore: 88,
      attendanceScore: 94,
      flags: ['quality-audit-watch'],
    });
  });

  app.get('/assignments', { preHandler: requireRole(['staff', 'customer']) }, async () => {
    return Array.from(assignments.values()).map(withAssignmentView);
  });

  app.post('/assignments', { preHandler: requireRole(['staff']) }, async (request, reply) => {
    const parsed = createAssignmentSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({ message: 'Invalid assignment payload' });
    }

    if (!workers[parsed.data.workerId]) {
      return reply.code(400).send({ message: 'Unknown workerId' });
    }

    const id = `a-${nextAssignmentId}`;
    nextAssignmentId += 1;

    const assignment: Assignment = {
      id,
      workerId: parsed.data.workerId,
      category: parsed.data.category,
      scheduledStart: parsed.data.scheduledStart.toISOString(),
      scheduledEnd: parsed.data.scheduledEnd?.toISOString(),
      createdAt: new Date().toISOString(),
    };

    assignments.set(id, assignment);

    return reply.code(201).send(withAssignmentView(assignment));
  });

  app.get('/assignments/:id', { preHandler: requireRole(['staff', 'customer']) }, async (request, reply) => {
    const params = request.params as { id: string };
    const assignment = assignments.get(params.id);

    if (!assignment) {
      return reply.code(404).send({ message: 'Assignment not found' });
    }

    return reply.send(withAssignmentView(assignment));
  });

  app.post('/assignments/:id/events', { preHandler: requireRole(['staff']) }, async (request, reply) => {
    const params = request.params as { id: string };
    const parsed = createEventSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({ message: 'Invalid event payload' });
    }

    const assignment = assignments.get(params.id);

    if (!assignment) {
      return reply.code(404).send({ message: 'Assignment not found' });
    }

    const events = assignmentEvents.get(params.id) ?? [];
    const event: AssignmentEvent = {
      id: `ev-${nextEventId}`,
      assignmentId: params.id,
      eventType: parsed.data.eventType,
      notes: parsed.data.notes,
      recordedBy: request.user?.userId ?? 'unknown',
      occurredAt: new Date().toISOString(),
    };
    nextEventId += 1;
    events.push(event);
    assignmentEvents.set(params.id, events);

    return reply.code(201).send(event);
  });

  app.post('/assignments/:id/staff-rating', { preHandler: requireRole(['staff']) }, async (request, reply) => {
    const params = request.params as { id: string };
    const parsed = createStaffRatingSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({ message: 'Invalid staff rating payload' });
    }

    const assignment = assignments.get(params.id);

    if (!assignment) {
      return reply.code(404).send({ message: 'Assignment not found' });
    }

    if (staffRatings.has(params.id)) {
      return reply.code(409).send({ message: 'Staff rating already submitted and immutable' });
    }

    const rating: StaffRating = {
      id: `sr-${nextStaffRatingId}`,
      assignmentId: params.id,
      workerId: assignment.workerId,
      ratedBy: request.user?.userId ?? 'unknown',
      submittedAt: new Date().toISOString(),
      ...parsed.data,
    };
    nextStaffRatingId += 1;
    staffRatings.set(params.id, rating);

    return reply.code(201).send(rating);
  });

  app.post('/assignments/:id/customer-rating', { preHandler: requireRole(['customer', 'staff']) }, async (request, reply) => {
    const params = request.params as { id: string };
    const parsed = createCustomerRatingSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({ message: 'Invalid customer rating payload' });
    }

    const assignment = assignments.get(params.id);

    if (!assignment) {
      return reply.code(404).send({ message: 'Assignment not found' });
    }

    if (customerRatings.has(params.id)) {
      return reply.code(409).send({ message: 'Customer rating already submitted and immutable' });
    }

    const rating: CustomerRating = {
      id: `cr-${nextCustomerRatingId}`,
      assignmentId: params.id,
      workerId: assignment.workerId,
      ratedBy: request.user?.userId ?? 'unknown',
      submittedAt: new Date().toISOString(),
      ...parsed.data,
    };
    nextCustomerRatingId += 1;
    customerRatings.set(params.id, rating);

    return reply.code(201).send(rating);
  });

  return app;
};

const start = async () => {
  const app = buildApp();

  try {
    await app.listen({
      port: env.API_PORT,
      host: env.API_HOST,
    });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

if (process.env.NODE_ENV !== 'test') {
  void start();
}
