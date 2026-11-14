import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiRequest, getStoredToken, setStoredToken } from '../lib/api.ts';
import type { User, UserRole, Vehicle } from '../types.ts';

interface AuthState {
  user: User | null;
  profile: Record<string, unknown> | null;
  assignedVehicle: Vehicle | null;
  loading: boolean;
  login: (identifier: string, password: string, role?: UserRole) => Promise<User>;
  register: (payload: Record<string, unknown>) => Promise<User>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [assignedVehicle, setAssignedVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const refreshMe = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setUser(null);
      setProfile(null);
      setAssignedVehicle(null);
      setLoading(false);
      return;
    }
    try {
      const data = await apiRequest<{
        user: User;
        profile: Record<string, unknown> | null;
        assignedVehicle: Vehicle | null;
      }>('/auth/me');
      setUser(data.user);
      setProfile(data.profile);
      setAssignedVehicle(data.assignedVehicle);
    } catch {
      setStoredToken(null);
      setUser(null);
      setProfile(null);
      setAssignedVehicle(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshMe();
  }, [refreshMe]);

  const login = useCallback(
    async (identifier: string, password: string, role?: UserRole): Promise<User> => {
      const data = await apiRequest<{
        token: string;
        user: User;
        profile: Record<string, unknown> | null;
        assignedVehicle: Vehicle | null;
      }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier, password, role }),
      });
      setStoredToken(data.token);
      setUser(data.user);
      setProfile(data.profile);
      setAssignedVehicle(data.assignedVehicle);
      return data.user;
    },
    []
  );

  const register = useCallback(async (payload: Record<string, unknown>): Promise<User> => {
    const data = await apiRequest<{
      token: string;
      user: User;
      profile: Record<string, unknown> | null;
      assignedVehicle: Vehicle | null;
    }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setStoredToken(data.token);
    setUser(data.user);
    setProfile(data.profile);
    setAssignedVehicle(data.assignedVehicle);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } catch {
      // ignore network failures during logout
    }
    setStoredToken(null);
    setUser(null);
    setProfile(null);
    setAssignedVehicle(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, profile, assignedVehicle, loading, login, register, logout, refreshMe }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
