import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

// Signal boot screen to hide
if (window.__axionReady) {
  window.__axionReady()
} else {
  // Fallback if script order differs
  document.addEventListener('DOMContentLoaded', () => {
    window.__axionReady?.()
  })
}
