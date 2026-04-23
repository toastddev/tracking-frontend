import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { LoginPage } from '@/features/auth/LoginPage';
import { OffersListPage } from '@/features/offers/OffersListPage';
import { OfferDetailPage } from '@/features/offers/OfferDetailPage';
import { PostbacksListPage } from '@/features/postbacks/PostbacksListPage';
import { PostbackDetailPage } from '@/features/postbacks/PostbackDetailPage';

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
        <Route index element={<Navigate to="/offers" replace />} />
        <Route path="/offers" element={<OffersListPage />} />
        <Route path="/offers/:id" element={<OfferDetailPage />} />
        <Route path="/postbacks" element={<PostbacksListPage />} />
        <Route path="/postbacks/:id" element={<PostbackDetailPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/offers" replace />} />
    </Routes>
  );
}
