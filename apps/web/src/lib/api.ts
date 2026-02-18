import type { UserRole } from '@crewpulse/contracts';

import type { AuthState } from './auth';

const API_BASE_URL = (() => {
  const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL;
  const sanitizeBaseUrl = (url: string) => url.replace(/\/+$/, '');

  if (configuredBaseUrl) {
    return sanitizeBaseUrl(configuredBaseUrl);
  }

  if (import.meta.env.DEV) {
    return 'http://localhost:4000';
  }

  const fallbackBaseUrl = sanitizeBaseUrl(window.location.origin);

  console.warn(
    `[api] Missing VITE_API_BASE_URL in production. Falling back to ${fallbackBaseUrl}.`,
  );

  return fallbackBaseUrl;
})();

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

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

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

export type CreateWorkerPayload = {
  employeeCode: string;
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
};

const authedRequest = (auth: AuthState) => ({
  authorization: `Bearer ${auth.token}`,
  'content-type': 'application/json',
});

const readApiMessage = async (response: Response): Promise<string | null> => {
  try {
    const data = (await response.json()) as { message?: unknown };
    return typeof data.message === 'string' ? data.message : null;
  } catch {
    return null;
  }
};

export const fetchHealth = async (): Promise<HealthResponse> => {
  const response = await fetch(`${API_BASE_URL}/health`);

  if (!response.ok) {
    throw new Error(`API health check failed: ${response.status}`);
  }

  return response.json() as Promise<HealthResponse>;
};

export const login = async (username: string, password: string): Promise<LoginResponse> => {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    const apiMessage = await readApiMessage(response);

    if (response.status === 401) {
      throw new ApiError('Invalid username or password.', response.status);
    }

    if (response.status === 400) {
      throw new ApiError('Please provide a valid username and password.', response.status);
    }

    throw new ApiError(apiMessage ?? 'Unable to sign in right now. Please try again.', response.status);
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

export const createWorker = async (auth: AuthState, payload: CreateWorkerPayload) => {
  const response = await fetch(`${API_BASE_URL}/workers`, {
    method: 'POST',
    headers: authedRequest(auth),
    body: JSON.stringify(payload),
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
