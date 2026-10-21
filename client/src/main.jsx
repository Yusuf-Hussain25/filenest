import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
// Global tokens first, so component styles can override them
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { AppProvider } from './context/AppContext.jsx'
import ConfigError from './components/ConfigError'

const missing = [!import.meta.env.VITE_BASE_URL && 'VITE_BASE_URL'].filter(Boolean);

createRoot(document.getElementById('root')).render(
  missing.length ? <ConfigError missing={missing} /> : (
    <BrowserRouter>
      <AuthProvider>
        <AppProvider>
          <App />
        </AppProvider>
      </AuthProvider>
    </BrowserRouter>
  ),
)
