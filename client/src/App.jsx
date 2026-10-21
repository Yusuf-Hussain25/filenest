import { Navigate, Route, Routes } from 'react-router-dom'
import Auth from './pages/Auth'
import Drive from './pages/Drive'
import ProtectedRoute from './components/auth/ProtectedRoute'
import DashboardLayout from './components/layout/DashboardLayout'
import SharedFile from './pages/SharedFile'
import Trash from './pages/Trash'
import SharedWithMe from './pages/SharedWithMe'
import AppToaster from './components/ui/AppToaster'

const App = () => {
  return (
    <>
      <AppToaster />

      <Routes>
        <Route path="/login" element={<Auth mode="login" />}/>
        <Route path="/register" element={<Auth mode="register" />}/>
        <Route path="/s/:token" element={<SharedWithMe />}/>

        {/* Private Routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<DashboardLayout />}>
            <Route path="/" element={<Drive />}/>
            <Route path="/drive/:folderId" element={<Drive />}/>
            <Route path="/shared" element={<SharedFile />}/>
            <Route path="/trash" element={<Trash />}/>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />}/>
      </Routes>
    </>
  )
}

export default App
