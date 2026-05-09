import { and, eq, lte } from "drizzle-orm";
import {
  db,
  commsJobsTable,
  commsMessagesTable,
  commsChannelsTable,
} from "@workspace/db";
import { getProvider } from "./providers";
import { logger } from "../lib/logger";

// ---------------------------------------------------------------------------
// Lightweight in-process job worker.
// Polls comms_jobs every POLL_MS, claims due rows with an optimistic update
// (status pending → processing), processes them, retries with backoff up to
// maxAttempts. Single-instance for V1 — to scale, drop in BullMQ/Temporal.
// ---------------------------------------------------------------------------

const POLL_MS = 15_000;
const BATCH = 20;
const WORKER_ID = `worker-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;

let interval: NodeJS.Timeout | null = null;
let running = false;

export function startCommsScheduler() {
  if (interval) return;
  interval = setInterval(() => {
    void tick();
  }, POLL_MS);
  setTimeout(() => void tick(), 1000);
  logger.info({ pollMs: POLL_MS, workerId: WORKER_ID }, "comms scheduler started");
}

export function stopCommsScheduler() {
  if (interval) clearInterval(interval);
  interval = null;
}

async function tick() {
  if (running) return;
  running = true;
  try {
    const due = await db
      .select()
      .from(commsJobsTable)
      .where(
        and(
          eq(commsJobsTable.status, "pending"),
          lte(commsJobsTable.scheduledFor, new Date()),
        ),
      )
      .limit(BATCH);
    for (const job of due) {
      const [claimed] = await db
        .update(commsJobsTable)
        .set({
          status: "processing",
          lockedAt: new Date(),
          lockedBy: WORKER_ID,
          attempts: (job.attempts ?? 0) + 1,
          updatedAt: new Date(),
        })
        .where(and(eq(commsJobsTable.id, job.id), eq(commsJobsTable.status, "pending")))
        .returning();
      if (!claimed) continue;
      try {
        await processJob(claimed);
        await db
          .update(commsJobsTable)
          .set({ status: "done", updatedAt: new Date() })
          .where(eq(commsJobsTable.id, claimed.id));
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        const failed = (claimed.attempts ?? 0) >= (claimed.maxAttempts ?? 3);
        await db
          .update(commsJobsTable)
          .set({
            status: failed ? "failed" : "pending",
            lastError: errMsg.slice(0, 500),
            scheduledFor: failed ? claimed.scheduledFor : new Date(Date.now() + 60_000),
            updatedAt: new Date(),
          })
          .where(eq(commsJobsTable.id, claimed.id));
        logger.error(
          { err: errMsg, jobId: claimed.id, kind: claimed.kind, attempts: claimed.attempts, failed },
          "comms job failed",
        );
        if (failed && claimed.kind === "send_message") {
          const messageId = (claimed.payload as { messageId?: string } | null)?.messageId;
          if (messageId) {
            await db
              .update(commsMessagesTable)
              .set({ status: "failed", errorMessage: errMsg.slice(0, 500), updatedAt: new Date() })
              .where(eq(commsMessagesTable.id, messageId));
          }
        }
      }
    }
  } catch (err) {
    logger.error({ err }, "comms scheduler tick failed");
  } finally {
    running = false;
  }
}

async function processJob(job: typeof commsJobsTable.$inferSelect) {
  if (job.kind === "send_message") {
    const messageId = (job.payload as { messageId?: string } | null)?.messageId;
    if (!messageId) throw new Error("send_message job missing messageId");
    const [msg] = await db
      .select()
      .from(commsMessagesTable)
      .where(eq(commsMessagesTable.id, messageId));
    if (!msg) throw new Error(`message ${messageId} not found`);
    if (msg.status === "sent" || msg.status === "delivered" || msg.status === "read") return;
    const [channel] = await db
      .select()
      .from(commsChannelsTable)
      .where(eq(commsChannelsTable.id, msg.channelId));
    if (!channel) throw new Error("channel not found");
    if (channel.status !== "connected") {
      throw new Error(`channel ${channel.id} not connected (status=${channel.status})`);
    }
    await db
      .update(commsMessagesTable)
      .set({ status: "sending", updatedAt: new Date() })
      .where(eq(commsMessagesTable.id, msg.id));
    const provider = getProvider(channel.provider);
    const result = await provider.send({
      clinicId: msg.clinicId,
      channelId: msg.channelId,
      externalId: channel.externalId,
      toAddress: msg.toAddress,
      body: msg.body,
    });
    await db
      .update(commsMessagesTable)
      .set({
        status: result.status,
        providerMessageId: result.providerMessageId,
        sentAt: result.status === "failed" ? null : new Date(),
        errorMessage: result.errorMessage ?? null,
        updatedAt: new Date(),
      })
      .where(eq(commsMessagesTable.id, msg.id));
  } else {
    logger.warn({ jobKind: job.kind }, "unknown job kind");
  }
}
