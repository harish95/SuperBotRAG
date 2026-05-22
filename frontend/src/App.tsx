import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { DashboardLayout } from "@/layouts/dashboard-layout";
import { AdminPage } from "@/pages/admin-page";
import { DocumentsPage } from "@/pages/documents-page";
import { ChatPage } from "@/pages/chat-page";
import { LoginPage } from "@/pages/login-page";
import { RegisterPage } from "@/pages/register-page";
import { SettingsPage } from "@/pages/settings-page";
import { UploadsPage } from "@/pages/uploads-page";
import { useAuthStore } from "@/stores/authStore";
import { LoadingSpinner } from "@/components/loading-spinner";
import { ProtectedRoute } from "@/components/protected-route";

export default function App() {
  const initializeAuth = useAuthStore((state) => state.initializeAuth);
  const initialized = useAuthStore((state) => state.initialized);

  useEffect(() => {
    void initializeAuth();
  }, [initializeAuth]);

  if (!initialized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LoadingSpinner label="Loading workspace" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/chat" replace />} />
        <Route path="chat" element={<ChatPage />} />
        <Route path="documents" element={<DocumentsPage />} />
        <Route path="uploads" element={<UploadsPage />} />
        <Route
          path="admin"
          element={
            <ProtectedRoute requireAdmin>
              <AdminPage />
            </ProtectedRoute>
          }
        />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/chat" replace />} />
    </Routes>
  );
}
