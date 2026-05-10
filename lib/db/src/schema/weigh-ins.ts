import { pgTable, text, timestamp, uuid, date, numeric, index } from "drizzle-orm/pg-core";
import { clinicsTable } from "./clinics";
import { petsTable } from "./pets";
import { usersTable } from "./users";

export const weighInsTable = pgTable(
  "weigh_ins",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinicsTable.id, { onDelete: "cascade" }),
    petId: uuid("pet_id")
      .notNull()
      .references(() => petsTable.id, { onDelete: "cascade" }),
    weighedAt: date("weighed_at").notNull(),
    weightKg: numeric("weight_kg", { precision: 6, scale: 2 }).notNull(),
    notes: text("notes"),
    createdBy: uuid("created_by").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("weigh_ins_clinic_idx").on(t.clinicId),
    index("weigh_ins_pet_idx").on(t.petId, t.weighedAt),
  ],
);

export type WeighIn = typeof weighInsTable.$inferSelect;
export type InsertWeighIn = typeof weighInsTable.$inferInsert;
