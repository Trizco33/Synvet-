import { pgTable, text, timestamp, uuid, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { clinicsTable } from "./clinics";
import { petsTable } from "./pets";
import { usersTable } from "./users";

export const consultationsTable = pgTable(
  "consultations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinicsTable.id, { onDelete: "cascade" }),
    petId: uuid("pet_id")
      .notNull()
      .references(() => petsTable.id, { onDelete: "cascade" }),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    status: text("status", {
      enum: ["scheduled", "in_progress", "completed", "cancelled"],
    })
      .notNull()
      .default("scheduled"),
    reason: text("reason"),
    symptoms: text("symptoms"),
    observations: text("observations"),
    evolution: text("evolution"),
    medications: text("medications"),
    createdBy: uuid("created_by").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("consultations_clinic_idx").on(t.clinicId),
    index("consultations_pet_idx").on(t.petId),
    index("consultations_scheduled_idx").on(t.clinicId, t.scheduledAt),
  ],
);

export const consultationsRelations = relations(consultationsTable, ({ one }) => ({
  pet: one(petsTable, {
    fields: [consultationsTable.petId],
    references: [petsTable.id],
  }),
}));

export type Consultation = typeof consultationsTable.$inferSelect;
export type InsertConsultation = typeof consultationsTable.$inferInsert;
