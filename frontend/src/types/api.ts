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
export type AppointmentStatus = "PENDIENTE" | "CONFIRMADO" | "EN_CURSO" | "COMPLETADO" | "CANCELADO" | "AUSENTE";
export type PaymentMethodKind = "CASH" | "DEBIT_CARD" | "CREDIT_CARD" | "TRANSFER" | "OTHER";
export type Payment = { id: string; amount: string; status: "REGISTRADO" | "REVERTIDO"; adjustmentReason: string | null; createdAt: string; paymentMethod: { id: string; name: string; kind: PaymentMethodKind }; recordedBy: { id: string; firstName: string; lastName: string } };
export type Appointment = {
  id: string; clientId: string; serviceId: string; employeeId: string; startAt: string; endAt: string;
  durationMinutes: number; serviceName: string; price: string; status: AppointmentStatus; notes: string | null; version: number;
  client: { id: string; firstName: string; lastName: string | null; phone: string | null; phoneNormalized: string | null; whatsapp: string | null; active: boolean };
  service: { id: string; name: string; color: string; active: boolean };
  employee: { id: string; firstName: string; lastName: string; color: string; photoUrl: string | null; active: boolean };
  statusEvents: Array<{ id: string; fromStatus: AppointmentStatus | null; toStatus: AppointmentStatus; reason: string | null; createdAt: string; user: { firstName: string; lastName: string } }>;
  payments: Payment[];
};
export type AgendaBlock = { id: string; employeeId: string | null; startAt: string; endAt: string; allDay: boolean; reason: string; customReason: string | null; employee: { id: string; firstName: string; lastName: string; color: string } | null };
export type AgendaData = { appointments: Appointment[]; blocks: AgendaBlock[] };
export type AppointmentOptions = {
  services: Array<{ id: string; name: string; durationMinutes: number; price: string; color: string }>;
  employees: Array<{ id: string; firstName: string; lastName: string; color: string }>;
};
export type Availability = { date: string; timezone: string; durationMinutes: number; slotMinutes: number; slots: Array<{ date: string; time: string; startAt: string; endAt: string; durationMinutes: number }> };
export type ClientAppointmentHistory = {
  items: Array<{ id: string; startAt: string; endAt: string; serviceName: string; price: string; status: AppointmentStatus; employee: { id: string; firstName: string; lastName: string }; payments: Array<{ id: string; amount: string; paymentMethod: { name: string; kind: PaymentMethodKind } }> }>;
  meta: PageMeta;
  summary: { appointmentCount: number; completedCount: number; lastVisit: { id: string; startAt: string } | null; nextAppointment: { id: string; startAt: string; serviceName: string } | null };
};
export type PaymentMethodOption = { id: string; name: string; kind: PaymentMethodKind };
export type CashMovementType = "VENTA" | "INGRESO_MANUAL" | "EGRESO" | "RETIRO";
export type CashMovement = { id: string; type: CashMovementType; concept: string; amount: string; occurredAt: string; paymentMethod: PaymentMethodOption | null; createdBy: { id: string; firstName: string; lastName: string } };
export type CashTotals = { paymentCount: number; totalPayments: string; totalSales: string; cashSales: string; nonCashSales: string; manualIncome: string; expenses: string; withdrawals: string; expectedCash: string; byMethod: Array<PaymentMethodOption & { paymentMethodId: string; amount: string; count: number }> };
export type CashRegister = { id: string; status: "ABIERTA" | "CERRADA"; openedAt: string; closedAt: string | null; openingAmount: string; openingNotes: string | null; expectedCash: string | null; countedCash: string | null; difference: string | null; closingNotes: string | null; openedBy: { id: string; firstName: string; lastName: string }; closedBy: { id: string; firstName: string; lastName: string } | null; totals: CashTotals; recentMovements: CashMovement[] };
export type CashHistoryPage = { items: CashRegister[]; meta: PageMeta };
export type CashMovementPage = { items: CashMovement[]; meta: PageMeta };
