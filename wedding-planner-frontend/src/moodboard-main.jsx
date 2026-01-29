/**
 * Standalone moodboard entry point.
 * Loaded in isolation to avoid react-konva "Cannot access before initialization" error
 * that occurs when konva is bundled with the main app.
 */
import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ToastProvider } from './components/ui/Toast.jsx'
import { AuthProvider } from './contexts/AuthContext.jsx'
import MoodboardPage from './pages/admin/MoodboardPage.jsx'
import './index.css'

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
          <MoodboardPage />
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
