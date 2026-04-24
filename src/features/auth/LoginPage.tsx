import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { auth } from '@/lib/auth';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ThemeToggle } from '@/components/ThemeToggle';

interface LoginResponse {
  token: string;
  email: string;
  expiresAt: string;
}

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await api<LoginResponse>('/api/auth/login', {
        method: 'POST',
        body: { email, password },
      });
      auth.setSession(res.token, res.email, res.expiresAt);
      navigate('/offers', { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError('Invalid email or password.');
      } else {
        setError('Could not sign in. Try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-slate-50 p-4 dark:bg-neutral-950">
      <div className="absolute right-4 top-4">
        <ThemeToggle variant="compact" />
      </div>
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-7 shadow-card dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-card-dark">
        <div className="mb-6 flex items-center gap-2">
          <LayoutDashboard className="h-5 w-5 text-brand-600" />
          <span className="text-sm font-semibold text-slate-900 dark:text-neutral-100">Tracking · Admin</span>
        </div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-neutral-100">Sign in</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-neutral-400">
          Use the admin credentials configured on the tracking backend.
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label className="label" htmlFor="email">Email</label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-100 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/30">
              {error}
            </div>
          )}

          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </div>
    </div>
  );
}
