const TOKEN_KEY = 'tracking_admin_token';
const EMAIL_KEY = 'tracking_admin_email';
const EXPIRES_KEY = 'tracking_admin_expires';

type Listener = () => void;
const listeners = new Set<Listener>();

function notify() {
  for (const l of listeners) l();
}

export const auth = {
  getToken(): string | null {
    const t = localStorage.getItem(TOKEN_KEY);
    if (!t) return null;
    const exp = localStorage.getItem(EXPIRES_KEY);
    if (exp && new Date(exp).getTime() < Date.now()) {
      this.clear();
      return null;
    }
    return t;
  },
  getEmail(): string | null {
    return localStorage.getItem(EMAIL_KEY);
  },
  setSession(token: string, email: string, expiresAt: string) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(EMAIL_KEY, email);
    localStorage.setItem(EXPIRES_KEY, expiresAt);
    notify();
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EMAIL_KEY);
    localStorage.removeItem(EXPIRES_KEY);
    notify();
  },
  isAuthenticated(): boolean {
    return this.getToken() !== null;
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
