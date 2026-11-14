import React, { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { MapsProviderWrapper } from './context/MapsContext.tsx';
import { LandingPage } from './pages/LandingPage.tsx';
import { AuthPage } from './pages/AuthPage.tsx';
import { CustomerDashboard } from './pages/CustomerDashboard.tsx';
import { DriverDashboard } from './pages/DriverDashboard.tsx';
import { OwnerDashboard } from './pages/OwnerDashboard.tsx';
import { TrackingPage } from './pages/TrackingPage.tsx';
import type { UserRole } from './types.ts';

function ProtectedRoute({
  allowedRole,
  children,
}: {
  allowedRole: UserRole;
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
        <div className="bg-white border border-slate-200 rounded-xl px-6 py-5 shadow-sm text-center">
          <div className="w-8 h-8 rounded-full border-2 border-[#0f2942] border-t-transparent animate-spin mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-700">Verifying RouteBack session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to={`/login/${allowedRole}`} replace />;
  }

  if (user.role !== allowedRole) {
    return <Navigate to={`/dashboard/${user.role}`} replace />;
  }

  return <>{children}</>;
}

function DashboardIndexRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login/customer" replace />;
  return <Navigate to={`/dashboard/${user.role}`} replace />;
}

export default function App() {
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  useEffect(() => {
    const handler = () => setQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handler);
    return () => window.removeEventListener('gmp-quota-exceeded', handler);
  }, []);

  return (
    <AuthProvider>
      <MapsProviderWrapper quotaExceeded={quotaExceeded}>
        {quotaExceeded && (
          <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
            <span>
              Google Maps Platform quota reached. If you are the app owner, visit{' '}
              <a
                href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-semibold text-amber-950 hover:text-amber-800"
              >
                maps developer site
              </a>{' '}
              for instructions to update your account.
            </span>
          </div>
        )}

        <Routes>
          <Route path="/" element={<LandingPage />} />

          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/login/:role" element={<AuthPage mode="login" />} />

          <Route path="/register" element={<AuthPage mode="register" />} />
          <Route path="/register/:role" element={<AuthPage mode="register" />} />

          <Route path="/dashboard" element={<DashboardIndexRedirect />} />
          <Route
            path="/dashboard/customer"
            element={
              <ProtectedRoute allowedRole="customer">
                <CustomerDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/driver"
            element={
              <ProtectedRoute allowedRole="driver">
                <DriverDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/owner"
            element={
              <ProtectedRoute allowedRole="owner">
                <OwnerDashboard />
              </ProtectedRoute>
            }
          />

          <Route path="/track" element={<TrackingPage />} />
          <Route path="/track/:bookingId" element={<TrackingPage />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </MapsProviderWrapper>
    </AuthProvider>
  );
}
