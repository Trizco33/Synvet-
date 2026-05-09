import type { CommsProvider } from "./types";
import { mockProvider } from "./mock";
import { evolutionProvider } from "./evolution";
import { logger } from "../../lib/logger";

const REGISTRY: Record<string, CommsProvider> = {
  mock: mockProvider,
  evolution: evolutionProvider,
};

const DEFAULT_NAME = (process.env["COMMS_PROVIDER"] ?? "mock").toLowerCase();

export function getProvider(name?: string | null): CommsProvider {
  if (name && REGISTRY[name]) return REGISTRY[name];
  return REGISTRY[DEFAULT_NAME] ?? mockProvider;
}

export function defaultProviderName(): string {
  return REGISTRY[DEFAULT_NAME] ? DEFAULT_NAME : "mock";
}

logger.info(
  { defaultProvider: defaultProviderName(), available: Object.keys(REGISTRY) },
  "comms providers initialized",
);
