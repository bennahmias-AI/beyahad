import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './utils/pwaInstall.js'   // תופס את אירוע ההתקנה מוקדם הכי אפשר
import { initAudioUnlock } from './utils/audioUnlock.js'
import App from './App.jsx'

initAudioUnlock()   // פותח אודיו בנגיעה הראשונה — כדי שצליל הצלצול יעבוד באפליקציה הנייטיב

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)
