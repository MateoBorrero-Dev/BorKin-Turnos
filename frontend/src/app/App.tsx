import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "../features/auth/AuthContext";
import { PermissionRoute, ProtectedRoute } from "../features/auth/ProtectedRoutes";
import { AppLayout } from "../layouts/AppLayout";
import { DashboardPage } from "../pages/DashboardPage";
import { LoginPage } from "../pages/LoginPage";
import { UsersPage } from "../pages/UsersPage";
import { SettingsPage } from "../pages/SettingsPage";
import { ServicesPage } from "../pages/ServicesPage";
import { EmployeesPage } from "../pages/EmployeesPage";

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } });

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route index element={<DashboardPage />} />
                <Route element={<PermissionRoute permission="services.manage" />}><Route path="services" element={<ServicesPage />} /></Route>
                <Route element={<PermissionRoute permission="employees.manage" />}><Route path="employees" element={<EmployeesPage />} /></Route>
                <Route element={<PermissionRoute permission="settings.manage" />}><Route path="settings" element={<SettingsPage />} /></Route>
                <Route element={<PermissionRoute permission="users.manage" />}><Route path="users" element={<UsersPage />} /></Route>
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <Toaster position="top-right" richColors closeButton />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
