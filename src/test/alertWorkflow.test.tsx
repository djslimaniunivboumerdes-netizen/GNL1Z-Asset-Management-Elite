import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/contexts/I18nContext";
import AlertCenter from "@/pages/AlertCenter";
import type { FastAlert } from "@/integrations/supabase/types";

const mocks = vi.hoisted(() => ({
  insert: vi.fn(), update: vi.fn(), eq: vi.fn(), remove: vi.fn(), upload: vi.fn(),
  invalidateQueries: vi.fn(), toast: vi.fn(), alert: null as FastAlert | null,
}));
vi.mock("@/integrations/supabase/client", () => ({
  isSupabaseConfigured: true,
  supabase: {
    from: () => ({ insert: mocks.insert, update: () => ({ eq: mocks.eq }), delete: () => ({ eq: mocks.remove }) }),
    storage: { from: () => ({ upload: mocks.upload, getPublicUrl: (path: string) => ({ data: { publicUrl: `https://example.test/${path}` } }) }) },
  },
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "user-1" } }) }));
vi.mock("@/lib/fastAlerts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/fastAlerts")>()),
  useFastAlerts: () => ({ data: mocks.alert ? [mocks.alert] : [], isPending: false, error: null, refetch: vi.fn(), isFetching: false }),
}));
vi.mock("@/lib/imageCompress", () => ({ compressToWebP: vi.fn(async () => new Blob(["isolated"], { type: "image/webp" })) }));
vi.mock("@/hooks/use-toast", () => ({ toast: mocks.toast }));

const alert: FastAlert = {
  id: "alert-1", alert_type: "leakage", priority: "P1", location: "T100", description: "Isolated fixture",
  photo_url: null, status: "OPEN", created_at: "2026-10-01T10:00:00Z",
};
function wrap(route = "/alerts?report=1") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}><I18nProvider><MemoryRouter initialEntries={[route]}><AlertCenter /></MemoryRouter></I18nProvider></QueryClientProvider>);
}
async function completeForm(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(screen.getByLabelText(/^Type/), "leakage");
  await user.selectOptions(screen.getByLabelText(/^Location/), "T100");
  await user.type(screen.getByLabelText(/What did you observe/), "Isolated retry fixture");
}

describe("alert submission and action recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks(); mocks.alert = null;
    mocks.insert.mockResolvedValue({ error: null }); mocks.eq.mockResolvedValue({ error: null });
    mocks.remove.mockResolvedValue({ error: null }); mocks.upload.mockResolvedValue({ error: null });
    mocks.invalidateQueries.mockResolvedValue(undefined);
  });
  it("reuses the observation ID and photo path after a dropped response", async () => {
    const user = userEvent.setup(); wrap(); await completeForm(user);
    await user.upload(screen.getByLabelText(/Attach photo|alert-photo/i), new File(["isolated"], "incident.png", { type: "image/png" }));
    mocks.insert.mockRejectedValueOnce(new Error("Connection dropped"));
    await user.click(screen.getByRole("button", { name: "Submit observation" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Connection dropped");
    const firstId = mocks.insert.mock.calls[0][0].id;
    const firstPath = mocks.upload.mock.calls[0][0];
    mocks.upload.mockResolvedValueOnce({ error: { statusCode: "409", message: "The resource already exists" } });
    await user.click(screen.getByRole("button", { name: "Submit observation" }));
    await waitFor(() => expect(mocks.insert).toHaveBeenCalledTimes(2));
    expect(mocks.insert.mock.calls[1][0].id).toBe(firstId);
    expect(mocks.upload.mock.calls[1][0]).toBe(firstPath);
  });
  it("recovers a committed insert without resetting its status", async () => {
    const user = userEvent.setup(); wrap(); await completeForm(user);
    mocks.insert.mockResolvedValueOnce({ error: { code: "23505", message: "Duplicate key" } });
    await user.click(screen.getByRole("button", { name: "Submit observation" }));
    await waitFor(() => expect(mocks.eq).toHaveBeenCalledWith("id", mocks.insert.mock.calls[0][0].id));
    expect(mocks.eq.mock.calls[0]).not.toContain("status");
  });
  it("clears the busy state when closing an observation throws a network error", async () => {
    mocks.alert = alert; const user = userEvent.setup(); wrap("/alerts");
    mocks.eq.mockRejectedValueOnce(new Error("Network unavailable"));
    await user.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Update failed" })));
    expect(screen.getByRole("button", { name: "Close" })).toBeEnabled();
  });
});
