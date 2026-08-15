import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { LoadingScreen } from "../components/LoadingScreen";
import { AuthProvider } from "../features/auth/AuthContext";
import { PermissionRoute, ProtectedRoute } from "../features/auth/ProtectedRoutes";
import { AppLayout } from "../layouts/AppLayout";

const DashboardPage = lazy(() => import("../pages/DashboardPage").then((module) => ({ default: module.DashboardPage })));
const LoginPage = lazy(() => import("../pages/LoginPage").then((module) => ({ default: module.LoginPage })));
const UsersPage = lazy(() => import("../pages/UsersPage").then((module) => ({ default: module.UsersPage })));
const SettingsPage = lazy(() => import("../pages/SettingsPage").then((module) => ({ default: module.SettingsPage })));
const ServicesPage = lazy(() => import("../pages/ServicesPage").then((module) => ({ default: module.ServicesPage })));
const EmployeesPage = lazy(() => import("../pages/EmployeesPage").then((module) => ({ default: module.EmployeesPage })));
const ClientsPage = lazy(() => import("../pages/ClientsPage").then((module) => ({ default: module.ClientsPage })));
const ClientDetailPage = lazy(() => import("../pages/ClientDetailPage").then((module) => ({ default: module.ClientDetailPage })));
const AgendaPage = lazy(() => import("../pages/AgendaPage").then((module) => ({ default: module.AgendaPage })));
const CashPage = lazy(() => import("../pages/CashPage").then((module) => ({ default: module.CashPage })));
const StatisticsPage = lazy(() => import("../pages/StatisticsPage").then((module) => ({ default: module.StatisticsPage })));
const ReportsPage = lazy(() => import("../pages/ReportsPage").then((module) => ({ default: module.ReportsPage })));
const AuditPage = lazy(() => import("../pages/AuditPage").then((module) => ({ default: module.AuditPage })));

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } });

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<LoadingScreen />}><Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route index element={<DashboardPage />} />
                <Route element={<PermissionRoute permission="appointments.view" />}><Route path="agenda" element={<AgendaPage />} /></Route>
                <Route element={<PermissionRoute permission="services.manage" />}><Route path="services" element={<ServicesPage />} /></Route>
                <Route element={<PermissionRoute permission="employees.manage" />}><Route path="employees" element={<EmployeesPage />} /></Route>
                <Route element={<PermissionRoute permission="clients.view" />}><Route path="clients" element={<ClientsPage />} /><Route path="clients/:id" element={<ClientDetailPage />} /></Route>
                <Route element={<PermissionRoute permission="cash.view" />}><Route path="cash" element={<CashPage />} /></Route>
                <Route element={<PermissionRoute permission="statistics.view" />}><Route path="statistics" element={<StatisticsPage />} /></Route>
                <Route element={<PermissionRoute permission="reports.view" />}><Route path="reports" element={<ReportsPage />} /></Route>
                <Route element={<PermissionRoute permission="audit.view" />}><Route path="audit" element={<AuditPage />} /></Route>
                <Route element={<PermissionRoute permission="settings.manage" />}><Route path="settings" element={<SettingsPage />} /></Route>
                <Route element={<PermissionRoute permission="users.manage" />}><Route path="users" element={<UsersPage />} /></Route>
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes></Suspense>
          <Toaster position="top-right" richColors closeButton />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
