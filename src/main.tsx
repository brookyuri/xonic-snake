import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './ui/App'
import '@fontsource/press-start-2p/latin-400.css'
// Тема 2026 (VISUAL_2026.md раздел 2): только latin, font-display: swap (так в @fontsource).
// Файлы шрифтов грузятся браузером, только когда текст темы 2026 появляется на экране.
import '@fontsource/audiowide/latin-400.css'
import '@fontsource/chakra-petch/latin-400.css'
import '@fontsource/chakra-petch/latin-600.css'
import '@fontsource/chakra-petch/latin-700.css'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
