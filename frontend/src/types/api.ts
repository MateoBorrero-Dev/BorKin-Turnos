export type BusinessSummary = { id: string; name: string; locale: string; currency: string; timezone: string; primaryColor: string; logoUrl?: string | null };
export type RoleSummary = { id: string; code: string; name: string };
export type AuthUser = {
  id: string; businessId: string; username: string; email: string; firstName: string; lastName: string;
  role: RoleSummary; permissions: string[]; business: BusinessSummary;
};
export type AuthPayload = { accessToken: string; user: AuthUser };
export type PageMeta = { page: number; pageSize: number; total: number; totalPages: number };
export type ApiEnvelope<T> = { success: true; data: T; meta?: PageMeta };
export type ApiErrorBody = { success: false; message: string; code?: string; details?: unknown };
export type UserRow = {
  id: string; username: string; email: string; firstName: string; lastName: string; active: boolean; lastLoginAt: string | null;
  role: RoleSummary; permissions: Array<{ effect: "ALLOW" | "DENY"; permission: { id: string; code: string; name: string } }>;
};
export type RoleWithPermissions = RoleSummary & { permissions: Array<{ permission: { id: string; code: string; name: string } }> };
export type Permission = { id: string; code: string; name: string; description: string | null };
export type BusinessSettings = BusinessSummary & { logoUrl: string | null; phone: string | null; whatsapp: string | null; email: string | null; address: string | null; instagram: string | null; active: boolean };
export type Category = { id: string; name: string; description: string | null; active: boolean };
export type Service = { id: string; name: string; description: string | null; price: string; durationMinutes: number; color: string; active: boolean; category: { id: string; name: string; active: boolean } | null };
export type Employee = { id: string; firstName: string; lastName: string; phone: string | null; email: string | null; photoUrl: string | null; color: string; active: boolean };
export type EmployeeDetail = Employee & { services: Array<{ serviceId: string; service: Service }>; schedules: ScheduleInterval[] };
export type ScheduleInterval = { id?: string; dayOfWeek: number; startTime: string; endTime: string; startMinute?: number; endMinute?: number };
export type ScheduleBlock = { id: string; employeeId: string; startAt: string; endAt: string; allDay: boolean; reason: string; customReason: string | null; employee: { id: string; firstName: string; lastName: string } };
export type Client = {
  id: string; firstName: string; lastName: string | null; fullName: string; phone: string | null; phoneNormalized: string | null;
  email: string | null; birthDate: string | null; notes: string | null; active: boolean; createdAt: string; updatedAt: string;
};
export type ClientPage = { items: Client[]; meta: PageMeta };
export type DuplicateClient = { id: string; fullName: string; phone: string | null; email: string | null; reasons: Array<"phone" | "email"> };
