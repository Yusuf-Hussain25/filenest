import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { LogoMark } from '../ui/Logo'

// Sends visitors to /login (and back here afterwards); shows a branded splash while checking.
const ProtectedRoute = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="grid min-h-dvh place-items-center" role="status" aria-label="Loading Filenest">
        <div className="flex flex-col items-center gap-4">
          <span className="animate-[float_1.6s_ease-in-out_infinite]"><LogoMark size={48} /></span>
          <span className="skeleton h-1.5 w-24 rounded-full" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute
