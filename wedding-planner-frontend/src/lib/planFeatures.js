export const FEATURE_MIN_PLAN = {
  dashboard: "free",
  guests: "free",
  tasks: "free",
  budget_basic: "free",
  content_basic: "free",
  analytics_basic: "free",
  // Starter unlocks
  budget_full: "starter",
  custom_slug: "starter",
  wedi: "starter",
  invitations: "starter",
  events: "starter",
  moodboard: "starter",
  guest_photos: "starter",
  agenda: "starter",
  // Premium unlocks
  seating: "premium",
  messages: "premium",
  gift_registry: "premium",
  venue: "premium",
  rsvp_reminders: "premium",
};

export const PLAN_ORDER = { free: 0, starter: 1, premium: 2 };

export function hasFeature(currentPlan, feature) {
  const required = FEATURE_MIN_PLAN[feature] || "free";
  return (PLAN_ORDER[currentPlan] || 0) >= (PLAN_ORDER[required] || 0);
}

export const PLAN_NAMES = {
  free: "Free",
  starter: "Starter",
  premium: "Premium",
};
