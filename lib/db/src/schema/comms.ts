import {
  pgTable,
  text,
  timestamp,
  uuid,
  boolean,
  integer,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

// =====================================================================
// Communication module — multi-tenant by clinicId. All tables append/upd
// timestamps. Provider-agnostic. Event-driven via comms_jobs queue.
// =====================================================================

// ---------- channels (one per clinic per kind+provider) ----------
export const commsChannelsTable = pgTable(
  "comms_channels",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clinicId: uuid("clinic_id").notNull(),
    kind: text("kind").notNull(), // whatsapp_qr | whatsapp_official | email | sms | push
    provider: text("provider").notNull().default("mock"), // mock | evolution | zapi | meta_cloud | smtp
    status: text("status").notNull().default("disconnected"), // disconnected | connecting | connected | error
    phoneNumber: text("phone_number"),
    displayName: text("display_name"),
    externalId: text("external_id"), // provider-side instance id
    lastConnectedAt: timestamp("last_connected_at", { withTimezone: true }),
    lastError: text("last_error"),
    meta: jsonb("meta").default({}).notNull(),
    createdBy: uuid("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    clinicIdx: index("comms_channels_clinic_idx").on(t.clinicId),
  }),
);

// ---------- templates (system-seeded + clinic custom) ----------
export const commsTemplatesTable = pgTable(
  "comms_templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clinicId: uuid("clinic_id").notNull(),
    slug: text("slug").notNull(), // unique per clinic, used by automations
    name: text("name").notNull(),
    channel: text("channel").notNull().default("whatsapp"), // whatsapp | email | sms
    category: text("category").notNull().default("transactional"), // transactional | reminder | campaign
    body: text("body").notNull(),
    variables: jsonb("variables").default([]).notNull(), // string[] declared placeholders
    isSystem: boolean("is_system").notNull().default(false),
    enabled: boolean("enabled").notNull().default(true),
    createdBy: uuid("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    clinicIdx: index("comms_templates_clinic_idx").on(t.clinicId),
    slugIdx: index("comms_templates_slug_idx").on(t.clinicId, t.slug),
  }),
);

// ---------- automations (rules: event → template via channel) ----------
export const commsAutomationsTable = pgTable(
  "comms_automations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clinicId: uuid("clinic_id").notNull(),
    name: text("name").notNull(),
    trigger: text("trigger").notNull(), // consultation.created | consultation.confirmed | consultation.cancelled |
    //                                      consultation.reminder | vaccine.due | exam.ready | pet.birthday
    templateId: uuid("template_id").notNull(),
    channelId: uuid("channel_id"), // null = clinic default for the kind
    offsetMinutes: integer("offset_minutes").notNull().default(0), // negative = before event, positive = after
    config: jsonb("config").default({}).notNull(),
    enabled: boolean("enabled").notNull().default(true),
    createdBy: uuid("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    clinicIdx: index("comms_automations_clinic_idx").on(t.clinicId),
    triggerIdx: index("comms_automations_trigger_idx").on(t.clinicId, t.trigger),
  }),
);

// ---------- messages (log of every send + future inbound) ----------
export const commsMessagesTable = pgTable(
  "comms_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clinicId: uuid("clinic_id").notNull(),
    channelId: uuid("channel_id").notNull(),
    automationId: uuid("automation_id"),
    templateId: uuid("template_id"),
    tutorId: uuid("tutor_id"),
    petId: uuid("pet_id"),
    consultationId: uuid("consultation_id"),
    direction: text("direction").notNull().default("outbound"), // outbound | inbound
    toAddress: text("to_address").notNull(), // phone or email
    body: text("body").notNull(),
    status: text("status").notNull().default("queued"),
    // queued | scheduled | sending | sent | delivered | read | failed | cancelled
    errorMessage: text("error_message"),
    providerMessageId: text("provider_message_id"),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    clinicIdx: index("comms_messages_clinic_idx").on(t.clinicId, t.createdAt),
    statusIdx: index("comms_messages_status_idx").on(t.status, t.scheduledFor),
    tutorIdx: index("comms_messages_tutor_idx").on(t.tutorId),
  }),
);

// ---------- jobs (lightweight queue, polled by scheduler) ----------
export const commsJobsTable = pgTable(
  "comms_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clinicId: uuid("clinic_id").notNull(),
    kind: text("kind").notNull(), // send_message | reminder_scan | campaign_dispatch
    payload: jsonb("payload").default({}).notNull(),
    status: text("status").notNull().default("pending"),
    // pending | processing | done | failed | cancelled
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }).defaultNow().notNull(),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    lastError: text("last_error"),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    lockedBy: text("locked_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    pollIdx: index("comms_jobs_poll_idx").on(t.status, t.scheduledFor),
    clinicIdx: index("comms_jobs_clinic_idx").on(t.clinicId),
  }),
);

export type CommsChannel = typeof commsChannelsTable.$inferSelect;
export type InsertCommsChannel = typeof commsChannelsTable.$inferInsert;
export type CommsTemplate = typeof commsTemplatesTable.$inferSelect;
export type InsertCommsTemplate = typeof commsTemplatesTable.$inferInsert;
export type CommsAutomation = typeof commsAutomationsTable.$inferSelect;
export type InsertCommsAutomation = typeof commsAutomationsTable.$inferInsert;
export type CommsMessage = typeof commsMessagesTable.$inferSelect;
export type InsertCommsMessage = typeof commsMessagesTable.$inferInsert;
export type CommsJob = typeof commsJobsTable.$inferSelect;
export type InsertCommsJob = typeof commsJobsTable.$inferInsert;
