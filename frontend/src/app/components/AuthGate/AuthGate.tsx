import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@app/components/AuthContext/AuthContext';
import Login from '@app/components/Login/Login';
import { Spinner } from '@patternfly/react-core';

interface AuthGateProps {
  children: React.ReactNode;
}

/**
 * AuthGate component that controls access to the application
 * - Shows loading spinner while checking authentication
 * - Shows login page if auth is required and user is not authenticated
 * - Shows the app if authenticated or auth is disabled
 */
export const AuthGate: React.FC<AuthGateProps> = ({ children }) => {
  const { t } = useTranslation();
  const { isLoading, isAuthenticated, authMode } = useAuth();

  // Show loading spinner while checking auth status
  if (isLoading) {
    return (
      <div className="auth-loading-center">
        <Spinner size="xl" aria-label={t('accessibility.loadingAuthentication')} />
      </div>
    );
  }

  // If auth is required and user is not authenticated, show login page ONLY
  if (authMode !== 'none' && !isAuthenticated) {
    return <Login />;
  }

  // User is authenticated or auth is disabled - render the app
  return <>{children}</>;
};

export default AuthGate;
