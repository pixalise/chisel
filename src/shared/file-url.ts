function encodePathSegments(value: string): string {
  return value
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export function fileUrlFromPath(filePath: string): string {
  if (filePath.includes("\0")) throw new Error("File path cannot contain a null byte");
  const normalized = filePath.replaceAll("\\", "/");
  const windowsDrive = /^([A-Za-z]:)(\/.*)$/.exec(normalized);
  if (windowsDrive) return `file:///${windowsDrive[1]}${encodePathSegments(windowsDrive[2])}`;
  if (normalized.startsWith("//")) {
    const [host, ...segments] = normalized.slice(2).split("/");
    if (!host) throw new Error("UNC file path must include a host");
    return `file://${encodeURIComponent(host)}/${segments.map((segment) => encodeURIComponent(segment)).join("/")}`;
  }
  if (!normalized.startsWith("/")) throw new Error(`File path must be absolute: ${filePath}`);
  return `file://${encodePathSegments(normalized)}`;
}
