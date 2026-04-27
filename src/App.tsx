import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { LoginPage } from '@/features/auth/LoginPage';
import { OffersListPage } from '@/features/offers/OffersListPage';
import { OfferDetailPage } from '@/features/offers/OfferDetailPage';
import { PostbacksListPage } from '@/features/postbacks/PostbacksListPage';
import { PostbackDetailPage } from '@/features/postbacks/PostbackDetailPage';
import { ReportsPage } from '@/features/reports/ReportsPage';
import { ConnectionsPage } from '@/features/connections/ConnectionsPage';
import { GoogleAdsOAuthCallbackPage } from '@/features/connections/GoogleAdsOAuthCallbackPage';
import { SettingsPage } from '@/features/settings/SettingsPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/reports" replace />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/offers" element={<OffersListPage />} />
        <Route path="/offers/:id" element={<OfferDetailPage />} />
        <Route path="/postbacks" element={<PostbacksListPage />} />
        <Route path="/postbacks/:id" element={<PostbackDetailPage />} />
        <Route path="/connections" element={<ConnectionsPage />} />
        <Route path="/oauth/google-ads/callback" element={<GoogleAdsOAuthCallbackPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/reports" replace />} />
    </Routes>
  );
}
