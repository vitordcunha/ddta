import { useEffect } from 'react'
import { RouterProvider } from 'react-router-dom'
import { Toaster } from 'sonner'
import { router } from '@/router'
import { initCapacitorShell } from '@/native/initCapacitor'

function App() {
  useEffect(() => {
    void initCapacitorShell()
  }, [])

  return (
    <>
      <RouterProvider router={router} />
      <Toaster
        position="top-center"
        theme="dark"
        richColors
        closeButton
        toastOptions={{ className: 'font-sans' }}
      />
    </>
  )
}

export default App
