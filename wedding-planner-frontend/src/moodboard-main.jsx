/**
 * Standalone moodboard entry point.
 * Dynamic import of MoodboardPage isolates react-konva to avoid
 * "Cannot access before initialization" circular dependency.
 */
import React, { Suspense, lazy } from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ToastProvider } from './components/ui/Toast.jsx'
import { AuthProvider } from './contexts/AuthContext.jsx'
import './index.css'

const MoodboardPage = lazy(() => import('./pages/admin/MoodboardPage.jsx'))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, retry: 1 },
  },
})

function MoodboardApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <Suspense fallback={<div className="flex h-screen items-center justify-center">Loading moodboard…</div>}>
            <MoodboardPage />
          </Suspense>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <MoodboardApp />
  </React.StrictMode>,
)
