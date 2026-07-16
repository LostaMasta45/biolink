/** Normalisasi tunggal untuk keyword dashboard dan pesan dari webhook. */
export function normalizeAutoReplyKeyword(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("id-ID").trim().replace(/\s+/g, " ");
}
