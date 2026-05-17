import { Lock, ArrowRight, LayoutDashboard } from 'lucide-react'
import { Link } from 'react-router-dom'

const PLAN_BENEFITS = {
  starter: [
    "Unlimited task management & timeline",
    "Moodboard, invitations & guest portal customization",
    "Ask Wedi — your personal planning helper (3 uses/day)",
  ],
  premium: [
    "Smart seating chart with Wedi suggestions",
    "Guest messaging & gift registry management",
    "RSVP reminders, venue management & unlimited Wedi access",
  ],
};

export default function FeaturePaywall({ featureName, featureDescription, requiredPlan, previewImage }) {
  const planLabel = requiredPlan === "premium" ? "Premium" : "Starter";
  const benefits = PLAN_BENEFITS[requiredPlan] || PLAN_BENEFITS.premium;

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        {previewImage && (
          <div className="mb-6 rounded-xl overflow-hidden relative">
            <img src={previewImage} alt="" className="w-full h-40 object-cover blur-sm opacity-60" />
            <div className="absolute inset-0 bg-white/40" />
          </div>
        )}
        <div
          className="bg-white rounded-2xl p-8 shadow-sm"
          style={{ border: '1.5px solid #C4956A33' }}
        >
          <div className="flex flex-col items-center text-center mb-6">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center mb-4"
              style={{ background: '#F5EFE8' }}
            >
              <Lock className="w-5 h-5" style={{ color: '#C4956A' }} />
            </div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: '#C4956A' }}>
              {planLabel} feature
            </p>
            <h2 className="text-xl font-bold text-gray-900 mb-2">{featureName}</h2>
            <p className="text-sm text-gray-500 leading-relaxed">{featureDescription}</p>
          </div>

          <ul className="space-y-2 mb-6">
            {benefits.map((b, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <span style={{ color: '#C4956A' }} className="mt-0.5 flex-shrink-0">✦</span>
                {b}
              </li>
            ))}
          </ul>

          <div className="flex flex-col gap-2">
            <Link
              to="/admin/billing"
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-white text-sm font-medium transition-opacity hover:opacity-90"
              style={{ background: '#C4956A' }}
            >
              View plans
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/admin/wedding"
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-gray-600 text-sm font-medium hover:bg-gray-100 transition-colors"
            >
              <LayoutDashboard className="w-4 h-4" />
              Back to dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
