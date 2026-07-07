const STORAGE_PROJECT = import.meta.env.VITE_SUPABASE_URL || "https://gdkqetzkhgllwbpmqmux.supabase.co";
const BASE = `${STORAGE_PROJECT}/storage/v1/object/public/equipment-images`;

export const storageUrls = {
  qr:  (id: string) => `${STORAGE_PROJECT}/functions/v1/qr-generator?id=${encodeURIComponent(id)}&format=png`,
  pid: (id: string) => `${BASE}/equipment/${encodeURIComponent(id.replace(/^X\d+-/, ""))}.pdf`,
  dcs: (f: string)  => `${BASE}/dcs/${encodeURIComponent(f)}`,
};
