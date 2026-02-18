import type { UserRole } from '@crewpulse/contracts';

const STORAGE_KEY = 'crewpulse.auth';

export type AuthState = {
  token: string;
  role: UserRole;
  userId: string;
};

const toPersistedAuth = (state: AuthState): AuthState => ({
  token: state.token,
  role: state.role,
  userId: state.userId,
});

export const readAuthState = (): AuthState | null => {
  const raw = window.localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AuthState>;

    if (
      typeof parsed.token !== 'string' ||
      typeof parsed.role !== 'string' ||
      typeof parsed.userId !== 'string'
    ) {
      return null;
    }

    return toPersistedAuth(parsed as AuthState);
  } catch {
    return null;
  }
};

export const writeAuthState = (state: AuthState) => {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(toPersistedAuth(state)));
};

export const clearAuthState = () => {
  window.localStorage.removeItem(STORAGE_KEY);
};
