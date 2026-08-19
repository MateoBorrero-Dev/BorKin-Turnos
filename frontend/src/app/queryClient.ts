import { QueryClient } from "@tanstack/react-query";
import { ApiClientError } from "../services/api/client";

export const queryClient = new QueryClient({ defaultOptions: { queries: {
  staleTime: 30_000,
  retry: (failureCount, error) => !(error instanceof ApiClientError && error.status >= 400 && error.status < 500) && failureCount < 1,
} } });
