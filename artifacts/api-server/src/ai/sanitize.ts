const UUID_RE =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

export function sanitize(text: string | null | undefined): string {
  if (!text) return "";
  return String(text)
    .replace(UUID_RE, "[id]")
    .replace(EMAIL_RE, "[email]")
    .trim();
}

export function clip(text: string, max = 4000): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + "…";
}
