import { pgTable, text, timestamp, uuid, index, integer } from "drizzle-orm/pg-core";
import { clinicsTable } from "./clinics";
import { petsTable } from "./pets";
import { usersTable } from "./users";

export const COPILOT_MESSAGE_ROLES = ["user", "assistant"] as const;
export type CopilotMessageRole = (typeof COPILOT_MESSAGE_ROLES)[number];

export const copilotConversationsTable = pgTable(
  "copilot_conversations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinicsTable.id, { onDelete: "cascade" }),
    petId: uuid("pet_id")
      .notNull()
      .references(() => petsTable.id, { onDelete: "cascade" }),
    consultationId: uuid("consultation_id"),
    userId: uuid("user_id").references(() => usersTable.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    model: text("model").notNull().default("gpt-5-mini"),
    promptVersion: text("prompt_version").notNull().default("copilot-v1.0.0"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("copilot_convs_clinic_pet_idx").on(t.clinicId, t.petId),
    index("copilot_convs_user_idx").on(t.userId),
  ],
);

export const copilotMessagesTable = pgTable(
  "copilot_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => copilotConversationsTable.id, { onDelete: "cascade" }),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinicsTable.id, { onDelete: "cascade" }),
    role: text("role", { enum: COPILOT_MESSAGE_ROLES }).notNull(),
    content: text("content").notNull(),
    tokensIn: integer("tokens_in"),
    tokensOut: integer("tokens_out"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("copilot_msgs_conv_idx").on(t.conversationId)],
);

export type CopilotConversation = typeof copilotConversationsTable.$inferSelect;
export type InsertCopilotConversation = typeof copilotConversationsTable.$inferInsert;
export type CopilotMessageRow = typeof copilotMessagesTable.$inferSelect;
export type InsertCopilotMessage = typeof copilotMessagesTable.$inferInsert;
