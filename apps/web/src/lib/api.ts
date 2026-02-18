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

export type AssignmentEventType = 'completed' | 'late' | 'sent_home' | 'ncns';

export type WorkerRecord = {
  id: string;
  name: string;
  score: number;
  performanceScore: number;
  reliabilityScore: number;
  lateRate: number;
  ncnsRate: number;
  tier: string;
  flags: string[];
  phone?: string;
};

export type AssignmentRecord = {
  id: string;
  workerId: string;
  category: string;
  scheduledStart: string;
  scheduledEnd?: string;
  createdAt: string;
  events: Array<{
    id: string;
    eventType: AssignmentEventType;
    notes?: string;
    recordedBy: string;
    occurredAt: string;
  }>;
  staffRating: null | {
    id: string;
    overall: number;
    tags: string[];
    internalNotes?: string;
    submittedAt: string;
    ratedBy: string;
  };
  worker?: WorkerRecord | null;
  customerRating: null | {
    id: string;
    overall: number;
    punctuality?: number;
    workEthic?: number;
    attitude?: number;
    quality?: number;
    safety?: number;
    wouldRehire?: boolean;
    comments?: string;
    submittedAt: string;
    ratedBy: string;
  };
};

const authedRequest = (auth: AuthState) => ({
  authorization: `Bearer ${auth.token}`,
  'content-type': 'application/json',
});

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

export const listAssignments = async (auth: AuthState): Promise<AssignmentRecord[]> => {
  const response = await fetch(`${API_BASE_URL}/assignments`, {
    headers: {
      authorization: `Bearer ${auth.token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to list assignments (${response.status})`);
  }

  return response.json() as Promise<AssignmentRecord[]>;
};

export const fetchAssignmentDetail = async (
  id: string,
  auth: AuthState,
): Promise<AssignmentRecord> => {
  const response = await fetch(`${API_BASE_URL}/assignments/${id}`, {
    headers: {
      authorization: `Bearer ${auth.token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch assignment (${response.status})`);
  }

  return response.json() as Promise<AssignmentRecord>;
};

export const createAssignment = async (
  auth: AuthState,
  payload: {
    workerId: string;
    category: string;
    scheduledStart: string;
    scheduledEnd?: string;
  },
) => {
  const response = await fetch(`${API_BASE_URL}/assignments`, {
    method: 'POST',
    headers: authedRequest(auth),
    body: JSON.stringify(payload),
  });

  return response;
};

export const createAssignmentEvent = async (
  assignmentId: string,
  auth: AuthState,
  payload: { eventType: AssignmentEventType; notes?: string },
) => {
  const response = await fetch(`${API_BASE_URL}/assignments/${assignmentId}/events`, {
    method: 'POST',
    headers: authedRequest(auth),
    body: JSON.stringify(payload),
  });

  return response;
};

export const submitStaffRating = async (
  assignmentId: string,
  auth: AuthState,
  payload: { overall: number; tags: string[]; internalNotes?: string },
) => {
  const response = await fetch(`${API_BASE_URL}/assignments/${assignmentId}/staff-rating`, {
    method: 'POST',
    headers: authedRequest(auth),
    body: JSON.stringify(payload),
  });

  return response;
};

export const submitCustomerRating = async (
  assignmentId: string,
  auth: AuthState,
  payload: {
    overall: number;
    punctuality?: number;
    workEthic?: number;
    attitude?: number;
    quality?: number;
    safety?: number;
    wouldRehire?: boolean;
    comments?: string;
  },
) => {
  const response = await fetch(`${API_BASE_URL}/assignments/${assignmentId}/customer-rating`, {
    method: 'POST',
    headers: authedRequest(auth),
    body: JSON.stringify(payload),
  });

  return response;
};
