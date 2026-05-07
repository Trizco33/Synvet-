import {
  pgTable,
  text,
  timestamp,
  uuid,
  boolean,
  date,
  doublePrecision,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { clinicsTable } from "./clinics";
import { tutorsTable } from "./tutors";
import { usersTable } from "./users";

export const petsTable = pgTable(
  "pets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinicsTable.id, { onDelete: "cascade" }),
    tutorId: uuid("tutor_id")
      .notNull()
      .references(() => tutorsTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    species: text("species").notNull(),
    breed: text("breed"),
    sex: text("sex", { enum: ["male", "female", "unknown"] }).notNull().default("unknown"),
    birthDate: date("birth_date"),
    weightKg: doublePrecision("weight_kg"),
    neutered: boolean("neutered").notNull().default(false),
    allergies: text("allergies"),
    continuousMedications: text("continuous_medications"),
    isCritical: boolean("is_critical").notNull().default(false),
    notes: text("notes"),
    photoUrl: text("photo_url"),
    createdBy: uuid("created_by").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("pets_clinic_idx").on(t.clinicId),
    index("pets_tutor_idx").on(t.tutorId),
    index("pets_critical_idx").on(t.clinicId, t.isCritical),
  ],
);

export const petsRelations = relations(petsTable, ({ one }) => ({
  tutor: one(tutorsTable, {
    fields: [petsTable.tutorId],
    references: [tutorsTable.id],
  }),
  clinic: one(clinicsTable, {
    fields: [petsTable.clinicId],
    references: [clinicsTable.id],
  }),
}));

export type Pet = typeof petsTable.$inferSelect;
export type InsertPet = typeof petsTable.$inferInsert;
