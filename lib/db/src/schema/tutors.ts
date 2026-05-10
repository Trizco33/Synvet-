import { pgTable, text, timestamp, uuid, index, uniqueIndex } from "drizzle-orm/pg-core";
import { clinicsTable } from "./clinics";
import { usersTable } from "./users";

export const tutorsTable = pgTable(
  "tutors",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinicsTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    whatsapp: text("whatsapp"),
    address: text("address"),
    externalId: text("external_id"),
    createdBy: uuid("created_by").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("tutors_clinic_idx").on(t.clinicId),
    uniqueIndex("tutors_external_idx").on(t.clinicId, t.externalId),
  ],
);

export type Tutor = typeof tutorsTable.$inferSelect;
export type InsertTutor = typeof tutorsTable.$inferInsert;
