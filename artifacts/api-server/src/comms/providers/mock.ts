import type { CommsProvider } from "./types";
import { logger } from "../../lib/logger";

// MockProvider — V1 default. End-to-end functional without external deps:
// `send` always succeeds, `connect` returns a fake QR payload and the route
// flips status to "connected" immediately. Lets the entire automation/queue
// pipeline be exercised without spending money or wiring a third-party.

export const mockProvider: CommsProvider = {
  name: "mock",
  async send({ toAddress, body, clinicId, channelId }) {
    logger.info(
      {
        provider: "mock",
        clinicId,
        channelId,
        toAddress,
        bodyPreview: body.slice(0, 80),
      },
      "comms.mock.send",
    );
    return {
      providerMessageId: `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      status: "sent",
    };
  },
  async connect({ id, clinicId }) {
    return {
      qrString: `MOCK::${clinicId}::${id}::${Date.now()}`,
      expiresAt: new Date(Date.now() + 60_000),
      status: "connecting",
      message:
        "Modo de teste (MockProvider). Para envio real, configure COMMS_PROVIDER=evolution e plugue uma instância Evolution/Z-API por clínica.",
    };
  },
  async disconnect() {
    /* no-op */
  },
  async refreshStatus() {
    return { status: "connected" };
  },
};
