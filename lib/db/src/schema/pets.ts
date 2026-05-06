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
    notes: text("notes"),
    photoUrl: text("photo_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("pets_clinic_idx").on(t.clinicId),
    index("pets_tutor_idx").on(t.tutorId),
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
