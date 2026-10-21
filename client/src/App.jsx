import { Route, Routes } from 'react-router-dom'
import Auth from './pages/Auth'
import Drive from './pages/Drive'
import Recent from './pages/Recent'
import Starred from './pages/Starred'
import Shared from './pages/Shared'
import Trash from './pages/Trash'
import Settings from './pages/Settings'
import SharedLink from './pages/SharedLink'
import NotFound from './pages/NotFound'
import ProtectedRoute from './components/auth/ProtectedRoute'
import AppLayout from './components/layout/AppLayout'
import AppToaster from './components/ui/AppToaster'

const App = () => {
  return (
    <>
      <AppToaster />

      <Routes>
        <Route path="/login" element={<Auth mode="login" />} />
        <Route path="/register" element={<Auth mode="register" />} />
        {/* Public links: no account needed */}
        <Route path="/s/:token" element={<SharedLink />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Drive />} />
            <Route path="/folder/:folderId" element={<Drive />} />
            <Route path="/recent" element={<Recent />} />
            <Route path="/starred" element={<Starred />} />
            <Route path="/shared" element={<Shared />} />
            <Route path="/trash" element={<Trash />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  )
}

export default App
