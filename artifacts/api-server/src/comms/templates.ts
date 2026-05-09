// Tiny {{handlebars}}-style renderer. Intentionally minimal — no logic, no
// helpers — to keep templates safe and predictable. Real escaping is handled
// per-channel by the provider (WhatsApp/SMS/email layers).

const VAR_RE = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

export function renderTemplate(
  body: string,
  vars: Record<string, string | number | null | undefined>,
): string {
  return body.replace(VAR_RE, (_, key: string) => {
    const v = vars[key];
    return v == null ? "" : String(v);
  });
}

export function extractVariables(body: string): string[] {
  const out = new Set<string>();
  for (const m of body.matchAll(VAR_RE)) {
    if (m[1]) out.add(m[1]);
  }
  return [...out];
}
