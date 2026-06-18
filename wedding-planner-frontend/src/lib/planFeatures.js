// Frontend feature-gate map. UX ONLY — the backend (src/entitlements.py PLANS)
// is the source of truth and enforces every gate. This mirrors the server's
// tier assignment: the consolidated paid tier is "premium" (the retired
// "starter" tier was merged into it server-side; migrations/003_plans.sql).
export const FEATURE_MIN_PLAN = {
  dashboard: "free",
  guests: "free",
  tasks: "free",
  budget_basic: "free",
  content_basic: "free",
  analytics_basic: "free",
  // Premium unlocks (consolidated tier — previously "starter")
  budget_full: "premium",
  custom_slug: "premium",
  wedi: "premium",
  invitations: "premium",
  events: "premium",
  moodboard: "premium",
  guest_photos: "premium",
  agenda: "premium",
  // Premium unlocks
  seating: "premium",
  messages: "premium",
  gift_registry: "premium",
  venue: "premium",
  rsvp_reminders: "premium",
  website: "premium",
};

// Plan vocabulary: free < premium < lifetime (lifetime = full entitlements).
export const PLAN_ORDER = { free: 0, premium: 1, lifetime: 2 };

export function hasFeature(currentPlan, feature) {
  const required = FEATURE_MIN_PLAN[feature] || "free";
  return (PLAN_ORDER[currentPlan] || 0) >= (PLAN_ORDER[required] || 0);
}

export const PLAN_NAMES = {
  free: "Free",
  premium: "Premium",
  lifetime: "Lifetime",
};
