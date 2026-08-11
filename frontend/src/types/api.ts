export type BusinessSummary = { id: string; name: string; locale: string; currency: string; timezone: string; primaryColor: string };
export type RoleSummary = { id: string; code: string; name: string };
export type AuthUser = {
  id: string; businessId: string; username: string; email: string; firstName: string; lastName: string;
  role: RoleSummary; permissions: string[]; business: BusinessSummary;
};
export type AuthPayload = { accessToken: string; user: AuthUser };
export type ApiEnvelope<T> = { success: true; data: T };
export type ApiErrorBody = { success: false; message: string; code?: string };
export type UserRow = {
  id: string; username: string; email: string; firstName: string; lastName: string; active: boolean; lastLoginAt: string | null;
  role: RoleSummary; permissions: Array<{ effect: "ALLOW" | "DENY"; permission: { id: string; code: string; name: string } }>;
};
export type RoleWithPermissions = RoleSummary & { permissions: Array<{ permission: { id: string; code: string; name: string } }> };
export type Permission = { id: string; code: string; name: string; description: string | null };
