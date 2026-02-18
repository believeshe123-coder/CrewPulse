import cors from '@fastify/cors';
import { PrismaClient } from '@prisma/client';
import Fastify from 'fastify';
import { z } from 'zod';

import { env } from './env.js';
import {
  createUser,
  login,
  parseCreateUserPayload,
  parseLoginPayload,
  requireRole,
  type UserRole,
} from './auth.js';
import {
  calculateLateRate,
  calculateNcnsRate,
  calculatePerformanceScore,
  calculateReliabilityScore,
  mapTier,
  shouldFlagNeedsReview,
  shouldFlagTerminateRecommended,
} from './services/scoring/index.js';

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

const createGroupSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

const createWorkerSchema = z.object({
  employeeCode: z.string().trim().min(1).max(64),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  phone: z.string().trim().min(1).max(30).optional(),
  email: z.string().trim().email().optional(),
  status: z.enum(['active', 'needs_review', 'hold', 'terminate']).optional(),
  tier: z.enum(['Strong', 'Watchlist', 'At Risk', 'Critical']).optional(),
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

const workerStatusToApi = {
  ACTIVE: 'active',
  NEEDS_REVIEW: 'needs_review',
  HOLD: 'hold',
  TERMINATE: 'terminate',
} as const;

const workerTierToApi = {
  ELITE: 'Elite',
  STRONG: 'Strong',
  SOLID: 'Solid',
  WATCHLIST: 'Watchlist',
  CRITICAL: 'Critical',
} as const;

const flagTypeToApi = {
  NEEDS_REVIEW: 'needs-review',
  TERMINATE_RECOMMENDED: 'terminate-recommended',
} as const;

const mapPrismaWorkerToResponse = (worker: WorkerWithFlags): Worker => ({
  id: worker.id,
  name: `${worker.firstName} ${worker.lastName}`,
  status: workerStatusToApi[worker.status],
  score: Number(worker.overallScore),
  performanceScore: Number(worker.performanceScore),
  reliabilityScore: Number(worker.reliabilityScore),
  lateRate: Number(worker.lateRate),
  ncnsRate: Number(worker.ncnsRate),
  tier: workerTierToApi[worker.tier],
  flags: worker.flags
    .filter((flag) => flag.resolvedAt === null)
    .map((flag) => flagTypeToApi[flag.flagType]),
});

const mapApiStatusToPrisma = (
  status: z.infer<typeof createWorkerSchema>['status'],
): 'ACTIVE' | 'NEEDS_REVIEW' | 'HOLD' | 'TERMINATE' => {
  if (!status) {
    return 'ACTIVE';
  }

  return status.toUpperCase() as 'ACTIVE' | 'NEEDS_REVIEW' | 'HOLD' | 'TERMINATE';
};

const mapApiTierToPrisma = (
  tier: z.infer<typeof createWorkerSchema>['tier'],
): 'ELITE' | 'STRONG' | 'SOLID' | 'WATCHLIST' | 'CRITICAL' => {
  if (!tier) {
    return 'SOLID';
  }

  const normalizedTier = tier.replace(/\s+/g, '_').toUpperCase();

  if (normalizedTier === 'AT_RISK') {
    return 'WATCHLIST';
  }

  return normalizedTier as 'ELITE' | 'STRONG' | 'SOLID' | 'WATCHLIST' | 'CRITICAL';
};

type Worker = {
  id: string;
  name: string;
  status: 'active' | 'needs_review' | 'hold' | 'terminate';
  score: number;
  performanceScore: number;
  reliabilityScore: number;
  lateRate: number;
  ncnsRate: number;
  tier: string;
  flags: string[];
};

type WorkerWithFlags = {
  id: string;
  firstName: string;
  lastName: string;
  status: 'ACTIVE' | 'NEEDS_REVIEW' | 'HOLD' | 'TERMINATE';
  overallScore: unknown;
  performanceScore: unknown;
  reliabilityScore: unknown;
  lateRate: unknown;
  ncnsRate: unknown;
  tier: 'ELITE' | 'STRONG' | 'SOLID' | 'WATCHLIST' | 'CRITICAL';
  flags: Array<{ flagType: 'NEEDS_REVIEW' | 'TERMINATE_RECOMMENDED'; resolvedAt: Date | null }>;
};

type AppPrismaClient = {
  $disconnect?: () => Promise<void>;
  user: {
    findUnique: (args: {
      where: { username?: string; id?: string };
      select?: { id?: true; username?: true; passwordHash?: true; role?: true };
    }) => Promise<null | {
      id: string;
      username: string;
      passwordHash?: string;
      role: 'STAFF' | 'MODERATOR';
    }>;
    create: (args: {
      data: { username: string; passwordHash: string; role: 'STAFF' | 'MODERATOR' };
      select: { id: true; username: true; role: true };
    }) => Promise<{ id: string; username: string; role: 'STAFF' | 'MODERATOR' }>;
  };
  worker: {
    findMany: (args: {
      include: { flags: true };
      orderBy: Array<{ createdAt?: 'asc' | 'desc'; employeeCode?: 'asc' | 'desc' }>;
    }) => Promise<WorkerWithFlags[]>;
    findUnique: (args: {
      where: { id: string };
      include: { flags: true };
    }) => Promise<WorkerWithFlags | null>;
    create: (args: {
      data: {
        employeeCode: string;
        firstName: string;
        lastName: string;
        phone?: string;
        email?: string;
        status: 'ACTIVE' | 'NEEDS_REVIEW' | 'HOLD' | 'TERMINATE';
        tier: 'ELITE' | 'STRONG' | 'SOLID' | 'WATCHLIST' | 'CRITICAL';
        overallScore: number;
        performanceScore: number;
        reliabilityScore: number;
        lateRate: number;
        ncnsRate: number;
        flags?: {
          create: {
            flagType: 'NEEDS_REVIEW';
            reason: string;
          };
        };
      };
      include: { flags: true };
    }) => Promise<WorkerWithFlags>;
  };
  group: {
    create: (args: { data: { name: string; createdByUserId: string } }) => Promise<{
      id: string;
      name: string;
      createdByUserId: string;
      createdAt: Date;
      updatedAt: Date;
    }>;
    findMany: (args: {
      where: { memberships: { some: { userId: string } } };
      orderBy: { createdAt: 'asc' | 'desc' };
      include: { memberships: { where: { userId: string }; select: { joinedAt: true; roleInGroup: true } } };
    }) => Promise<
      Array<{
        id: string;
        name: string;
        createdByUserId: string;
        createdAt: Date;
        updatedAt: Date;
        memberships: Array<{ joinedAt: Date; roleInGroup: string }>;
      }>
    >;
    findUnique: (args: { where: { id: string }; select: { id: true } }) => Promise<{ id: string } | null>;
  };
  groupMembership: {
    findUnique: (args: { where: { groupId_userId: { groupId: string; userId: string } } }) => Promise<
      { groupId: string; userId: string; roleInGroup: string; joinedAt: Date } | null
    >;
    create: (args: { data: { groupId: string; userId: string; roleInGroup?: 'MEMBER' } }) => Promise<{
      groupId: string;
      userId: string;
      roleInGroup: string;
      joinedAt: Date;
    }>;
  };
};

type WorkerRecord = Worker & {
  employeeCode: string;
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
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

const seedWorkers: WorkerRecord[] = [
  {
    id: 'worker-1',
    employeeCode: 'EMP-001',
    firstName: 'Jordan',
    lastName: 'Miles',
    email: 'jordan.miles@example.com',
    name: 'Jordan Miles',
    status: 'active',
    score: 4.2,
    performanceScore: 4.2,
    reliabilityScore: 5,
    lateRate: 0,
    ncnsRate: 0,
    tier: 'Strong',
    flags: ['late-cancel-last-quarter'],
  },
  {
    id: 'worker-2',
    employeeCode: 'EMP-002',
    firstName: 'Taylor',
    lastName: 'Brooks',
    email: 'taylor.brooks@example.com',
    name: 'Taylor Brooks',
    status: 'needs_review',
    score: 3.15,
    performanceScore: 2.9,
    reliabilityScore: 3.4,
    lateRate: 0.33,
    ncnsRate: 0,
    tier: 'Watchlist',
    flags: ['needs-review'],
  },
  {
    id: 'worker-3',
    employeeCode: 'EMP-003',
    firstName: 'Sam',
    lastName: 'Rivera',
    email: 'sam.rivera@example.com',
    name: 'Sam Rivera',
    status: 'hold',
    score: 1.85,
    performanceScore: 1.5,
    reliabilityScore: 2.2,
    lateRate: 0.2,
    ncnsRate: 0.4,
    tier: 'Critical',
    flags: ['needs-review', 'terminate-recommended'],
  },
];

const workers = new Map(seedWorkers.map((worker) => [worker.id, worker]));
const employeeCodeToWorkerId = new Map(
  seedWorkers.map((worker) => [worker.employeeCode.toLowerCase(), worker.id]),
);
const emailToWorkerId = new Map(
  seedWorkers
    .filter((worker) => worker.email)
    .map((worker) => [worker.email!.toLowerCase(), worker.id]),
);
let nextWorkerId = 4;

const toWorkerResponse = (worker: WorkerRecord): Worker => ({
  id: worker.id,
  name: worker.name,
  status: worker.status,
  score: worker.score,
  performanceScore: worker.performanceScore,
  reliabilityScore: worker.reliabilityScore,
  lateRate: worker.lateRate,
  ncnsRate: worker.ncnsRate,
  tier: worker.tier,
  flags: worker.flags,
});

const assignments = new Map<string, Assignment>([
  [
    'a-2',
    {
      id: 'a-2',
      workerId: 'worker-2',
      category: 'cleanup',
      scheduledStart: new Date('2026-01-14T09:00:00.000Z').toISOString(),
      scheduledEnd: new Date('2026-01-14T17:00:00.000Z').toISOString(),
      createdAt: new Date('2026-01-09T12:00:00.000Z').toISOString(),
    },
  ],
  [
    'a-3',
    {
      id: 'a-3',
      workerId: 'worker-3',
      category: 'warehouse',
      scheduledStart: new Date('2026-01-15T09:00:00.000Z').toISOString(),
      scheduledEnd: new Date('2026-01-15T17:00:00.000Z').toISOString(),
      createdAt: new Date('2026-01-12T12:00:00.000Z').toISOString(),
    },
  ],
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
let nextAssignmentId = 4;
let nextEventId = 4;
let nextStaffRatingId = 4;
let nextCustomerRatingId = 4;

assignmentEvents.set('a-1', [
  {
    id: 'ev-1',
    assignmentId: 'a-1',
    eventType: 'completed',
    recordedBy: 'staff-1',
    occurredAt: new Date('2026-01-10T17:05:00.000Z').toISOString(),
  },
]);

assignmentEvents.set('a-2', [
  {
    id: 'ev-2',
    assignmentId: 'a-2',
    eventType: 'late',
    notes: 'Arrived 20 minutes late',
    recordedBy: 'staff-1',
    occurredAt: new Date('2026-01-14T09:20:00.000Z').toISOString(),
  },
]);

assignmentEvents.set('a-3', [
  {
    id: 'ev-3',
    assignmentId: 'a-3',
    eventType: 'ncns',
    notes: 'No call/no show',
    recordedBy: 'staff-2',
    occurredAt: new Date('2026-01-15T09:30:00.000Z').toISOString(),
  },
]);

staffRatings.set('a-1', {
  id: 'sr-1',
  assignmentId: 'a-1',
  workerId: 'worker-1',
  ratedBy: 'staff-1',
  submittedAt: new Date('2026-01-10T18:00:00.000Z').toISOString(),
  overall: 5,
  tags: ['dependable', 'team-player'],
});

staffRatings.set('a-2', {
  id: 'sr-2',
  assignmentId: 'a-2',
  workerId: 'worker-2',
  ratedBy: 'staff-1',
  submittedAt: new Date('2026-01-14T18:00:00.000Z').toISOString(),
  overall: 3,
  tags: ['late-arrival'],
});

staffRatings.set('a-3', {
  id: 'sr-3',
  assignmentId: 'a-3',
  workerId: 'worker-3',
  ratedBy: 'staff-2',
  submittedAt: new Date('2026-01-15T18:00:00.000Z').toISOString(),
  overall: 1,
  tags: ['no-show'],
});

customerRatings.set('a-1', {
  id: 'cr-1',
  assignmentId: 'a-1',
  workerId: 'worker-1',
  ratedBy: 'customer-1',
  submittedAt: new Date('2026-01-10T18:30:00.000Z').toISOString(),
  overall: 5,
  punctuality: 5,
  workEthic: 5,
  attitude: 5,
  quality: 5,
  safety: 5,
  wouldRehire: true,
});

customerRatings.set('a-2', {
  id: 'cr-2',
  assignmentId: 'a-2',
  workerId: 'worker-2',
  ratedBy: 'customer-1',
  submittedAt: new Date('2026-01-14T18:15:00.000Z').toISOString(),
  overall: 3,
  punctuality: 2,
  workEthic: 3,
  attitude: 4,
  quality: 3,
  safety: 4,
  wouldRehire: false,
});

customerRatings.set('a-3', {
  id: 'cr-3',
  assignmentId: 'a-3',
  workerId: 'worker-3',
  ratedBy: 'customer-2',
  submittedAt: new Date('2026-01-15T18:15:00.000Z').toISOString(),
  overall: 1,
  wouldRehire: false,
});

const getWorkerAssignments = (workerId: string) =>
  Array.from(assignments.values()).filter((assignment) => assignment.workerId === workerId);

const recalculateWorkerScoring = (workerId: string) => {
  const worker = workers.get(workerId);

  if (!worker) {
    return;
  }

  const workerAssignments = getWorkerAssignments(workerId);

  const ratedJobs = workerAssignments.map((assignment) => ({
    occurredAt: assignment.scheduledStart,
    staffRating: staffRatings.get(assignment.id)?.overall,
    customerRating: customerRatings.get(assignment.id)?.overall,
  }));

  const performanceScore = calculatePerformanceScore(ratedJobs);

  const allEvents = workerAssignments.flatMap(
    (assignment) => assignmentEvents.get(assignment.id) ?? [],
  );
  const late = allEvents.filter((event) => event.eventType === 'late').length;
  const sentHome = allEvents.filter((event) => event.eventType === 'sent_home').length;
  const ncns = allEvents.filter((event) => event.eventType === 'ncns').length;
  const totalJobs = workerAssignments.length;

  const reliabilityScore = calculateReliabilityScore({
    totalJobs,
    late,
    sentHome,
    ncns,
  });
  const lateRate = calculateLateRate({ totalJobs, late });
  const ncnsRate = calculateNcnsRate({ totalJobs, ncns });

  const now = Date.now();
  const incidentsLast30Days = allEvents.filter(
    (event) => now - new Date(event.occurredAt).getTime() <= 1000 * 60 * 60 * 24 * 30,
  ).length;
  const lastFiveAssignmentIds = [...workerAssignments]
    .sort((a, b) => new Date(b.scheduledStart).getTime() - new Date(a.scheduledStart).getTime())
    .slice(0, 5)
    .map((assignment) => assignment.id);
  const ncnsInLastFiveJobs = lastFiveAssignmentIds
    .map((assignmentId) =>
      (assignmentEvents.get(assignmentId) ?? []).some((event) => event.eventType === 'ncns'),
    )
    .filter(Boolean).length;

  const recentPerformanceScores = [...ratedJobs]
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
    .map((job) => {
      if (job.customerRating && job.staffRating) {
        return Number((job.customerRating * 0.65 + job.staffRating * 0.35).toFixed(2));
      }

      return job.customerRating ?? job.staffRating ?? 0;
    })
    .slice(0, 5);

  const needsReview = shouldFlagNeedsReview({
    overallScore: performanceScore,
    ncnsRate,
    incidentsLast30Days,
    lastFivePerformanceScores: recentPerformanceScores,
  });

  const terminateRecommended = shouldFlagTerminateRecommended({
    overallScore: performanceScore,
    totalJobs,
    ncnsRate,
    ncnsInLastFiveJobs,
    severeIncidentFlag: false,
  });

  const flags: string[] = [];
  if (needsReview) {
    flags.push('needs-review');
  }
  if (terminateRecommended) {
    flags.push('terminate-recommended');
  }

  worker.performanceScore = performanceScore;
  worker.reliabilityScore = reliabilityScore;
  worker.lateRate = lateRate;
  worker.ncnsRate = ncnsRate;
  worker.score = Number(((performanceScore + reliabilityScore) / 2).toFixed(2));
  worker.tier = mapTier(performanceScore);
  worker.flags = flags;
};

const withAssignmentView = (assignment: Assignment) => {
  const worker = workers.get(assignment.workerId);

  return {
    ...assignment,
    worker: worker ? toWorkerResponse(worker) : null,
    events: assignmentEvents.get(assignment.id) ?? [],
    staffRating: staffRatings.get(assignment.id) ?? null,
    customerRating: customerRatings.get(assignment.id) ?? null,
  };
};

const buildDashboardSummary = () => {
  const workerList = Array.from(workers.values());
  const totalWorkers = workerList.length;
  const statusCounts = workerList.reduce(
    (accumulator, worker) => {
      accumulator[worker.status] += 1;
      return accumulator;
    },
    {
      active: 0,
      needs_review: 0,
      hold: 0,
      terminate: 0,
    },
  );

  const events = Array.from(assignmentEvents.values()).flat();
  const eventCounts = events.reduce(
    (accumulator, event) => {
      accumulator[event.eventType] += 1;
      return accumulator;
    },
    {
      completed: 0,
      late: 0,
      sent_home: 0,
      ncns: 0,
    },
  );

  const ratings = [...staffRatings.values(), ...customerRatings.values()];
  const avgRating =
    ratings.length === 0
      ? 0
      : Number(
          (ratings.reduce((sum, rating) => sum + rating.overall, 0) / ratings.length).toFixed(2),
        );
  const flaggedWorkers = workerList.filter((worker) => worker.flags.length > 0).length;

  return {
    counts: {
      workers: {
        total: totalWorkers,
        ...statusCounts,
      },
      assignments: {
        total: assignments.size,
      },
      events: eventCounts,
      ratings: {
        staff: staffRatings.size,
        customer: customerRatings.size,
      },
      flags: {
        needs_review: workerList.filter((worker) => worker.flags.includes('needs-review')).length,
        terminate_recommended: workerList.filter((worker) =>
          worker.flags.includes('terminate-recommended'),
        ).length,
      },
    },
    keyCards: [
      {
        id: 'active-workers',
        label: 'Active Workers',
        value: statusCounts.active,
      },
      {
        id: 'workers-needing-review',
        label: 'Needs Review',
        value: statusCounts.needs_review,
      },
      {
        id: 'ncns-incidents',
        label: 'NCNS Incidents',
        value: eventCounts.ncns,
      },
      {
        id: 'flagged-workers',
        label: 'Flagged Workers',
        value: flaggedWorkers,
      },
      {
        id: 'avg-rating',
        label: 'Average Rating',
        value: avgRating,
      },
    ],
  };
};

export const buildApp = (deps: { prismaClient?: AppPrismaClient } = {}) => {
  const app = Fastify({ logger: process.env.NODE_ENV !== 'test' });
  const prismaClient: AppPrismaClient = (deps.prismaClient ??
    new PrismaClient()) as unknown as AppPrismaClient;

  app.addHook('onClose', async () => {
    if (!deps.prismaClient && prismaClient.$disconnect) {
      await prismaClient.$disconnect();
    }
  });

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

  app.get('/workers', { preHandler: requireRole(['staff', 'moderator']) }, async () => {
    const prismaWorkers = await prismaClient.worker.findMany({
      include: { flags: true },
      orderBy: [{ createdAt: 'asc' }, { employeeCode: 'asc' }],
    });

    return prismaWorkers.map(mapPrismaWorkerToResponse);
  });

  app.post('/workers', { preHandler: requireRole(['staff']) }, async (request, reply) => {
    const parsed = createWorkerSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({ message: 'Invalid worker payload' });
    }

    const status = mapApiStatusToPrisma(parsed.data.status);

    try {
      const createdWorker = await prismaClient.worker.create({
        data: {
          employeeCode: parsed.data.employeeCode,
          firstName: parsed.data.firstName,
          lastName: parsed.data.lastName,
          phone: parsed.data.phone,
          email: parsed.data.email,
          status,
          tier: mapApiTierToPrisma(parsed.data.tier),
          overallScore: 0,
          performanceScore: 0,
          reliabilityScore: 0,
          lateRate: 0,
          ncnsRate: 0,
          ...(status === 'NEEDS_REVIEW'
            ? {
                flags: {
                  create: {
                    flagType: 'NEEDS_REVIEW',
                    reason: 'Worker created in needs review state.',
                  },
                },
              }
            : {}),
        },
        include: { flags: true },
      });

      return reply.code(201).send(mapPrismaWorkerToResponse(createdWorker));
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === 'P2002'
      ) {
        const target = ((error as { meta?: { target?: string[] } }).meta?.target ?? []) as string[];

        if (target.includes('employeeCode')) {
          return reply.code(409).send({ message: 'Employee code already exists' });
        }

        if (target.includes('email')) {
          return reply.code(409).send({ message: 'Email already exists' });
        }

        return reply.code(409).send({ message: 'Worker already exists' });
      }

      throw error;
    }
  });

  app.post('/auth/login', async (request, reply) => {
    const parsedBody = parseLoginPayload(request.body);

    if (!parsedBody.success) {
      return reply.code(400).send({ message: 'Invalid login payload' });
    }

    const session = await login(prismaClient, parsedBody.data);

    if (!session) {
      return reply.code(401).send({ message: 'Login failed' });
    }

    return reply.send({ token: session.token, role: session.role, userId: session.userId });
  });
  app.post('/auth/users', { preHandler: requireRole(['moderator']) }, async (request, reply) => {
    const parsedBody = parseCreateUserPayload(request.body);

    if (!parsedBody.success) {
      return reply.code(400).send({ message: 'Invalid create user payload' });
    }

    try {
      const createdUser = await createUser(prismaClient, parsedBody.data);
      return reply.code(201).send(createdUser);
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === 'P2002'
      ) {
        return reply.code(409).send({ message: 'Username already exists' });
      }

      throw error;
    }
  });


  app.post('/groups', { preHandler: requireRole(['moderator']) }, async (request, reply) => {
    const parsed = createGroupSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({ message: 'Invalid group payload' });
    }

    const createdGroup = await prismaClient.group.create({
      data: {
        name: parsed.data.name,
        createdByUserId: request.user!.userId,
      },
    });

    return reply.code(201).send({
      id: createdGroup.id,
      name: createdGroup.name,
      createdByUserId: createdGroup.createdByUserId,
      createdAt: createdGroup.createdAt,
      updatedAt: createdGroup.updatedAt,
    });
  });

  app.get('/groups/me', { preHandler: requireRole(['staff', 'moderator']) }, async (request) => {
    const groups = await prismaClient.group.findMany({
      where: { memberships: { some: { userId: request.user!.userId } } },
      orderBy: { createdAt: 'asc' },
      include: {
        memberships: {
          where: { userId: request.user!.userId },
          select: { joinedAt: true, roleInGroup: true },
        },
      },
    });

    return groups.map((group) => ({
      id: group.id,
      name: group.name,
      createdByUserId: group.createdByUserId,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
      membership: group.memberships[0] ?? null,
    }));
  });

  app.post(
    '/groups/:id/join',
    { preHandler: requireRole(['staff', 'moderator']) },
    async (request, reply) => {
      const params = request.params as { id: string };
      const group = await prismaClient.group.findUnique({
        where: { id: params.id },
        select: { id: true },
      });

      if (!group) {
        return reply.code(404).send({ message: 'Group not found' });
      }

      const existingMembership = await prismaClient.groupMembership.findUnique({
        where: {
          groupId_userId: {
            groupId: params.id,
            userId: request.user!.userId,
          },
        },
      });

      if (existingMembership) {
        return reply.code(409).send({ message: 'Already a member of this group' });
      }

      const membership = await prismaClient.groupMembership.create({
        data: {
          groupId: params.id,
          userId: request.user!.userId,
          roleInGroup: 'MEMBER',
        },
      });

      return reply.code(201).send(membership);
    },
  );

  app.get('/workers/:id', { preHandler: requireRole(['staff']) }, async (request, reply) => {
    const params = request.params as { id: string };
    const worker = await prismaClient.worker.findUnique({
      where: { id: params.id },
      include: { flags: true },
    });

    if (!worker) {
      return reply.code(404).send({ message: 'Worker not found' });
    }

    return reply.send(mapPrismaWorkerToResponse(worker));
  });

  app.get(
    '/workers/:id/profile-analytics',
    { preHandler: requireRole(['staff', 'moderator']) },
    async (request, reply) => {
      const params = request.params as { id: string };

      if (request.user?.role !== 'staff') {
        return reply.code(403).send({ message: 'Forbidden' });
      }

      return reply.send({
        workerId: params.id,
        productivityScore: 88,
        attendanceScore: 94,
        flags: ['quality-audit-watch'],
      });
    },
  );

  app.get('/assignments', { preHandler: requireRole(['staff', 'moderator']) }, async () => {
    return Array.from(assignments.values()).map(withAssignmentView);
  });

  app.get('/dashboard/summary', { preHandler: requireRole(['staff', 'moderator']) }, async () => {
    return buildDashboardSummary();
  });

  app.post('/assignments', { preHandler: requireRole(['staff']) }, async (request, reply) => {
    const parsed = createAssignmentSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({ message: 'Invalid assignment payload' });
    }

    if (!workers.has(parsed.data.workerId)) {
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
    recalculateWorkerScoring(assignment.workerId);

    return reply.code(201).send(withAssignmentView(assignment));
  });

  app.get(
    '/assignments/:id',
    { preHandler: requireRole(['staff', 'moderator']) },
    async (request, reply) => {
      const params = request.params as { id: string };
      const assignment = assignments.get(params.id);

      if (!assignment) {
        return reply.code(404).send({ message: 'Assignment not found' });
      }

      return reply.send(withAssignmentView(assignment));
    },
  );

  app.post(
    '/assignments/:id/events',
    { preHandler: requireRole(['staff']) },
    async (request, reply) => {
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
      recalculateWorkerScoring(assignment.workerId);

      return reply.code(201).send(event);
    },
  );

  app.post(
    '/assignments/:id/staff-rating',
    { preHandler: requireRole(['staff']) },
    async (request, reply) => {
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
      recalculateWorkerScoring(assignment.workerId);

      return reply.code(201).send(rating);
    },
  );

  app.post(
    '/assignments/:id/customer-rating',
    { preHandler: requireRole(['moderator', 'staff']) },
    async (request, reply) => {
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
      recalculateWorkerScoring(assignment.workerId);

      return reply.code(201).send(rating);
    },
  );

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
