interface PosterRecord {
  poster_url?: string | null;
  poster_urls?: unknown;
}

function cleanPosterUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export function getPosterGallery(record: PosterRecord): string[] {
  const structured = Array.isArray(record.poster_urls)
    ? record.poster_urls.map(cleanPosterUrl).filter((value): value is string => Boolean(value))
    : [];
  const legacy = String(record.poster_url || "")
    .split("|")
    .map(cleanPosterUrl)
    .filter((value): value is string => Boolean(value));
  return [...new Set(structured.length ? structured : legacy)];
}

export function getPosterStoragePath(value: string): string | null {
  try {
    const parsed = new URL(value);
    const storageBase = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!storageBase) return null;
    const expectedOrigin = new URL(storageBase).origin;
    const marker = "/storage/v1/object/public/posters/";
    const markerIndex = parsed.pathname.indexOf(marker);
    if (parsed.protocol !== "https:" || parsed.origin !== expectedOrigin || markerIndex !== 0) return null;
    const path = decodeURIComponent(parsed.pathname.slice(markerIndex + marker.length));
    return path && !path.startsWith("/") && !path.includes("..") ? path : null;
  } catch {
    return null;
  }
}
