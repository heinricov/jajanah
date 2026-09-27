'use client';

import * as React from 'react';
import type { AuthUser, LoginRequest, RegisterRequest } from '@packages/validators';

import type { AuthActionFailure, MeActionResult } from './server/action-types';
import { loginAction, logoutAction, meAction, registerAction } from './server/actions';
import { AuthActionError } from './errors';

export type AuthStatus = 'authenticated' | 'unauthenticated';

export type AuthContextValue = {
  status: AuthStatus;
  user: AuthUser | null;
  login: (request: LoginRequest) => Promise<AuthUser>;
  register: (request: RegisterRequest) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<AuthUser | null>;
};

const AuthContext = React.createContext<AuthContextValue | null>(null);

/** Naikkan hasil gagal server action (JSON polos) ke `AuthActionError`. */
function toActionError(failure: AuthActionFailure): AuthActionError {
  return new AuthActionError(failure.message, {
    status: failure.status,
    code: failure.code,
  });
}

export type AuthProviderProps = {
  /** User yang dibaca server dari cookie (`getSessionUser()`) — bootstrap tanpa fetch ganda. */
  initialUser: AuthUser | null;
  children: React.ReactNode;
};

export function AuthProvider({ initialUser, children }: AuthProviderProps) {
  const [user, setUser] = React.useState<AuthUser | null>(initialUser);
  const [status, setStatus] = React.useState<AuthStatus>(
    initialUser ? 'authenticated' : 'unauthenticated',
  );

  const refresh = React.useCallback(async (): Promise<AuthUser | null> => {
    const payload: MeActionResult = await meAction();
    const next = payload.user ?? null;
    setUser(next);
    setStatus(next ? 'authenticated' : 'unauthenticated');
    return next;
  }, []);

  const login = React.useCallback(async (request: LoginRequest): Promise<AuthUser> => {
    const payload = await loginAction(request);
    if (!payload.ok) throw toActionError(payload);
    setUser(payload.user);
    setStatus('authenticated');
    return payload.user;
  }, []);

  const register = React.useCallback(async (request: RegisterRequest): Promise<AuthUser> => {
    const payload = await registerAction(request);
    if (!payload.ok) throw toActionError(payload);
    setUser(payload.user);
    setStatus('authenticated');
    return payload.user;
  }, []);

  const logout = React.useCallback(async (): Promise<void> => {
    // Best-effort: cookie dihapus server-side; kegagalan transport tetap
    // dianggap logout lokal agar UI tidak terjebak di state terautentikasi.
    try {
      await logoutAction();
    } catch {
      // diabaikan
    }
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  const value = React.useMemo<AuthContextValue>(
    () => ({ status, user, login, register, logout, refresh }),
    [status, user, login, register, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = React.useContext(AuthContext);
  if (context === null) {
    throw new Error('useAuth harus dipakai di dalam <AuthProvider>.');
  }
  return context;
}
