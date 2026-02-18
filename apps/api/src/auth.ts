import crypto from 'node:crypto';

import type { FastifyReply, FastifyRequest } from 'fastify';
import { compare, hash } from 'bcryptjs';
import { z } from 'zod';

import { env } from './env.js';

const tokenSchema = z
  .string()
  .startsWith('Bearer ')
  .transform((value) => value.slice('Bearer '.length));

const loginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
});

const createUserSchema = z.object({
  username: z.string().trim().min(3).max(64),
  password: z.string().min(8).max(128),
  role: z.enum(['staff', 'moderator']),
});

const apiRoleToDbRole = {
  staff: 'STAFF',
  moderator: 'MODERATOR',
} as const;

const dbRoleToApiRole = {
  STAFF: 'staff',
  MODERATOR: 'moderator',
} as const;

export type UserRole = keyof typeof apiRoleToDbRole;

type Session = {
  token: string;
  userId: string;
  role: UserRole;
};

type AuthPrismaClient = {
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
};

const sessions = new Map<string, Session>();

export type AuthSession = Session;

const buildSessionToken = () => {
  const nonce = crypto.randomBytes(24).toString('hex');
  return crypto.createHmac('sha256', env.AUTH_SESSION_SECRET).update(nonce).digest('hex');
};

export const login = async (
  prismaClient: AuthPrismaClient,
  credentials: z.infer<typeof loginSchema>,
): Promise<Session | null> => {
  const user = await prismaClient.user.findUnique({
    where: { username: credentials.username },
    select: { id: true, username: true, passwordHash: true, role: true },
  });

  if (!user?.passwordHash) {
    return null;
  }

  const passwordValid = await compare(credentials.password, user.passwordHash);

  if (!passwordValid) {
    return null;
  }

  const token = buildSessionToken();
  const session = { token, userId: user.id, role: dbRoleToApiRole[user.role] };
  sessions.set(token, session);

  return session;
};

export const createUser = async (
  prismaClient: AuthPrismaClient,
  payload: z.infer<typeof createUserSchema>,
): Promise<{ id: string; username: string; role: UserRole }> => {
  const passwordHash = await hash(payload.password, 12);
  const user = await prismaClient.user.create({
    data: {
      username: payload.username,
      passwordHash,
      role: apiRoleToDbRole[payload.role],
    },
    select: {
      id: true,
      username: true,
      role: true,
    },
  });

  return {
    id: user.id,
    username: user.username,
    role: dbRoleToApiRole[user.role],
  };
};

export const parseLoginPayload = (body: unknown) => loginSchema.safeParse(body);

export const parseCreateUserPayload = (body: unknown) => createUserSchema.safeParse(body);

export const getSessionFromRequest = (request: FastifyRequest): Session | null => {
  const header = request.headers.authorization;

  if (!header) {
    return null;
  }

  const parsedToken = tokenSchema.safeParse(header);

  if (!parsedToken.success) {
    return null;
  }

  return sessions.get(parsedToken.data) ?? null;
};

export const requireRole =
  (allowedRoles: UserRole[]) =>
  async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const session = getSessionFromRequest(request);

    if (!session) {
      void reply.code(401).send({ message: 'Unauthorized' });
      return;
    }

    if (!allowedRoles.includes(session.role)) {
      void reply.code(403).send({ message: 'Forbidden' });
      return;
    }

    request.user = session;
  };

export const clearSessionsForTests = () => {
  sessions.clear();
};
