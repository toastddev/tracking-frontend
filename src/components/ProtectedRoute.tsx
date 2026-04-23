import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { auth } from '@/lib/auth';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [authed, setAuthed] = useState(auth.isAuthenticated());

  useEffect(() => auth.subscribe(() => setAuthed(auth.isAuthenticated())), []);

  if (!authed) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}
