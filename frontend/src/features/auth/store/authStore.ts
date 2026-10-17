import { create } from 'zustand';
import type { AuthSession, AuthUser, LoginDto } from 'shared';
import { onUnauthorized } from '@/lib/authEvents';
import { queryClient } from '@/lib/queryClient';
import { authService } from '../services/authService';

type Status = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthState {
  status: Status;
  user: AuthUser | null;
  rememberMe: boolean;
  expiresAt: string | null;
  /** Asks the server whether the session cookie (if any) is still valid. */
  bootstrap: () => Promise<void>;
  login: (dto: LoginDto) => Promise<void>;
  logout: () => void;
  applySession: (session: AuthSession) => void;
  setUser: (user: AuthUser) => void;
}

// The session token is an httpOnly cookie managed by the browser and server; the store only holds
// non-sensitive display state, so there is nothing for page scripts to steal.
export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'loading',
  user: null,
  rememberMe: false,
  expiresAt: null,

  async bootstrap() {
    try {
      const me = await authService.me();
      set({ status: 'authenticated', user: me.user, rememberMe: me.rememberMe, expiresAt: me.expiresAt });
    } catch {
      set({ status: 'unauthenticated', user: null });
    }
  },

  async login(dto) {
    get().applySession(await authService.login(dto));
  },

  applySession(session) {
    set({ status: 'authenticated', user: session.user, rememberMe: session.rememberMe, expiresAt: session.expiresAt });
  },

  logout() {
    void authService.logout().catch(() => undefined); // server clears the cookie
    queryClient.clear();
    set({ status: 'unauthenticated', user: null, expiresAt: null });
  },

  setUser(user) {
    set({ user });
  },
}));

// Any 401 from the API (expired or revoked session) signs the user out.
onUnauthorized(() => {
  if (useAuthStore.getState().status === 'authenticated') useAuthStore.getState().logout();
});
