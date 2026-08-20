export function normalizeTerrainSlugDraft(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+/, "");
}

export function parseTerrainSlugList(value: string): string[] {
  return value
    .split(",")
    .map((entry) => normalizeTerrainSlugDraft(entry).replace(/_+$/, ""))
    .filter(Boolean);
}

export function finalizeTerrainSlug(value: string, fallback: string): string {
  const normalized = normalizeTerrainSlugDraft(value).replace(/_+$/, "");
  if (normalized) return normalized;
  const normalizedFallback = normalizeTerrainSlugDraft(fallback).replace(/_+$/, "");
  if (!normalizedFallback) throw new Error("Terrain slug fallback must contain at least one letter or number");
  return normalizedFallback;
}

export function isTerrainSlugAvailable(slug: string, slugs: string[], currentIndex: number): boolean {
  return !slugs.some((entry, index) => index !== currentIndex && entry === slug);
}

export function duplicateTerrainSlugs(slugs: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const slug of slugs) {
    if (seen.has(slug)) duplicates.add(slug);
    seen.add(slug);
  }
  return [...duplicates];
}

export function assertUniqueTerrainSlugs(kind: string, slugs: string[]): void {
  const duplicate = duplicateTerrainSlugs(slugs)[0];
  if (duplicate) throw new Error(`Terrain ${kind} slug '${duplicate}' is duplicated. Rename each ${kind} before saving.`);
}
