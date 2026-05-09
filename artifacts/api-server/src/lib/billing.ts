import { TRIAL_DAYS, type Clinic } from "@workspace/db";

export type BillingStatusPayload = {
  plan: Clinic["plan"];
  status: Clinic["status"];
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  daysLeft: number | null;
};

export function trialEndsAtFromNow(now: Date = new Date()): Date {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() + TRIAL_DAYS);
  return d;
}

export function buildBillingStatus(clinic: Clinic): BillingStatusPayload {
  const now = Date.now();
  let daysLeft: number | null = null;
  if (clinic.status === "trialing" && clinic.trialEndsAt) {
    const diffMs = clinic.trialEndsAt.getTime() - now;
    daysLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  } else if (clinic.status === "active" && clinic.currentPeriodEnd) {
    const diffMs = clinic.currentPeriodEnd.getTime() - now;
    daysLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  }
  return {
    plan: clinic.plan,
    status: clinic.status,
    trialEndsAt: clinic.trialEndsAt ? clinic.trialEndsAt.toISOString() : null,
    currentPeriodEnd: clinic.currentPeriodEnd ? clinic.currentPeriodEnd.toISOString() : null,
    daysLeft,
  };
}
