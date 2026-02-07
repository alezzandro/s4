import React from 'react';
import { useAuth } from '@app/components/AuthContext/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * ProtectedRoute component
 * Wraps routes that require authentication
 * AuthGate handles showing login page, this just gates content rendering
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading, authMode } = useAuth();

  // If auth is disabled, allow access
  if (authMode === 'none') {
    return <>{children}</>;
  }

  // If still loading auth state, show nothing (AuthGate will handle loading)
  if (isLoading) {
    return null;
  }

  // If not authenticated, show nothing (AuthGate will show login)
  if (!isAuthenticated) {
    return null;
  }

  // User is authenticated - render protected content
  return <>{children}</>;
};

export default ProtectedRoute;
