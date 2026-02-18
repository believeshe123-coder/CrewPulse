import type { UserRole } from '@crewpulse/contracts';

import type { AuthState } from './auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

export type HealthResponse = {
  status: string;
  service: string;
  uptime: number;
};

export type LoginResponse = {
  token: string;
  role: UserRole;
  userId: string;
};

export const fetchHealth = async (): Promise<HealthResponse> => {
  const response = await fetch(`${API_BASE_URL}/health`);

  if (!response.ok) {
    throw new Error(`API health check failed: ${response.status}`);
  }

  return response.json() as Promise<HealthResponse>;
};

export const login = async (userId: string): Promise<LoginResponse> => {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ userId }),
  });

  if (!response.ok) {
    throw new Error('Login failed');
  }

  return response.json() as Promise<LoginResponse>;
};

export const fetchWorkerProfile = async (id: string, auth: AuthState) => {
  const response = await fetch(`${API_BASE_URL}/workers/${id}`, {
    headers: {
      authorization: `Bearer ${auth.token}`,
    },
  });

  return response;
};

export const fetchWorkerAnalytics = async (id: string, auth: AuthState) => {
  const response = await fetch(`${API_BASE_URL}/workers/${id}/profile-analytics`, {
    headers: {
      authorization: `Bearer ${auth.token}`,
    },
  });

  return response;
};

export const submitAssignmentRating = async (assignmentId: string, auth: AuthState, rating: number) => {
  const response = await fetch(`${API_BASE_URL}/assignments/${assignmentId}/customer-rating`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${auth.token}`,
    },
    body: JSON.stringify({ rating }),
  });

  return response;
};
