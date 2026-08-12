import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../services/api/client";
import { ClientAutocomplete, type ClientOption } from "./AgendaPage";

vi.mock("../services/api/client", () => ({
  apiRequest: vi.fn(),
  ApiClientError: class ApiClientError extends Error { constructor(message: string, public status: number, public code?: string) { super(message); } },
}));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

function Harness({ initial = null }: { initial?: ClientOption | null }) { const [value, setValue] = useState<ClientOption | null>(initial); return <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><ClientAutocomplete value={value} onChange={setValue} /></QueryClientProvider>; }

describe("autocomplete remoto de clientes", () => {
  it("aplica debounce, consulta backend y permite seleccionar un resultado", async () => { vi.mocked(apiRequest).mockResolvedValue([{ id: "cliente-25", fullName: "Cliente Remoto 25", phone: "+54 9 351 000 0025" }]); render(<Harness />); const input = screen.getByRole("combobox", { name: "Buscar cliente" }); fireEvent.change(input, { target: { value: "Cliente Remoto" } }); expect(apiRequest).not.toHaveBeenCalled(); await waitFor(() => expect(apiRequest).toHaveBeenCalledWith("/clients/options?search=Cliente%20Remoto&limit=8"), { timeout: 1_500 }); fireEvent.click(await screen.findByRole("option", { name: /Cliente Remoto 25/ })); expect(screen.getByText(/Seleccionado: Cliente Remoto 25/)).toBeTruthy(); fireEvent.change(input, { target: { value: "otra persona" } }); expect(screen.queryByText(/Seleccionado:/)).toBeNull(); });
  it("muestra el cliente actual al editar sin descargar el padrón", async () => { render(<Harness initial={{ id: "actual", fullName: "Cliente Actual", phone: "3510000000" }} />); expect((screen.getByRole("combobox", { name: "Buscar cliente" }) as HTMLInputElement).value).toBe("Cliente Actual"); expect(screen.getByText(/Seleccionado: Cliente Actual/)).toBeTruthy(); await new Promise((resolve) => window.setTimeout(resolve, 350)); expect(apiRequest).not.toHaveBeenCalled(); });
});
