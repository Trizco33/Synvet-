import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const CLINIC_PLANS = ["trial", "essencial", "pro", "clinic_plus"] as const;
export type ClinicPlan = (typeof CLINIC_PLANS)[number];

export const CLINIC_STATUSES = [
  "trialing",
  "active",
  "past_due",
  "canceled",
  "suspended",
] as const;
export type ClinicStatus = (typeof CLINIC_STATUSES)[number];

export const clinicsTable = pgTable("clinics", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  cnpj: text("cnpj"),
  phone: text("phone"),
  address: text("address"),
  plan: text("plan", { enum: CLINIC_PLANS }).notNull().default("trial"),
  status: text("status", { enum: CLINIC_STATUSES }).notNull().default("trialing"),
  trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Clinic = typeof clinicsTable.$inferSelect;
export type InsertClinic = typeof clinicsTable.$inferInsert;
