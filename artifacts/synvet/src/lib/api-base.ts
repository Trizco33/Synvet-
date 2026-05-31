// Roteamento da API REST do backend.
//
// Em produção fora do Replit (ex.: Vercel), VITE_API_URL aponta para o backend
// Railway (ex.: https://workspaceapi-server-production-49dc.up.railway.app).
// No Replit (dev), a variável não existe e usamos o caminho relativo servido
// pelo proxy compartilhado, derivado do BASE_URL do Vite.

// Origem do backend, normalizada: sem barra(s) final(is) e sem sufixo /api.
// Aceita VITE_API_URL com ou sem /api no fim — evita gerar URLs `/api/api/...`.
// Retorna null quando a variável não está definida (modo Replit/relativo).
export function apiOrigin(): string | null {
  const raw = import.meta.env.VITE_API_URL as string | undefined;
  if (!raw) return null;
  return raw.replace(/\/+$/, "").replace(/\/api$/, "");
}

// Base REST completa (inclui /api). Usada por chamadas fora dos hooks gerados
// (ex.: copilot SSE, download de template de importação).
export function apiBase(): string {
  const origin = apiOrigin();
  if (origin) return `${origin}/api`;
  return `${import.meta.env.BASE_URL}api`.replace(/\/+/g, "/");
}
