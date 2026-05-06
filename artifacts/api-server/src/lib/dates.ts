export function toDateString(d: Date | string | null | undefined): string | null | undefined {
  if (d == null) return d as null | undefined;
  if (typeof d === "string") return d.slice(0, 10);
  return d.toISOString().slice(0, 10);
}
