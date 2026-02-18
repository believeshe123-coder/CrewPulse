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

const ratingSchema = z.object({
  rating: z.number().int().min(1).max(5),
  note: z.string().min(1).max(300).optional(),
});

const workers = {
  'worker-1': {
    id: 'worker-1',
    name: 'Jordan Miles',
    score: 92,
    flags: ['late-cancel-last-quarter'],
  },
} as const;

const assignmentRatings: Record<string, Array<{ by: string; rating: number; note?: string }>> = {};

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
    const worker = workers[params.id as keyof typeof workers];

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

  app.post('/assignments/:id/customer-rating', { preHandler: requireRole(['customer', 'staff']) }, async (request, reply) => {
    const params = request.params as { id: string };
    const parsedBody = ratingSchema.safeParse(request.body);

    if (!parsedBody.success) {
      return reply.code(400).send({ message: 'Invalid rating payload' });
    }

    const session = request.user;

    if (!session) {
      return reply.code(401).send({ message: 'Unauthorized' });
    }

    assignmentRatings[params.id] ??= [];
    assignmentRatings[params.id].push({
      by: session.userId,
      rating: parsedBody.data.rating,
      note: parsedBody.data.note,
    });

    return reply.code(201).send({ status: 'recorded', assignmentId: params.id });
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
