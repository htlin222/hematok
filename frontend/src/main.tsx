import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { LikedImagesProvider } from './contexts/LikedImagesContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LikedImagesProvider>
      <App />
    </LikedImagesProvider>
  </StrictMode>,
)
