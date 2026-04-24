import { RouterProvider } from 'react-router-dom'
import { Toaster } from 'sonner'
import { router } from '@/router'

function App() {
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
