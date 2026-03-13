import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../lib/api';

interface User {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
}

interface AuthState {
  user: User | null;
  workspaceId: string | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, workspaceId: null, loading: true });

  useEffect(() => {
    api.get('/auth/me')
      .then(r => {
        localStorage.removeItem('datapilot_dev_user');
        setState({
          user: r.data.user,
          workspaceId: r.data.workspaces?.[0]?.workspace_id ?? null,
          loading: false,
        });
      })
      .catch(() => {
        const stored = localStorage.getItem('datapilot_dev_user');
        if (stored) {
          try {
            const devUser = JSON.parse(stored) as User;
            setState({ user: devUser, workspaceId: 'dev', loading: false });
            return;
          } catch { /* ignore */ }
        }
        setState({ user: null, workspaceId: null, loading: false });
      });
  }, []);

  async function logout() {
    await api.post('/auth/logout').catch(() => {});
    localStorage.removeItem('datapilot_dev_user');
    setState({ user: null, workspaceId: null, loading: false });
    window.location.href = '/login';
  }

  return <AuthContext.Provider value={{ ...state, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
