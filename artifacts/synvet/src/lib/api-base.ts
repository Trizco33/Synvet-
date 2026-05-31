// Base da API REST do backend.
//
// Em produção fora do Replit (ex.: Vercel), VITE_API_URL aponta para o backend
// Railway (ex.: https://workspaceapi-server-production-49dc.up.railway.app).
// No Replit (dev), a variável não existe e usamos o caminho relativo servido
// pelo proxy compartilhado, derivado do BASE_URL do Vite.
export function apiBase(): string {
  const apiUrl = import.meta.env.VITE_API_URL as string | undefined;
  if (apiUrl) {
    return `${apiUrl.replace(/\/+$/, "")}/api`;
  }
  return `${import.meta.env.BASE_URL}api`.replace(/\/+/g, "/");
}
