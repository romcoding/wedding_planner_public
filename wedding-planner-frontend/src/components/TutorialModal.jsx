import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Lightbulb, Sparkles, X } from 'lucide-react'

export default function TutorialModal({ isOpen, onClose, tutorial }) {
  const [stepIdx, setStepIdx] = useState(0)
  const closeBtnRef = useRef(null)
  const dialogRef = useRef(null)

  const steps = useMemo(() => tutorial?.steps || [], [tutorial])
  const totalSteps = steps.length
  const isLast = stepIdx >= totalSteps - 1
  const isFirst = stepIdx === 0
  const currentStep = steps[stepIdx]

  useEffect(() => {
    if (isOpen) setStepIdx(0)
  }, [isOpen, tutorial?.id])

  useEffect(() => {
    if (!isOpen) return
    const t = setTimeout(() => closeBtnRef.current?.focus(), 0)
    return () => clearTimeout(t)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose?.()
      } else if (e.key === 'ArrowRight') {
        setStepIdx((i) => Math.min(totalSteps - 1, i + 1))
      } else if (e.key === 'ArrowLeft') {
        setStepIdx((i) => Math.max(0, i - 1))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, totalSteps, onClose])

  if (!isOpen || !tutorial || totalSteps === 0) return null

  const titleId = `tutorial-title-${tutorial.id || 'modal'}`
  const descId = `tutorial-desc-${tutorial.id || 'modal'}`

  const handleNext = () => {
    if (isLast) {
      onClose?.()
    } else {
      setStepIdx((i) => i + 1)
    }
  }

  const handlePrev = () => {
    setStepIdx((i) => Math.max(0, i - 1))
  }

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose?.()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
      onClick={handleBackdropClick}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
      >
        <div className="bg-gradient-to-br from-rose-500 to-amber-500 p-6 text-white relative">
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            aria-label="Close tutorial"
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 focus:outline-none focus:ring-2 focus:ring-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
          <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center mb-3">
            <Sparkles className="w-5 h-5" aria-hidden="true" />
          </div>
          <h2 id={titleId} className="text-xl font-bold">
            {tutorial.title}
          </h2>
          {tutorial.subtitle && (
            <p className="text-white/80 text-sm mt-1">{tutorial.subtitle}</p>
          )}
        </div>

        <div className="p-6">
          <div className="flex items-center gap-2 mb-4" aria-hidden="true">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  i <= stepIdx ? 'bg-rose-500' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>

          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
            Step {stepIdx + 1} of {totalSteps}
          </p>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {currentStep.title}
          </h3>
          <p id={descId} className="text-sm text-gray-700 leading-relaxed">
            {currentStep.body}
          </p>

          {currentStep.tip && (
            <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-900">
              <Lightbulb className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <span>
                <span className="font-semibold">Tip: </span>
                {currentStep.tip}
              </span>
            </div>
          )}

          <div className="mt-6 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-gray-500 hover:text-gray-700 underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-rose-500 rounded px-1"
            >
              Skip tour
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrev}
                disabled={isFirst}
                aria-label="Previous step"
                className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-rose-500"
              >
                <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                Back
              </button>
              <button
                type="button"
                onClick={handleNext}
                aria-label={isLast ? 'Finish tutorial' : 'Next step'}
                className="inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-gray-900 hover:bg-gray-800 text-white font-medium focus:outline-none focus:ring-2 focus:ring-rose-500"
              >
                {isLast ? 'Got it' : 'Next'}
                {!isLast && <ChevronRight className="w-4 h-4" aria-hidden="true" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
