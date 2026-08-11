import { Navigate, Outlet, useLocation } from "react-router-dom";
import { LoadingScreen } from "../../components/LoadingScreen";
import { useAuth } from "../../hooks/useAuth";
import { hasPermission } from "../../utils/permissions";

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

export function PermissionRoute({ permission }: { permission: string }) {
  const { user } = useAuth();
  if (!user || !hasPermission(user.permissions, permission)) return <Navigate to="/" replace />;
  return <Outlet />;
}
