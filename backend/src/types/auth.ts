export type SessionUser = {
  id: string;
  businessId: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: { id: string; code: string; name: string };
  permissions: string[];
  business: { id: string; name: string; locale: string; currency: string; timezone: string; primaryColor: string };
};
