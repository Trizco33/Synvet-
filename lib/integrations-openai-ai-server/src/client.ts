import OpenAI from "openai";

let cached: OpenAI | null = null;

function resolveConfig(): { apiKey: string; baseURL?: string } {
  // Replit AI Integrations proxy (só funciona dentro do Replit)
  const proxyBase = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const proxyKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  if (proxyBase && proxyKey) {
    return { apiKey: proxyKey, baseURL: proxyBase };
  }

  // OpenAI padrão (produção: Railway, etc.)
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey) {
    const baseURL = process.env.OPENAI_BASE_URL;
    return baseURL ? { apiKey, baseURL } : { apiKey };
  }

  throw new Error(
    "OpenAI não configurado. Defina OPENAI_API_KEY (produção) ou provisione a integração OpenAI do Replit (AI_INTEGRATIONS_OPENAI_*).",
  );
}

function getClient(): OpenAI {
  if (!cached) {
    const config = resolveConfig();
    cached = new OpenAI(config);
  }
  return cached;
}

// Proxy lazy: o cliente só é instanciado no primeiro uso, não no import.
// Assim o servidor sobe mesmo sem IA configurada; só falha ao chamar a IA.
export const openai = new Proxy({} as OpenAI, {
  get(_target, prop, receiver) {
    const client = getClient();
    const value = Reflect.get(client as object, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
}) as OpenAI;
