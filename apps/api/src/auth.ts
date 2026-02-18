import crypto from 'node:crypto';

import { USER_ROLES, type UserRole } from '@crewpulse/contracts';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

const tokenSchema = z.string().startsWith('Bearer ').transform((value) => value.slice('Bearer '.length));

const users = [
  { id: 'staff-1', role: 'staff' },
  { id: 'customer-1', role: 'customer' },
  { id: 'worker-1', role: 'worker' },
] as const;

const loginSchema = z.object({
  userId: z.enum(users.map((user) => user.id) as [string, ...string[]]),
});

type Session = {
  token: string;
  userId: string;
  role: UserRole;
};

const sessions = new Map<string, Session>();

const rolesSet = new Set<string>(USER_ROLES);

export type AuthSession = Session;

export const login = (userId: string): Session | null => {
  const user = users.find((entry) => entry.id === userId);

  if (!user || !rolesSet.has(user.role)) {
    return null;
  }

  const token = crypto.randomBytes(24).toString('hex');
  const session = { token, userId: user.id, role: user.role };
  sessions.set(token, session);

  return session;
};

export const parseLoginPayload = (body: unknown) => loginSchema.safeParse(body);

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

export const listSeedUsers = () => users;
