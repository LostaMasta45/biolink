export const MAX_POSTER_FILES = 10;
export const MAX_POSTER_FILE_SIZE = 50 * 1024 * 1024;
export const MAX_POSTER_FILE_SIZE_LABEL = "50 MB";
export const ALLOWED_POSTER_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export function isAllowedPosterMimeType(value: string): boolean {
  return (ALLOWED_POSTER_MIME_TYPES as readonly string[]).includes(value.toLowerCase());
}

export function posterExtensionForMimeType(value: string): "jpg" | "png" | "webp" {
  if (value.toLowerCase() === "image/png") return "png";
  if (value.toLowerCase() === "image/webp") return "webp";
  return "jpg";
}
