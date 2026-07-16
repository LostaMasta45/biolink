import type { ApiResult } from "@/types/whatsapp-manager";

async function parseResponse<T>(response: Response): Promise<ApiResult<T>> {
  const raw = await response.text();
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error(`Server mengembalikan halaman ${response.status} (${response.statusText || "tanpa status"}), bukan respons API. Muat ulang dashboard; bila masih terjadi, deploy ulang versi aplikasi terbaru.`);
  }
  let payload: Partial<ApiResult<T>> & { error?: string };
  try {
    payload = JSON.parse(raw) as Partial<ApiResult<T>> & { error?: string };
  } catch {
    throw new Error("Respons API tidak dapat dibaca. Muat ulang dashboard dan coba kembali.");
  }
  if (!response.ok) throw new Error(payload.error ?? "Permintaan gagal diproses");
  return payload as ApiResult<T>;
}

export async function fetchManagerResource<T>(resource: string, query = ""): Promise<T[]> {
  const response = await fetch(`/api/admin/whatsapp/${resource}${query}`, { cache: "no-store" });
  const result = await parseResponse<T[]>(response);
  return result.data;
}

export async function createManagerResource<T>(resource: string, data: unknown): Promise<ApiResult<T>> {
  const response = await fetch(`/api/admin/whatsapp/${resource}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return parseResponse<T>(response);
}

export async function updateManagerResource<T>(resource: string, id: string, data: unknown): Promise<ApiResult<T>> {
  const response = await fetch(`/api/admin/whatsapp/${resource}/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return parseResponse<T>(response);
}

export async function deleteManagerResource(resource: string, id: string): Promise<ApiResult<null>> {
  const response = await fetch(`/api/admin/whatsapp/${resource}/${id}`, { method: "DELETE" });
  return parseResponse<null>(response);
}

export async function runManagerAction<T>(action: string, extra?: Record<string, string>): Promise<T> {
  const response = await fetch("/api/admin/whatsapp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...extra }),
  });
  const raw = await response.text();
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error(`Endpoint aksi WhatsApp tidak tersedia (${response.status} ${response.statusText || ""}). Muat ulang dashboard; bila tetap muncul, deploy ulang versi aplikasi terbaru.`);
  }
  let payload: T & { error?: string };
  try {
    payload = JSON.parse(raw) as T & { error?: string };
  } catch {
    throw new Error("Respons aksi WhatsApp tidak dapat dibaca. Muat ulang dashboard dan coba kembali.");
  }
  if (!response.ok) throw new Error(payload.error ?? "Aksi gagal dijalankan");
  return payload;
}
