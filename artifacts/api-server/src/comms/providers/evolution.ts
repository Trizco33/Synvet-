import type { CommsProvider } from "./types";

/**
 * Stub para Evolution API (https://doc.evolution-api.com/) ou Z-API.
 *
 * Modelo: cada clínica tem uma *instance* na Evolution API; o `externalId`
 * do canal armazena o nome da instance. O fluxo real:
 *
 *   1. POST /instance/create        → criar instância da clínica
 *   2. GET  /instance/connect/:id   → recebe QR string p/ exibir
 *   3. POST /message/sendText/:id   → envio de WhatsApp (status async via webhook)
 *   4. GET  /instance/connectionState/:id → status do socket
 *   5. POST /instance/logout/:id    → desconectar
 *
 * Para ativar:
 *   - export EVOLUTION_API_URL=https://sua-evolution.example.com
 *   - export EVOLUTION_API_KEY=<global apikey>
 *   - export COMMS_PROVIDER=evolution
 *   - implementar as 4 funções abaixo (são REST simples)
 *
 * Mantemos o stub para que o módulo Comunicação fique inteiro em produção
 * sem chave; flipping da env basta para ligar o real.
 */
function notConfigured(): never {
  throw new Error(
    "EvolutionProvider não está implementado nesta versão. " +
      "Configure COMMS_PROVIDER=mock ou plugue uma instância Evolution/Z-API real " +
      "(ver artifacts/api-server/src/comms/providers/evolution.ts).",
  );
}

export const evolutionProvider: CommsProvider = {
  name: "evolution",
  async send() {
    notConfigured();
  },
  async connect() {
    notConfigured();
  },
  async disconnect() {
    notConfigured();
  },
  async refreshStatus() {
    notConfigured();
  },
};
