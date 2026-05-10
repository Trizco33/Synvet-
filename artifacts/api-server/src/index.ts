import app from "./app";
import { logger } from "./lib/logger";
import { ensureExamsBucket } from "./lib/exam-files";
import { startCommsModule } from "./comms";
import { seedPlatformAdmins } from "./lib/seed-platform-admins";
import { startEmailScheduler } from "./lib/email/scheduler";
import { emailProviderName } from "./lib/email";

const EXAM_MAX_BYTES = 15 * 1024 * 1024; // 15 MB — alinhado ao limite client-side

ensureExamsBucket(EXAM_MAX_BYTES).catch((err) => {
  logger.warn({ err }, "Falha ao garantir configuração do bucket exams (segue sem bloquear)");
});

startCommsModule();

startEmailScheduler();
logger.info({ provider: emailProviderName() }, "email service inicializado");

seedPlatformAdmins().catch((err) => {
  logger.warn({ err }, "Falha ao seed de platform_admins (segue sem bloquear)");
});

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
