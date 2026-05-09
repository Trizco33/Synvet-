import { startAutomationsListener } from "./automations";
import { startCommsScheduler } from "./scheduler";
import { logger } from "../lib/logger";

export function startCommsModule() {
  startAutomationsListener();
  startCommsScheduler();
  logger.info("comms module started");
}

export { commsBus } from "./event-bus";
export { seedClinicTemplates, seedClinicAutomations } from "./seed";
