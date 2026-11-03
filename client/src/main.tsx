import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import '@fontsource/space-grotesk/latin-400.css'
import '@fontsource/space-grotesk/latin-500.css'
import '@fontsource/space-grotesk/latin-700.css'
import { qc } from './lib/api'
import { Protected } from './app/Shell'
import { Auth } from './features/Auth'
import './styles/main.css'
document.addEventListener('visibilitychange', () =>
  document.documentElement.classList.toggle('tab-hidden', document.hidden),
)
if ('serviceWorker' in navigator)
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={qc}>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Auth />} />
        <Route path="/setup" element={<Auth setupRoute />} />
        <Route path="*" element={<Protected />} />
      </Routes>
    </BrowserRouter>
  </QueryClientProvider>,
)
