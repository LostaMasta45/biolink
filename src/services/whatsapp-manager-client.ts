import type { ApiResult } from "@/types/whatsapp-manager";

async function parseResponse<T>(response: Response): Promise<ApiResult<T>> {
  const payload = await response.json() as Partial<ApiResult<T>> & { error?: string };
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
  const payload = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? "Aksi gagal dijalankan");
  return payload;
}

