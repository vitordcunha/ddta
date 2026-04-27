import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import App from '@/App'
import { GeolocationProvider } from '@/hooks/GeolocationContext'
import { MapEngineProvider } from '@/features/map-engine'
import { queryClient } from '@/lib/queryClient'
import '@/styles/globals.css'
import 'sonner/dist/styles.css'
import { registerSW } from 'virtual:pwa-register'

registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <MapEngineProvider>
        <GeolocationProvider>
          <App />
        </GeolocationProvider>
      </MapEngineProvider>
    </QueryClientProvider>
  </StrictMode>,
)
