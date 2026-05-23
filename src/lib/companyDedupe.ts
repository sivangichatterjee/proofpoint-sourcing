export function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(
      /\b(?:ai|inc|incorporated|corp|corporation|co|company|ltd|llc|limited|technologies|technology|tech|labs|systems|health|healthcare)\b/g,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();
}
