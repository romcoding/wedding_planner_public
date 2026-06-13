import PlanGate from '../../components/PlanGate'
import FeaturePaywall from '../../components/FeaturePaywall'
import WebsiteBuilder from './WebsiteBuilder'

// The wedding-website builder is a premium feature. The backend independently
// enforces this (require_feature("website_builder") -> 403 upgrade_required);
// this gate is the UX layer, reusing the shared paywall components.
export default function WebsiteBuilderPage() {
  return (
    <PlanGate
      plan="premium"
      fallback={
        <FeaturePaywall
          featureName="Wedding Website"
          featureDescription="Build and publish a beautiful one-page wedding website for your guests — themes, schedule, RSVP and more."
          requiredPlan="premium"
        />
      }
    >
      <WebsiteBuilder />
    </PlanGate>
  )
}
