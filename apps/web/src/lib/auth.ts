import type { UserRole } from '@crewpulse/contracts';

const STORAGE_KEY = 'crewpulse.auth';

export type AuthState = {
  token: string;
  role: UserRole;
  userId: string;
};

export const readAuthState = (): AuthState | null => {
  const raw = window.localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AuthState;
  } catch {
    return null;
  }
};

export const writeAuthState = (state: AuthState) => {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

export const clearAuthState = () => {
  window.localStorage.removeItem(STORAGE_KEY);
};
